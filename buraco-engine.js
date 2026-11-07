/**
 * BURACO ENGINE — Buraco Aberto, 4 jogadores (2 duplas)
 * Implementa o documento buraco-regras.md (seções citadas nos comentários).
 *
 * Funciona em Node (require) e no navegador (<script> → window.BuracoEngine).
 * O estado é JSON puro (pronto para Firebase). Nenhuma função usa timers:
 * o relógio é controlado por quem chama, passando `now` (ms) às funções.
 *
 * USO BÁSICO
 *   const E = BuracoEngine;
 *   let state = E.createGame({ players: ['Ana','Beto','Carla','Davi'], seed: 123 });
 *   let r = E.applyAction(state, { type: 'DRAW_STOCK', player: 0 }, Date.now());
 *   if (r.ok) state = r.state;           // r.events descreve o que aconteceu
 *   state = E.applyAction(state, {...}).state;
 *
 * AÇÕES (action.player = índice 0..3 do jogador que age)
 *   DRAW_STOCK                                  comprar do monte
 *   DRAW_DISCARD                                pegar o lixo inteiro
 *   LAY_MELD     { cardIds, option? }           baixar jogo novo (3+ cartas)
 *   ADD_TO_MELD  { meldId, cardId, option? }    adicionar 1 carta a jogo da dupla
 *   DISCARD      { cardId }                     descartar
 *   START_NEXT_ROUND                            nova rodada (após ROUND_OVER)
 *
 * `option` escolhe entre as disposições possíveis (ex.: onde fica o coringa).
 * Liste-as com getMeldOptions / getAddOptions; a de índice 0 é a padrão
 * (a mais limpa; em empate, coringa na ponta de cima).
 *
 * TEMPO (seção 10): chame processTimeouts(state, now) periodicamente
 * (applyAction já faz isso antes de cada ação).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuracoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────── Constantes ─────────────────────────

  const SUITS = ['S', 'H', 'D', 'C']; // ♠ ♥ ♦ ♣
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK_VALUE = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
  // Desempate do descarte automático (seção 10.3): menor rank primeiro, o 2 por último
  const DISCARD_TIE_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

  const DEFAULT_CONFIG = {
    targetScore: 3000,          // seção 8.4
    drawSeconds: 0,             // seção 10.1: 0 = sem limite de tempo (use 20 para o relógio de compra)
    playSeconds: 0,             // seção 10.1: 0 = sem limite de tempo (use 40 para o relógio de jogadas)
    vulnerableAt: 1500,         // seção 8.5: a dupla com este placar (ou mais) começa a rodada vulnerável
    openMin: 75,                // seção 8.5: pontos em cartas da primeira descida de uma dupla vulnerável
    batidaBonus: 100,           // seção 7.2: bônus de 100 para quem bate (ajustável)
    stockEmptyEnd: 'after_turn' // 'after_turn' | 'immediate' — quando a rodada acaba se o monte esgota sem morto (6.3.5)
  };

  // ───────────────────────── Utilitários ─────────────────────────

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ok = () => ({ ok: true });
  const fail = (code, message) => ({ ok: false, error: { code, message } });
  const teamOf = (i) => (i % 2 === 0 ? 'A' : 'B');
  const rankPositions = (rank) => (rank === 'A' ? [1, 14] : [RANK_VALUE[rank]]);
  const cardLabel = (c) => c.rank + SUIT_SYMBOL[c.suit];

  /** Valor da carta em pontos (seção 1.3) */
  function cardPoints(card) {
    if (card.rank === 'A') return 15;
    if (card.rank === '2') return 10;
    if (['8', '9', '10', 'J', 'Q', 'K'].includes(card.rank)) return 10;
    return 5; // 3 a 7
  }

  /** PRNG determinístico guardado no estado (mulberry32) */
  function nextRandom(state) {
    const a = (state.rng + 0x6d2b79f5) | 0;
    state.rng = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function shuffle(arr, state) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(state) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const p of permutations(rest)) out.push([x, ...p]);
    });
    return out;
  }

  /** 2 baralhos de 52 cartas = 104 (seção 1.2). `deck` 0/1 serve para a cor do verso. */
  function createDeck() {
    const cards = [];
    let id = 0;
    for (let deck = 0; deck < 2; deck++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) cards.push({ id: id++, rank, suit, deck });
      }
    }
    return cards;
  }

  // ───────────────────────── Jogos (seções 4 e 5) ─────────────────────────
  //
  // Um jogo guarda: { id, suit, cards: [{ card, pos, wild }] } ordenado por pos.
  //   pos  = posição na sequência: A=1 (baixo) ... K=13, A=14 (alto)
  //   wild = true quando o 2 age como coringa (seção 4.2):
  //          2 do mesmo naipe na posição natural (pos 2) é carta normal.

  /**
   * Resolve onde as cartas ficam num jogo.
   * fixed   = cartas naturais com posição já definida [{card,pos}]
   * movable = 2s que podem ser posicionados (coringa ou natural em pos 2)
   * Retorna listas de entradas ordenadas por pos, todas válidas.
   */
  function solveLayouts(suit, fixed, movable) {
    if (fixed.length === 0 || movable.length > 2) return [];
    const taken = new Set();
    for (const f of fixed) {
      if (taken.has(f.pos)) return [];
      taken.add(f.pos);
    }
    const ps = fixed.map((f) => f.pos);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    const gaps = [];
    for (let p = lo; p <= hi; p++) if (!taken.has(p)) gaps.push(p);
    const m = movable.length;
    if (gaps.length > m) return [];
    const extra = m - gaps.length;
    const out = [];
    for (let down = 0; down <= extra; down++) {
      const up = extra - down;
      if (lo - down < 1 || hi + up > 14) continue;
      const slots = gaps.slice();
      for (let i = 1; i <= down; i++) slots.push(lo - i);
      for (let i = 1; i <= up; i++) slots.push(hi + i);
      for (const perm of permutations(movable)) {
        const entries = fixed.map((f) => ({ card: f.card, pos: f.pos, wild: false }));
        perm.forEach((card, i) => {
          const pos = slots[i];
          entries.push({ card, pos, wild: !(card.suit === suit && pos === 2) });
        });
        if (entries.filter((e) => e.wild).length > 1) continue; // 1 coringa por jogo
        entries.sort((a, b) => a.pos - b.pos);
        out.push(entries);
      }
    }
    return out;
  }

  const layoutSignature = (entries) =>
    entries.map((e) => `${e.card.rank}${e.card.suit}@${e.pos}${e.wild ? 'w' : ''}`).join(',');

  /** Remove duplicatas e ordena: menos coringas primeiro; empate: coringa mais alto primeiro */
  function finalizeLayouts(suit, lists) {
    const seen = new Set();
    const out = [];
    for (const entries of lists) {
      const sig = layoutSignature(entries);
      if (seen.has(sig)) continue;
      seen.add(sig);
      const wildPos = entries.filter((e) => e.wild).map((e) => e.pos);
      out.push({
        suit,
        entries,
        start: entries[0].pos,
        end: entries[entries.length - 1].pos,
        size: entries.length,
        wilds: wildPos.length,
        clean: wildPos.length === 0,
        _sig: sig,
        _maxWild: wildPos.length ? Math.max(...wildPos) : 0
      });
    }
    out.sort((a, b) => a.wilds - b.wilds || b._maxWild - a._maxWild || (a._sig < b._sig ? -1 : a._sig > b._sig ? 1 : 0));
    out.forEach((l) => { delete l._sig; delete l._maxWild; });
    return out;
  }

  function aceCombos(aces) {
    if (aces.length === 0) return [[]];
    if (aces.length === 1) return [[{ card: aces[0], pos: 1 }], [{ card: aces[0], pos: 14 }]];
    if (aces.length === 2) return [[{ card: aces[0], pos: 1 }, { card: aces[1], pos: 14 }]];
    return [];
  }

  /**
   * Disposições possíveis para baixar um JOGO NOVO com estas cartas (3 a 14).
   * Lista vazia = não forma jogo válido.
   */
  function findMeldLayouts(cards) {
    if (!Array.isArray(cards) || cards.length < 3 || cards.length > 14) return [];
    const naturals = cards.filter((c) => c.rank !== '2');
    const twos = cards.filter((c) => c.rank === '2');
    if (naturals.length === 0) return [];
    const suit = naturals[0].suit;
    if (naturals.some((c) => c.suit !== suit)) return [];
    const aces = naturals.filter((c) => c.rank === 'A');
    const others = naturals.filter((c) => c.rank !== 'A').map((c) => ({ card: c, pos: RANK_VALUE[c.rank] }));
    const all = [];
    for (const combo of aceCombos(aces)) all.push(...solveLayouts(suit, [...others, ...combo], twos));
    return finalizeLayouts(suit, all);
  }

  /**
   * Disposições possíveis ao ADICIONAR 1 carta a um jogo existente (seção 4.3).
   * Nenhuma carta já baixada sai do jogo; só o coringa pode mudar de posição.
   */
  function findAddLayouts(meld, card) {
    if (meld.cards.length >= 14) return [];
    const suit = meld.suit;
    const fixed = meld.cards.filter((e) => !e.wild).map((e) => ({ card: e.card, pos: e.pos }));
    const movable = meld.cards.filter((e) => e.wild).map((e) => e.card);
    let results = [];
    if (card.rank === '2') {
      results = solveLayouts(suit, fixed, [...movable, card]);
    } else {
      if (card.suit !== suit) return [];
      for (const pos of rankPositions(card.rank)) {
        results.push(...solveLayouts(suit, [...fixed, { card, pos }], movable));
        // o 2 do mesmo naipe que está no lugar natural (posição 2) também pode virar coringa e tapar um buraco
        if (movable.length === 0) {
          const two = fixed.find((f) => f.card.rank === '2' && f.pos === 2);
          if (two) {
            const rest = fixed.filter((f) => f !== two);
            results.push(...solveLayouts(suit, [...rest, { card, pos }], [two.card]));
          }
        }
      }
    }
    return finalizeLayouts(suit, results);
  }

  /** Resumo de um jogo: canastra? limpa? bônus (seção 5) */
  function meldInfo(meld) {
    const size = meld.cards.length;
    const wilds = meld.cards.filter((e) => e.wild).length;
    const clean = wilds === 0;
    const isCanastra = size >= 7;
    let bonus = 0;
    let kind = null;
    if (isCanastra) {
      if (clean && size === 14) { bonus = 1000; kind = 'c1000'; }
      else if (clean && size === 13) { bonus = 500; kind = 'c500'; }
      else if (clean) { bonus = 200; kind = 'limpa'; }
      else { bonus = 100; kind = 'suja'; }
    }
    return { size, wilds, clean, isCanastra, bonus, kind, start: meld.cards[0].pos, end: meld.cards[size - 1].pos };
  }

  const hasCleanCanastra = (team) =>
    team.melds.some((m) => { const i = meldInfo(m); return i.isCanastra && i.clean; });

  // ───────────────────────── Estado e rodadas ─────────────────────────

  function createGame(options = {}) {
    const names = options.players || ['J0', 'J1', 'J2', 'J3'];
    const now = options.now != null ? options.now : Date.now();
    const seed = options.seed != null ? options.seed : Math.floor(Math.random() * 4294967296);
    const config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
    if (options.targetScore) config.targetScore = options.targetScore;
    const state = {
      config,
      rng: seed | 0,
      nextMeldId: 1,
      round: 0,
      firstPlayer: 0,
      scores: { A: 0, B: 0 },
      players: names.map((name, i) => ({ id: i, name, team: teamOf(i), hand: [] })),
      teams: null,
      mortos: [],
      stock: [],
      discard: [],
      phase: 'SETUP',
      turn: { player: 0, deadline: null, drewFrom: null },
      paused: null,
      endVote: null,
      pendingRoundEnd: false,
      roundResult: null,
      winner: null,
      log: []
    };
    dealRound(state, now);
    return state;
  }

  /** Seção 2: 11 cartas por jogador, 2 mortos de 11, monte com 38, lixo vazio */
  function dealRound(state, now) {
    state.round += 1;
    const deck = shuffle(createDeck(), state);
    state.players.forEach((p) => { p.hand = []; });
    for (let i = 0; i < 44; i++) state.players[i % 4].hand.push(deck.pop());
    state.mortos = [
      { cards: deck.splice(0, 11) },
      { cards: deck.splice(0, 11) }
    ];
    state.stock = deck;
    state.discard = [];
    state.teams = {
      A: { melds: [], mortoTaken: false, vulnerable: state.scores.A >= state.config.vulnerableAt, opened: !(state.scores.A >= state.config.vulnerableAt) },
      B: { melds: [], mortoTaken: false, vulnerable: state.scores.B >= state.config.vulnerableAt, opened: !(state.scores.B >= state.config.vulnerableAt) }
    };
    state.opening = null;
    state.pendingRoundEnd = false;
    state.roundResult = null;
    state.winner = null;
    state.firstPlayer = (state.round - 1) % 4;
    startTurn(state, state.firstPlayer, now);
  }

  /** Prazo em ms, ou null quando o tempo está desligado (segundos <= 0) */
  function deadlineIn(seconds, now) { return seconds > 0 ? now + seconds * 1000 : null; }

  function startTurn(state, player, now) {
    state.phase = 'WAITING_TURN';
    state.turn = { player, deadline: deadlineIn(state.config.drawSeconds, now), drewFrom: null };
    state.opening = null;
  }

  // ───────────── Dupla vulnerável (seção 8.5) ─────────────

  const needsOpening = (state, p) => { const t = state.teams[p.team]; return !!(t.vulnerable && !t.opened); };

  /** Antes de baixar/adicionar: a mão não pode esvaziar antes de a dupla vulnerável somar os pontos */
  function openingGuard(state, p, cards) {
    if (!needsOpening(state, p)) return null;
    const pts = cards.reduce((a, c) => a + cardPoints(c), 0);
    const total = (state.opening ? state.opening.points : 0) + pts;
    if (p.hand.length - cards.length === 0 && total < state.config.openMin) {
      return fail('OPENING_INCOMPLETE', 'Dupla vulnerável: a primeira descida precisa somar ' + state.config.openMin + ' pontos (faltam ' + (state.config.openMin - total) + ').');
    }
    return null;
  }
  /** Depois de baixar/adicionar (com a mão ainda intacta no snapshot): soma os pontos e abre a dupla ao chegar no mínimo */
  function openingBegin(state, p) {
    if (needsOpening(state, p) && !state.opening) state.opening = { player: p.id, points: 0, hand: clone(p.hand) };
  }
  function openingCount(state, p, cards, events) {
    if (!needsOpening(state, p) || !state.opening) return;
    state.opening.points += cards.reduce((a, c) => a + cardPoints(c), 0);
    if (state.opening.points >= state.config.openMin) {
      events.push({ type: 'TEAM_OPENED', player: p.id, points: state.opening.points });
      state.teams[p.team].opened = true;
      state.opening = null;
    }
  }
  function doUndoOpening(state, action, now, events) {
    const c = checkTurn(state, action, 'PLAYING');
    if (c) return c;
    if (!state.opening) return fail('NO_OPENING', 'Não há descida para desfazer.');
    const p = cur(state);
    p.hand = state.opening.hand;
    state.teams[p.team].melds = [];
    state.opening = null;
    events.push({ type: 'OPENING_UNDONE', player: p.id });
    return ok();
  }

  const cur = (state) => state.players[state.turn.player];

  // ───────────────────────── Morto e monte (seção 6) ─────────────────────────

  /** O que acontece se o jogador ficar sem cartas agora? */
  function emptyOutcome(state, playerIdx) {
    const t = teamOf(playerIdx);
    const team = state.teams[t];
    if (!team.mortoTaken && state.mortos.length > 0) return 'MORTO'; // o morto não tem dono: vale quem esvaziar a mão primeiro
    if (team.mortoTaken && hasCleanCanastra(team)) return 'BATIDA';
    return null; // regra da última carta (3.4)
  }

  function takeMorto(state, player, standing, events) {
    const m = state.mortos.splice(0, 1)[0];
    player.hand = m.cards;
    state.teams[player.team].mortoTaken = true;
    events.push({ type: standing ? 'MORTO_EM_PE' : 'MORTO_DESCARTE', player: player.id });
  }

  /** Monte acabou (seção 6.3) */
  function onStockEmpty(state, now, events) {
    if (state.mortos.length > 0) {
      const i = state.mortos.length === 1 ? 0 : Math.floor(nextRandom(state) * state.mortos.length);
      const m = state.mortos.splice(i, 1)[0];
      state.stock = m.cards;
      events.push({ type: 'MORTO_VIRA_MONTE', cards: m.cards.length });
    } else if (state.config.stockEmptyEnd === 'immediate') {
      finishRound(state, 'STOCK_EMPTY', null, events, now);
    } else {
      state.pendingRoundEnd = true;
      events.push({ type: 'MONTE_ACABOU_SEM_MORTO' });
    }
  }

  // ───────────────────────── Ações ─────────────────────────

  function checkTurn(state, action, phase) {
    if (state.phase === 'ROUND_OVER') return fail('ROUND_OVER', 'A rodada terminou.');
    if (state.phase === 'GAME_OVER') return fail('GAME_OVER', 'O jogo terminou.');
    if (state.paused) return fail('PAUSED', 'O jogo está pausado.');
    if (action.player !== state.turn.player) return fail('NOT_YOUR_TURN', 'Não é a sua vez.');
    if (state.phase !== phase) {
      return fail('WRONG_PHASE', phase === 'WAITING_TURN' ? 'Você já comprou nesta vez.' : 'Compre uma carta primeiro.');
    }
    return null;
  }

  function doDrawStock(state, now, events) {
    const p = cur(state);
    if (state.stock.length === 0) return fail('STOCK_EMPTY', 'O monte está vazio.');
    p.hand.push(state.stock.pop());
    state.phase = 'PLAYING';
    state.turn.drewFrom = 'STOCK';
    state.turn.deadline = deadlineIn(state.config.playSeconds, now);
    events.push({ type: 'DREW_STOCK', player: p.id });
    if (state.stock.length === 0) onStockEmpty(state, now, events);
    return ok();
  }

  function doDrawDiscard(state, now, events) {
    const p = cur(state);
    if (state.discard.length === 0) return fail('DISCARD_EMPTY', 'O lixo está vazio.');
    const taken = state.discard.length;
    p.hand.push(...state.discard); // leva todas as cartas; sem exigir usar o topo (3.1)
    state.discard = [];
    state.phase = 'PLAYING';
    state.turn.drewFrom = 'DISCARD';
    state.turn.deadline = deadlineIn(state.config.playSeconds, now);
    events.push({ type: 'DREW_DISCARD', player: p.id, cards: taken });
    return ok();
  }

  /** Depois de baixar/adicionar: trata mão vazia e a regra da última carta (3.4) */
  function afterPlay(state, p, now, events) {
    if (p.hand.length === 0) {
      const out = emptyOutcome(state, p.id);
      if (out === 'MORTO') {
        takeMorto(state, p, true, events); // em pé: continua o turno (6.2)
        state.turn.deadline = deadlineIn(state.config.playSeconds, now); // relógio reinicia (10.4)
        return ok();
      }
      if (out === 'BATIDA') {
        finishRound(state, 'BATIDA', p.id, events, now);
        return ok();
      }
      return fail('LAST_CARD_RULE', 'Você precisa ficar com ao menos 1 carta na mão.');
    }
    if (p.hand.length === 1 && emptyOutcome(state, p.id) === null) {
      // ficaria com 1 carta sem poder descartá-la (descartar o deixaria sem cartas)
      return fail('LAST_CARD_RULE', 'Você precisa ficar com ao menos 1 carta na mão.');
    }
    return ok();
  }

  function doLay(state, action, now, events) {
    const p = cur(state);
    const ids = action.cardIds;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return fail('INVALID_MELD', 'Cartas inválidas.');
    const cards = ids.map((id) => p.hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) return fail('CARDS_NOT_IN_HAND', 'Carta não está na sua mão.');
    if (cards.length < 3) return fail('INVALID_MELD', 'Um jogo novo precisa de 3 ou mais cartas.');
    const layouts = findMeldLayouts(cards);
    if (!layouts.length) return fail('INVALID_MELD', 'Essas cartas não formam um jogo válido.');
    const lay = layouts[action.option || 0];
    if (!lay) return fail('INVALID_OPTION', 'Opção de disposição inválida.');
    const guard = openingGuard(state, p, cards);
    if (guard) return guard;
    openingBegin(state, p);
    p.hand = p.hand.filter((c) => !ids.includes(c.id));
    const meld = { id: state.nextMeldId++, suit: lay.suit, cards: lay.entries };
    state.teams[p.team].melds.push(meld);
    events.push({ type: 'MELD_LAID', player: p.id, meldId: meld.id, size: lay.size });
    openingCount(state, p, cards, events);
    return afterPlay(state, p, now, events);
  }

  function doAdd(state, action, now, events) {
    const p = cur(state);
    const meld = state.teams[p.team].melds.find((m) => m.id === action.meldId);
    if (!meld) return fail('MELD_NOT_FOUND', 'Jogo não encontrado na mesa da sua dupla.');
    const card = p.hand.find((c) => c.id === action.cardId);
    if (!card) return fail('CARDS_NOT_IN_HAND', 'Carta não está na sua mão.');
    const layouts = findAddLayouts(meld, card);
    if (!layouts.length) return fail('INVALID_MELD', 'Essa carta não encaixa nesse jogo.');
    const lay = layouts[action.option || 0];
    if (!lay) return fail('INVALID_OPTION', 'Opção de disposição inválida.');
    const guard = openingGuard(state, p, [card]);
    if (guard) return guard;
    openingBegin(state, p);
    p.hand = p.hand.filter((c) => c.id !== card.id);
    meld.cards = lay.entries;
    events.push({ type: 'CARD_ADDED', player: p.id, meldId: meld.id, size: lay.size });
    openingCount(state, p, [card], events);
    return afterPlay(state, p, now, events);
  }

  /** Adiciona várias cartas da mão a um mesmo jogo, na ordem em que encaixarem (cada uma entra uma por vez) */
  function doAddMany(state, action, now, events) {
    const p = cur(state);
    let rest = (action.cardIds || []).slice();
    if (!rest.length || new Set(rest).size !== rest.length) return fail('INVALID_MELD', 'Cartas inválidas.');
    let guard = 0;
    while (rest.length && guard++ < 40) {
      let progressed = false;
      for (const id of rest.slice()) {
        if (state.phase !== 'PLAYING' || p.hand.length === 0) break;
        const before = JSON.stringify(state.teams[p.team].melds);
        const res = doAdd(state, { meldId: action.meldId, cardId: id, option: 0 }, now, events);
        if (res.ok) { rest = rest.filter((x) => x !== id); progressed = true; }
        else if (res.error.code === 'INVALID_MELD' && JSON.stringify(state.teams[p.team].melds) === before) continue;
        else return res;
      }
      if (!progressed) return fail('INVALID_MELD', 'Essas cartas não encaixam nesse jogo.');
    }
    return rest.length ? fail('INVALID_MELD', 'Essas cartas não encaixam nesse jogo.') : ok();
  }

  function doDiscard(state, cardId, now, events) {
    const p = cur(state);
    if (state.opening) return fail('OPENING_INCOMPLETE', 'Dupla vulnerável: faltam ' + (state.config.openMin - state.opening.points) + ' pontos para abrir. Baixe mais cartas ou desfaça a descida.');
    const card = p.hand.find((c) => c.id === cardId);
    if (!card) return fail('CARDS_NOT_IN_HAND', 'Carta não está na sua mão.');
    const emptying = p.hand.length === 1;
    const out = emptying ? emptyOutcome(state, p.id) : null;
    if (emptying && out === null) return fail('LAST_CARD_RULE', 'Você precisa ficar com ao menos 1 carta na mão.');
    p.hand = p.hand.filter((c) => c.id !== cardId);
    state.discard.push(card);
    events.push({ type: 'DISCARDED', player: p.id, card });
    if (emptying) {
      if (out === 'BATIDA') {
        finishRound(state, 'BATIDA', p.id, events, now);
        return ok();
      }
      takeMorto(state, p, false, events); // descartando: pega o morto, turno encerra (6.2)
    }
    endTurn(state, now, events);
    return ok();
  }

  function endTurn(state, now, events) {
    if (state.pendingRoundEnd) {
      finishRound(state, 'STOCK_EMPTY', null, events, now);
      return;
    }
    startTurn(state, (state.turn.player + 1) % 4, now);
  }

  // ───────────────────────── Pontuação (seção 8) ─────────────────────────

  /**
   * Placar da rodada no mesmo formato da tela de resultado do jogo de exemplo:
   * morto, batida, cartas (mesa − mão), canastras por tipo.
   */
  function scoreRound(state, batidaTeam) {
    const res = {};
    for (const t of ['A', 'B']) {
      const team = state.teams[t];
      let onTable = 0;
      const cat = {
        suja: { count: 0, points: 0 },
        limpa: { count: 0, points: 0 },
        c500: { count: 0, points: 0 },
        c1000: { count: 0, points: 0 }
      };
      for (const m of team.melds) {
        onTable += m.cards.reduce((s, e) => s + cardPoints(e.card), 0);
        const info = meldInfo(m);
        if (info.isCanastra) {
          cat[info.kind].count += 1;
          cat[info.kind].points += info.bonus;
        }
      }
      const inHand = state.players
        .filter((p) => p.team === t)
        .reduce((s, p) => s + p.hand.reduce((a, c) => a + cardPoints(c), 0), 0);
      const morto = team.mortoTaken ? 0 : -100;
      const batida = batidaTeam === t ? state.config.batidaBonus : 0;
      const cartas = onTable - inHand;
      const canastras = cat.suja.points + cat.limpa.points + cat.c500.points + cat.c1000.points;
      res[t] = {
        morto, batida, cartas, onTable, inHand,
        suja: cat.suja, limpa: cat.limpa, c500: cat.c500, c1000: cat.c1000,
        total: morto + batida + cartas + canastras
      };
    }
    return res;
  }

  function finishRound(state, reason, by, events, now) {
    const batidaTeam = reason === 'BATIDA' && by != null ? teamOf(by) : null;
    const detail = scoreRound(state, batidaTeam);
    state.scores.A += detail.A.total;
    state.scores.B += detail.B.total;
    const tgt = state.config.targetScore;
    const a = state.scores.A;
    const b = state.scores.B;
    let winner = null;
    if (a >= tgt || b >= tgt) {
      if (a > b) winner = 'A';
      else if (b > a) winner = 'B'; // empate na meta: segue para outra rodada
    }
    state.roundResult = { reason, by, detail, scoresAfter: { A: a, B: b } };
    state.pendingRoundEnd = false;
    state.winner = winner;
    state.phase = winner ? 'GAME_OVER' : 'ROUND_OVER';
    state.turn.deadline = null;
    events.push({ type: winner ? 'GAME_OVER' : 'ROUND_OVER', reason, by, winner, scores: { A: a, B: b } });
  }

  function startNextRound(state, now) {
    dealRound(state, now);
  }

  // ───────────────────────── Pausa e encerramento antecipado ─────────────────────────

  const validSeat = (i) => Number.isInteger(i) && i >= 0 && i < 4;

  function doPause(state, action, now, events) {
    if (state.phase === 'GAME_OVER') return fail('GAME_OVER', 'O jogo terminou.');
    if (!validSeat(action.player)) return fail('INVALID_PLAYER', 'Jogador inválido.');
    if (state.paused) return fail('PAUSED', 'O jogo já está pausado.');
    state.paused = { by: action.player, at: now };
    events.push({ type: 'PAUSED', player: action.player });
    return ok();
  }

  function doResume(state, action, now, events) {
    if (!state.paused) return fail('NOT_PAUSED', 'O jogo não está pausado.');
    if (state.turn.deadline != null) state.turn.deadline += Math.max(0, now - state.paused.at);
    state.paused = null;
    events.push({ type: 'RESUMED', player: action.player });
    return ok();
  }

  function finishEarly(state, events) {
    const a = state.scores.A, b = state.scores.B;
    state.winner = null; // encerramento antecipado cancela os pontos: não há vencedor
    state.phase = 'GAME_OVER';
    state.turn.deadline = null;
    state.paused = null;
    state.endVote = null;
    state.pendingRoundEnd = false;
    state.roundResult = { reason: 'EARLY', by: null, detail: null, cancelled: true, scoresAfter: { A: a, B: b } };
    events.push({ type: 'GAME_OVER', reason: 'EARLY', by: null, winner: state.winner, scores: { A: a, B: b } });
  }

  function doProposeEnd(state, action, now, events) {
    if (state.phase === 'GAME_OVER') return fail('GAME_OVER', 'O jogo terminou.');
    if (!validSeat(action.player)) return fail('INVALID_PLAYER', 'Jogador inválido.');
    if (state.endVote) return fail('VOTE_OPEN', 'Já existe uma proposta de encerramento.');
    state.endVote = { by: action.player, yes: [action.player] };
    events.push({ type: 'END_PROPOSED', player: action.player });
    return ok();
  }

  function doVoteEnd(state, action, now, events) {
    if (!state.endVote) return fail('NO_VOTE', 'Não há proposta de encerramento.');
    if (!validSeat(action.player)) return fail('INVALID_PLAYER', 'Jogador inválido.');
    if (!action.yes) {
      state.endVote = null;
      events.push({ type: 'END_REFUSED', player: action.player });
      return ok();
    }
    if (!state.endVote.yes.includes(action.player)) state.endVote.yes.push(action.player);
    if (state.endVote.yes.length >= 4) finishEarly(state, events);
    return ok();
  }

  /** Encerramento imediato (uso do administrador da mesa) */
  function doEndNow(state, action, now, events) {
    if (state.phase === 'GAME_OVER') return fail('GAME_OVER', 'O jogo terminou.');
    finishEarly(state, events);
    return ok();
  }

  // ───────────────────────── Tempo (seção 10) ─────────────────────────

  /** Vizinhos: mesmo naipe e posições consecutivas (Ás vale 1 e 14) */
  function areNeighbors(r1, r2) {
    const p1 = rankPositions(r1);
    const p2 = rankPositions(r2);
    return p1.some((x) => p2.some((y) => Math.abs(x - y) === 1));
  }

  /** Descarte automático (10.3): menor pontuação fora de sequência; senão a menor da mão */
  function chooseAutoDiscard(hand) {
    const protectedIds = new Set();
    for (const a of hand) {
      for (const b of hand) {
        if (a.id !== b.id && a.suit === b.suit && areNeighbors(a.rank, b.rank)) protectedIds.add(a.id);
      }
    }
    const free = hand.filter((c) => !protectedIds.has(c.id));
    const pool = free.length ? free : hand;
    const cmp = (x, y) =>
      cardPoints(x) - cardPoints(y) ||
      DISCARD_TIE_ORDER.indexOf(x.rank) - DISCARD_TIE_ORDER.indexOf(y.rank) ||
      x.id - y.id;
    return pool.slice().sort(cmp)[0];
  }

  /** A carta do topo do lixo serve? (10.2) Só o topo conta; mão = antes de pegar o lixo */
  function topCardUsable(state, playerIdx) {
    if (state.discard.length === 0) return false;
    const top = state.discard[state.discard.length - 1];
    const team = state.teams[teamOf(playerIdx)];
    for (const m of team.melds) if (findAddLayouts(m, top).length) return true;
    const hand = state.players[playerIdx].hand;
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        if (findMeldLayouts([top, hand[i], hand[j]]).length) return true;
      }
    }
    return false;
  }

  function autoDraw(state, at, events) {
    const idx = state.turn.player;
    let from;
    if (state.discard.length > 0 && topCardUsable(state, idx)) {
      doDrawDiscard(state, at, events);
      from = 'DISCARD';
    } else if (state.stock.length > 0) {
      doDrawStock(state, at, events);
      from = 'STOCK';
    } else if (state.discard.length > 0) {
      doDrawDiscard(state, at, events);
      from = 'DISCARD';
    } else {
      finishRound(state, 'STOCK_EMPTY', null, events, at);
      return;
    }
    events.push({ type: 'TIMEOUT_COMPRA', player: idx, from });
  }

  function autoDiscard(state, at, events) {
    const p = cur(state);
    if (state.opening) { p.hand = state.opening.hand; state.teams[p.team].melds = []; state.opening = null; events.push({ type: 'OPENING_UNDONE', player: p.id }); }
    const pick = chooseAutoDiscard(p.hand);
    const tries = [pick, ...p.hand.filter((c) => c.id !== pick.id)];
    for (const c of tries) {
      const res = doDiscard(state, c.id, at, events);
      if (res.ok) {
        events.push({ type: 'TIMEOUT_JOGADA', player: p.id, card: c });
        return;
      }
    }
  }

  /**
   * Executa as ações automáticas de quem estourou o tempo. Cada ação usa o
   * horário em que o prazo venceu (não o `now` de quem processa), então o
   * atraso do servidor não prejudica ninguém.
   */
  function processTimeouts(state, now) {
    const events = [];
    if (state.paused) return events;
    let guard = 0;
    while (
      (state.phase === 'WAITING_TURN' || state.phase === 'PLAYING') &&
      state.turn.deadline != null &&
      now >= state.turn.deadline &&
      guard++ < 200
    ) {
      const at = state.turn.deadline;
      if (state.phase === 'WAITING_TURN') autoDraw(state, at, events);
      else autoDiscard(state, at, events);
    }
    return events;
  }

  // ───────────────────────── API pública ─────────────────────────

  function dispatch(state, action, now, events) {
    switch (action.type) {
      case 'DRAW_STOCK': {
        const c = checkTurn(state, action, 'WAITING_TURN');
        return c || doDrawStock(state, now, events);
      }
      case 'DRAW_DISCARD': {
        const c = checkTurn(state, action, 'WAITING_TURN');
        return c || doDrawDiscard(state, now, events);
      }
      case 'LAY_MELD': {
        const c = checkTurn(state, action, 'PLAYING');
        return c || doLay(state, action, now, events);
      }
      case 'ADD_TO_MELD': {
        const c = checkTurn(state, action, 'PLAYING');
        return c || doAdd(state, action, now, events);
      }
      case 'DISCARD': {
        const c = checkTurn(state, action, 'PLAYING');
        return c || doDiscard(state, action.cardId, now, events);
      }
      case 'ADD_MANY': {
        const c = checkTurn(state, action, 'PLAYING');
        return c || doAddMany(state, action, now, events);
      }
      case 'UNDO_OPENING': return doUndoOpening(state, action, now, events);
      case 'PAUSE': return doPause(state, action, now, events);
      case 'RESUME': return doResume(state, action, now, events);
      case 'PROPOSE_END': return doProposeEnd(state, action, now, events);
      case 'VOTE_END': return doVoteEnd(state, action, now, events);
      case 'END_NOW': return doEndNow(state, action, now, events);
      case 'START_NEXT_ROUND':
        if (state.paused) return fail('PAUSED', 'O jogo está pausado.');
        if (state.phase !== 'ROUND_OVER') return fail('WRONG_PHASE', 'A rodada ainda não terminou.');
        startNextRound(state, now);
        events.push({ type: 'ROUND_STARTED', round: state.round });
        return ok();
      default:
        return fail('UNKNOWN_ACTION', 'Ação desconhecida.');
    }
  }

  /**
   * Aplica uma ação. Nunca altera o estado recebido.
   * Retorna { ok, state, events, error? }. Em caso de erro, `state` é o estado
   * (já avançado pelos timeouts, se houve) que deve ser persistido.
   */
  /** Registra eventos no log do estado com número de sequência (n) estável entre dispositivos */
  function appendLog(state, events, now) {
    let n = state.logSeq || 0;
    state.log = (state.log || []).concat(events.map((e) => Object.assign({ n: ++n, at: now }, e))).slice(-60);
    state.logSeq = n;
  }

  function applyAction(state, action, now = Date.now()) {
    const base = clone(state);
    const events = processTimeouts(base, now);
    if (events.length) appendLog(base, events, now);
    const work = clone(base);
    const evs = [];
    const res = dispatch(work, action, now, evs);
    if (!res.ok) return { ok: false, error: res.error, state: base, events };
    appendLog(work, evs, now);
    return { ok: true, state: work, events: events.concat(evs) };
  }

  /** Disposições possíveis para baixar um jogo novo com estas cartas da mão */
  function getMeldOptions(state, playerIdx, cardIds) {
    const hand = state.players[playerIdx].hand;
    const cards = cardIds.map((id) => hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) return [];
    return findMeldLayouts(cards);
  }

  /** Disposições possíveis ao adicionar uma carta da mão a um jogo da dupla */
  function getAddOptions(state, playerIdx, meldId, cardId) {
    const p = state.players[playerIdx];
    const meld = state.teams[p.team].melds.find((m) => m.id === meldId);
    const card = p.hand.find((c) => c.id === cardId);
    if (!meld || !card) return [];
    return findAddLayouts(meld, card);
  }

  /** Visão de um jogador: esconde as mãos dos outros, o monte e os mortos */
  function viewFor(state, playerIdx) {
    return {
      config: state.config,
      round: state.round,
      phase: state.phase,
      scores: state.scores,
      turn: { player: state.turn.player, deadline: state.turn.deadline },
      me: playerIdx,
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        handCount: p.hand.length,
        hand: p.id === playerIdx ? p.hand : undefined
      })),
      teams: state.teams,
      opening: state.opening ? { player: state.opening.player, points: state.opening.points } : null,
      stockCount: state.stock.length,
      discard: state.discard,
      mortos: state.mortos.map((m) => ({ count: m.cards.length })),
      paused: state.paused,
      endVote: state.endVote,
      pendingRoundEnd: state.pendingRoundEnd,
      roundResult: state.roundResult,
      winner: state.winner
    };
  }

  return {
    RULES: DEFAULT_CONFIG,
    SUITS, RANKS, SUIT_SYMBOL,
    createDeck, createGame, applyAction, processTimeouts,
    getMeldOptions, getAddOptions, viewFor,
    findMeldLayouts, findAddLayouts, meldInfo,
    cardPoints, cardLabel, scoreRound,
    chooseAutoDiscard, topCardUsable, emptyOutcome,
    _internal: { finishRound, solveLayouts, startTurn, dealRound, nextRandom }
  };
});
