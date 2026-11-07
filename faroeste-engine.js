/* Faroeste — motor de regras (puro, sem DOM). UMD: window.FaroesteEngine / require().
 * applyAction(state, action) -> { ok, state, events, error }
 * Ações: DRAW, PLAY, RESPOND, PICK, HEAL_DISCARD, DISCARD, END_TURN */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FaroesteEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────── Dados ─────────
  const KINDS = {
    tiro: { t: 'marrom' }, errou: { t: 'marrom' }, tonico: { t: 'marrom' }, taberna: { t: 'marrom' },
    diligencia: { t: 'marrom' }, carroca: { t: 'marrom' }, armazem: { t: 'marrom' },
    assalto: { t: 'marrom' }, confisco: { t: 'marrom' }, rajada: { t: 'marrom' },
    boiada: { t: 'marrom' }, duelo: { t: 'marrom' },
    cavalo: { t: 'azul' }, luneta: { t: 'azul' }, barril: { t: 'azul' }, cadeia: { t: 'azul' }, dinamite: { t: 'azul' },
    repetidor: { t: 'azul', w: 1 }, canocurto: { t: 'azul', w: 2 }, pistolalonga: { t: 'azul', w: 3 },
    carabina: { t: 'azul', w: 4 }, rifle: { t: 'azul', w: 5 }
  };
  const COUNTS = {
    tiro: 25, errou: 12, tonico: 6, confisco: 4, assalto: 4, boiada: 2, armazem: 2, diligencia: 2,
    carroca: 1, rajada: 1, duelo: 1, taberna: 1, cavalo: 2, luneta: 2, barril: 2, cadeia: 3, dinamite: 2,
    repetidor: 2, canocurto: 3, pistolalonga: 1, carabina: 1, rifle: 1
  };
  const NAMES = {
    tiro: 'Tiro', errou: 'Errou', tonico: 'Tônico', taberna: 'Taberna', diligencia: 'Diligência', carroca: 'Carroça do Correio',
    armazem: 'Armazém', assalto: 'Assalto', confisco: 'Confisco', rajada: 'Rajada', boiada: 'Estouro da Boiada', duelo: 'Duelo',
    cavalo: 'Cavalo Veloz', luneta: 'Luneta', barril: 'Barril de Blindagem', cadeia: 'Cadeia', dinamite: 'Dinamite',
    repetidor: 'Repetidor', canocurto: 'Cano Curto', pistolalonga: 'Pistola Longa', carabina: 'Carabina', rifle: 'Rifle'
  };
  const CHARS = [
    { id: 'tiao', nome: 'Tião Pistola', hp: 4 }, { id: 'valeria', nome: 'Dona Valéria', hp: 4 },
    { id: 'zegringo', nome: 'Zé do Gringo', hp: 3 }, { id: 'caca', nome: 'Cacá Ligeiro', hp: 4 },
    { id: 'berenice', nome: 'Madame Berenice', hp: 4 }, { id: 'pepe', nome: 'Pepe Almanaque', hp: 4 },
    { id: 'duque', nome: 'Duque Trevo', hp: 4 }, { id: 'paco', nome: 'Paco Foragido', hp: 3 },
    { id: 'rosinha', nome: 'Rosinha Longeira', hp: 4 }, { id: 'pedrao', nome: 'Pedrão Sorte', hp: 4 },
    { id: 'sid', nome: 'Sid Remendo', hp: 4 }, { id: 'nando', nome: 'Nando Matador', hp: 4 },
    { id: 'suzana', nome: 'Suzana Recarga', hp: 4 }, { id: 'abutre', nome: 'Abutre Samuel', hp: 4 },
    { id: 'joca', nome: 'Joca Sem-Limite', hp: 4 }, { id: 'blackjack', nome: 'Black Jack Rubião', hp: 4 }
  ];
  const ROLES = {
    4: ['xerife', 'bandido', 'bandido', 'renegado'],
    5: ['xerife', 'ajudante', 'bandido', 'bandido', 'renegado'],
    6: ['xerife', 'ajudante', 'bandido', 'bandido', 'bandido', 'renegado'],
    7: ['xerife', 'ajudante', 'ajudante', 'bandido', 'bandido', 'bandido', 'renegado']
  };
  const SUITS = ['S', 'H', 'D', 'C'];

  // ───────── Utilidades ─────────
  const clone = (o) => JSON.parse(JSON.stringify(o));
  class Err extends Error {}
  const fail = (m) => { throw new Err(m); };

  function rnd(s) { // mulberry32 sobre s.seed
    s.seed = (s.seed + 0x6D2B79F5) | 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(s, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  function buildDeck(s) {
    const kinds = [];
    for (const k in COUNTS) for (let i = 0; i < COUNTS[k]; i++) kinds.push(k);
    shuffle(s, kinds);
    // naipes/valores equilibrados: 20 de cada naipe, valores 2..A (13) em ciclo
    return kinds.map((k, i) => ({ id: 'c' + i, kind: k, suit: SUITS[i % 4], value: 2 + (Math.floor(i / 4) % 13) }));
  }

  /** Novo jogo. opts: { players: [{id,name}], seed } (4 a 7 jogadores) */
  function createGame(opts) {
    const n = opts.players.length;
    if (n < 4 || n > 7) throw new Error('4 a 7 jogadores');
    const s = { seed: opts.seed == null ? Date.now() | 0 : opts.seed, phase: 'PLAYING', players: [], deck: [], discard: [], stack: [], turn: null, winner: null, log: [] };
    const roles = shuffle(s, ROLES[n].slice());
    const chars = shuffle(s, CHARS.slice()).slice(0, n);
    s.deck = buildDeck(s);
    opts.players.forEach((p, i) => {
      const ch = chars[i], role = roles[i];
      const hp = ch.hp + (role === 'xerife' ? 1 : 0);
      s.players.push({ seat: i, id: p.id, name: p.name, role: role, char: ch.id, maxHp: hp, hp: hp, hand: [], equip: [], alive: true });
    });
    for (const p of s.players) for (let i = 0; i < p.maxHp; i++) p.hand.push(draw1(s));
    const sh = s.players.find((p) => p.role === 'xerife').seat;
    const c = ctx(s);
    beginTurn(c, sh);
    afterAction(c);
    return s;
  }

  function ctx(s) { return { s: s, ev: [] }; }
  const emit = (c, type, data) => c.ev.push(Object.assign({ type: type }, data || {}));
  const P = (s, seat) => s.players[seat];
  const alive = (s) => s.players.filter((p) => p.alive);
  const hasChar = (p, id) => p.char === id;
  const kindOf = (card) => card.kind;
  const nm = (card) => NAMES[card.kind];

  function draw1(s) {
    if (!s.deck.length) {
      if (!s.discard.length) return null;
      s.deck = shuffle(s, s.discard.splice(0));
    }
    return s.deck.shift();
  }
  function drawN(c, p, n) {
    let k = 0;
    for (let i = 0; i < n; i++) { const d = draw1(c.s); if (d) { p.hand.push(d); k++; } }
    if (k) emit(c, 'DRAW', { seat: p.seat, n: k });
    return k;
  }
  /** "Saque": vira a carta de cima e a descarta */
  function saque(c) {
    const d = draw1(c.s);
    if (d) { c.s.discard.push(d); emit(c, 'SAQUE', { card: d }); }
    return d;
  }
  /** Saque do jogador (Duque Trevo vira 2 e fica com a melhor para o teste) */
  function saqueFor(c, p, test) {
    if (hasChar(p, 'duque')) {
      const a = saque(c), b = saque(c);
      return [a, b].find((x) => x && test(x)) || a;
    }
    return saque(c);
  }
  const isHeart = (d) => !!d && d.suit === 'H';
  const dynBoom = (d) => !!d && d.suit === 'S' && d.value >= 2 && d.value <= 9;

  function removeFrom(arr, id) { const i = arr.findIndex((x) => x.id === id); if (i < 0) return null; return arr.splice(i, 1)[0]; }
  function discardCard(c, card) { c.s.discard.push(card); }

  // ───────── Distâncias e alcance ─────────
  function distance(s, from, to) {
    const al = alive(s).map((p) => p.seat);
    const i = al.indexOf(from), j = al.indexOf(to);
    if (i < 0 || j < 0) return Infinity;
    const n = al.length, cw = (j - i + n) % n;
    let d = Math.min(cw, n - cw);
    const tp = P(s, to), fp = P(s, from);
    d += tp.equip.filter((e) => e.kind === 'cavalo').length + (hasChar(tp, 'paco') ? 1 : 0);
    d -= fp.equip.filter((e) => e.kind === 'luneta').length + (hasChar(fp, 'rosinha') ? 1 : 0);
    return Math.max(1, d);
  }
  function rawDistance(s, from, to) { // sem Cavalo/Luneta (não usado nas regras; útil para a UI)
    const al = alive(s).map((p) => p.seat), i = al.indexOf(from), j = al.indexOf(to), n = al.length, cw = (j - i + n) % n;
    return Math.min(cw, n - cw);
  }
  function weaponOf(p) { return p.equip.find((e) => KINDS[e.kind].w); }
  function range(p) { const w = weaponOf(p); return w ? KINDS[w.kind].w : 1; }
  const barrels = (p) => p.equip.filter((e) => e.kind === 'barril').length + (hasChar(p, 'berenice') ? 1 : 0);

  // ───────── Fluxo de turno ─────────
  function nextAlive(s, seat) {
    for (let i = 1; i <= s.players.length; i++) { const p = P(s, (seat + i) % s.players.length); if (p.alive) return p.seat; }
    return seat;
  }

  function beginTurn(c, seat) {
    const s = c.s;
    s.turn = { player: seat, stage: 'start', bangs: 0, drew: false, over: false };
    emit(c, 'TURN', { seat: seat });
    continueStart(c);
  }

  /** Dinamite -> Cadeia -> fase de compra */
  function continueStart(c) {
    const s = c.s, p = P(s, s.turn.player);
    if (s.turn.stage === 'start') {
      s.turn.stage = 'dyn';
      const dyn = p.equip.find((e) => e.kind === 'dinamite');
      if (dyn) {
        const d = saque(c);
        if (dynBoom(d)) {
          removeFrom(p.equip, dyn.id); discardCard(c, dyn);
          emit(c, 'DYNAMITE_BOOM', { seat: p.seat });
          damage(c, p, 3, null);
          if (s.stack.length || s.phase === 'GAME_OVER') return; // aguardando Tônico / fim
        } else {
          removeFrom(p.equip, dyn.id);
          let t = nextAlive(s, p.seat), guard = 0;
          while (P(s, t).equip.some((e) => e.kind === 'dinamite') && guard++ < 8) t = nextAlive(s, t);
          P(s, t).equip.push(dyn);
          emit(c, 'DYNAMITE_PASS', { from: p.seat, to: t });
        }
      }
    }
    if (s.phase === 'GAME_OVER') return;
    if (!p.alive) { endTurn(c); return; }
    if (s.turn.stage === 'dyn') {
      s.turn.stage = 'jail';
      const jail = p.equip.find((e) => e.kind === 'cadeia');
      if (jail) {
        const d = saqueFor(c, p, isHeart);
        removeFrom(p.equip, jail.id); discardCard(c, jail);
        if (isHeart(d)) emit(c, 'JAIL_ESCAPE', { seat: p.seat });
        else { emit(c, 'JAIL_STAY', { seat: p.seat }); endTurn(c); return; }
      }
    }
    s.turn.stage = 'draw';
  }

  function endTurn(c) {
    const s = c.s;
    if (s.phase === 'GAME_OVER') return;
    beginTurn(c, nextAlive(s, s.turn.player));
  }

  /** Chamado quando a pilha de pendências esvazia */
  function resumeFlow(c) {
    const s = c.s;
    if (s.phase === 'GAME_OVER' || s.stack.length) return;
    if (s.turn.stage === 'dyn') { continueStart(c); return; } // voltou da Dinamite
    if (s.turn.over || !P(s, s.turn.player).alive) endTurn(c);
  }

  // ───────── Dano, cura, eliminação ─────────
  function canSave(s, p) {
    if (alive(s).length <= 2) return false;
    return p.hand.some((x) => x.kind === 'tonico') || (hasChar(p, 'sid') && p.hand.length >= 2);
  }

  function damage(c, p, n, source) {
    const s = c.s;
    if (!p.alive || n <= 0) return;
    p.hp -= n;
    emit(c, 'DAMAGE', { seat: p.seat, n: n, source: source });
    if (p.hp <= 0) {
      if (canSave(s, p)) { s.stack.push({ type: 'dying', player: p.seat, source: source }); return; }
      eliminate(c, p, source);
      return;
    }
    if (hasChar(p, 'tiao')) drawN(c, p, n);
    if (hasChar(p, 'zegringo') && source != null && source !== p.seat) {
      const src = P(s, source);
      for (let i = 0; i < n && src.alive && src.hand.length; i++) {
        const card = src.hand.splice(Math.floor(rnd(s) * src.hand.length), 1)[0];
        p.hand.push(card); emit(c, 'STEAL', { from: source, to: p.seat, n: 1 });
      }
    }
  }

  function heal(c, p, n) {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    if (p.hp > before) emit(c, 'HEAL', { seat: p.seat, n: p.hp - before });
  }

  function eliminate(c, p, killer) {
    const s = c.s;
    p.alive = false; p.hp = 0;
    emit(c, 'ELIMINATED', { seat: p.seat, role: p.role, by: killer });
    const cards = p.hand.splice(0).concat(p.equip.splice(0));
    const sam = alive(s).find((q) => hasChar(q, 'abutre'));
    if (sam) { sam.hand.push.apply(sam.hand, cards); emit(c, 'LOOT', { seat: sam.seat, n: cards.length }); }
    else cards.forEach((x) => discardCard(c, x));
    // fila de pendências que mirava o eliminado
    if (s.turn && s.turn.player === p.seat) s.turn.over = true;
    if (killer != null && killer !== p.seat) {
      const k = P(s, killer);
      if (k.alive) {
        if (p.role === 'bandido') drawN(c, k, 3);
        if (p.role === 'ajudante' && k.role === 'xerife') {
          const lost = k.hand.splice(0).concat(k.equip.splice(0));
          lost.forEach((x) => discardCard(c, x)); emit(c, 'SHERIFF_PENALTY', { seat: k.seat });
        }
      }
    }
    checkWin(c);
  }

  function checkWin(c) {
    const s = c.s, al = alive(s);
    const sheriff = s.players.find((p) => p.role === 'xerife');
    let w = null;
    if (!sheriff.alive) {
      w = (al.length === 1 && al[0].role === 'renegado') ? 'renegado' : 'bandidos';
    } else if (!al.some((p) => p.role === 'bandido' || p.role === 'renegado')) {
      w = 'xerife';
    }
    if (w) { s.winner = w; s.phase = 'GAME_OVER'; s.stack = []; emit(c, 'GAME_OVER', { winner: w }); }
  }

  // ───────── Pilha de pendências ─────────
  const top = (s) => s.stack[s.stack.length - 1];

  function volleyStep(c) {
    const s = c.s, v = top(s);
    while (v.queue.length) {
      const seat = v.queue.shift(), t = P(s, seat);
      if (!t.alive) continue;
      v.cur = seat; v.need = 1;
      if (v.kind === 'tiro' || v.kind === 'rajada') {
        if (v.kind === 'tiro' && hasChar(P(s, v.source), 'nando')) v.need = 2;
        // cada Barril: um saque; copas vale como um Errou
        for (let i = 0; i < barrels(t) && v.need > 0; i++) {
          const d = saqueFor(c, t, isHeart);
          if (isHeart(d)) { v.need--; emit(c, 'BARREL_SAVE', { seat: seat }); }
        }
        if (v.need <= 0) { v.cur = null; continue; }
      }
      if (!canRespond(s, v, t)) { v.cur = null; applyVolleyHit(c, v, t); if (top(s) !== v || s.phase === 'GAME_OVER') return; continue; }
      return; // aguarda resposta
    }
    s.stack.pop();
  }
  function applyVolleyHit(c, v, t) {
    if (v.kind === 'tiro' || v.kind === 'rajada') damage(c, t, 1, v.source);
    else damage(c, t, 1, v.source);
  }
  function respKind(v) { return v.kind === 'boiada' ? 'tiro' : 'errou'; }
  function respCards(t, v) {
    const want = respKind(v);
    return t.hand.filter((x) => x.kind === want || (hasChar(t, 'valeria') && (x.kind === 'tiro' || x.kind === 'errou')));
  }
  function canRespond(s, v, t) { return respCards(t, v).length >= (v.need || 1); }

  function proceed(c) {
    const s = c.s;
    for (let guard = 0; guard < 50; guard++) {
      if (s.phase === 'GAME_OVER') return;
      const v = top(s);
      if (!v) { resumeFlow(c); return; }
      if (v.type === 'volley') {
        if (v.cur == null || !P(s, v.cur).alive) { v.cur = null; volleyStep(c); if (s.stack.length && top(s) === v && v.cur != null) return; continue; }
        return;
      }
      if (v.type === 'dying') {
        const p = P(s, v.player);
        if (!p.alive) { s.stack.pop(); continue; }
        if (p.hp >= 1) { s.stack.pop(); continue; }
        if (!canSave(s, p)) { s.stack.pop(); eliminate(c, p, v.source); continue; }
        return;
      }
      if (v.type === 'duel') {
        if (!P(s, v.a).alive || !P(s, v.b).alive) { s.stack.pop(); continue; }
        return;
      }
      if (v.type === 'store') {
        while (v.idx < v.order.length && !P(s, v.order[v.idx]).alive) v.idx++;
        if (v.idx >= v.order.length || !v.cards.length) { v.cards.forEach((x) => discardCard(c, x)); s.stack.pop(); continue; }
        return;
      }
      if (v.type === 'pepe') return;
      s.stack.pop();
    }
  }

  // ───────── Suzana: compra 1 quando a mão esvazia ─────────
  function afterAction(c) {
    const s = c.s;
    for (let i = 0; i < 2; i++) {
      for (const p of s.players) if (p.alive && hasChar(p, 'suzana') && !p.hand.length && s.phase !== 'GAME_OVER') drawN(c, p, 1);
    }
  }

  // ───────── Ações ─────────
  function applyAction(state, action) {
    const s = clone(state), c = ctx(s);
    try {
      if (s.phase === 'GAME_OVER') fail('A partida já acabou');
      const p = P(s, action.player);
      if (!p || !p.alive) fail('Jogador fora de jogo');
      switch (action.type) {
        case 'DRAW': doDraw(c, p, action); break;
        case 'PLAY': doPlay(c, p, action); break;
        case 'RESPOND': doRespond(c, p, action); break;
        case 'PICK': doPick(c, p, action); break;
        case 'HEAL_DISCARD': doSidHeal(c, p, action); break;
        case 'DISCARD': doDiscard(c, p, action); break;
        case 'END_TURN': doEnd(c, p); break;
        default: fail('Ação desconhecida');
      }
      proceed(c);
      afterAction(c);
      return { ok: true, state: s, events: c.ev, error: null };
    } catch (e) {
      if (e instanceof Err) return { ok: false, state: state, events: [], error: e.message };
      throw e;
    }
  }

  function needTurn(s, p, stage) {
    if (s.stack.length) fail('Aguardando uma resposta');
    if (s.turn.player !== p.seat) fail('Não é a sua vez');
    if (stage && s.turn.stage !== stage) fail(stage === 'draw' ? 'Você já comprou' : 'Compre primeiro');
  }

  function doDraw(c, p, a) {
    const s = c.s; needTurn(s, p, 'draw');
    let first = null, count = 2;
    const src = a.source || 'deck';
    if (src === 'discard') {
      if (!hasChar(p, 'pedrao')) fail('Só o Pedrão Sorte compra do descarte');
      if (!s.discard.length) fail('Descarte vazio');
      first = s.discard.pop(); p.hand.push(first); emit(c, 'DRAW', { seat: p.seat, n: 1, from: 'discard' }); count = 1;
    } else if (src === 'hand') {
      if (!hasChar(p, 'caca')) fail('Só o Cacá Ligeiro compra da mão de outro');
      const t = P(s, a.target);
      if (!t || !t.alive || t.seat === p.seat || !t.hand.length) fail('Alvo inválido');
      first = t.hand.splice(Math.floor(rnd(s) * t.hand.length), 1)[0]; p.hand.push(first);
      emit(c, 'STEAL', { from: t.seat, to: p.seat, n: 1 }); count = 1;
    } else if (hasChar(p, 'pepe')) {
      const cards = []; for (let i = 0; i < 3; i++) { const d = draw1(s); if (d) cards.push(d); }
      s.turn.stage = 'play'; s.turn.drew = true;
      if (cards.length <= 2) { cards.forEach((x) => p.hand.push(x)); return; }
      s.stack.push({ type: 'pepe', player: p.seat, cards: cards });
      return;
    }
    let second = null;
    for (let i = 0; i < count; i++) {
      const d = draw1(s); if (d) { p.hand.push(d); if (i === count - 1) second = d; if (count === 2 && i === 1) second = d; }
    }
    emit(c, 'DRAW', { seat: p.seat, n: count });
    if (hasChar(p, 'blackjack') && second && (second.suit === 'H' || second.suit === 'D')) { drawN(c, p, 1); emit(c, 'BLACKJACK', { seat: p.seat, card: second }); }
    s.turn.stage = 'play'; s.turn.drew = true;
  }

  function doPick(c, p, a) {
    const s = c.s, v = top(s);
    if (!v || v.type !== 'pepe' || v.player !== p.seat) fail('Nada para escolher');
    const ids = a.cardIds || [];
    if (ids.length !== 2 || ids[0] === ids[1] || !ids.every((id) => v.cards.some((x) => x.id === id))) fail('Escolha 2 das 3 cartas');
    const rest = v.cards.filter((x) => !ids.includes(x.id));
    v.cards.filter((x) => ids.includes(x.id)).forEach((x) => p.hand.push(x));
    s.deck.unshift.apply(s.deck, rest);
    s.stack.pop();
    emit(c, 'DRAW', { seat: p.seat, n: 2 });
  }

  function doSidHeal(c, p, a) {
    const s = c.s;
    if (!hasChar(p, 'sid')) fail('Só o Sid Remendo faz isso');
    const v = top(s);
    const inDying = v && v.type === 'dying' && v.player === p.seat;
    if (!inDying) needTurn(s, p, 'play');
    const ids = a.cardIds || [];
    if (ids.length !== 2 || ids[0] === ids[1]) fail('Escolha 2 cartas');
    if (p.hp >= p.maxHp && !inDying) fail('Vida já está cheia');
    const cards = ids.map((id) => p.hand.find((x) => x.id === id));
    if (cards.some((x) => !x)) fail('Carta não está na mão');
    ids.forEach((id) => discardCard(c, removeFrom(p.hand, id)));
    heal(c, p, 1);
  }

  function doDiscard(c, p, a) {
    const s = c.s; needTurn(s, p, 'play');
    const card = removeFrom(p.hand, a.cardId);
    if (!card) fail('Carta não está na mão');
    discardCard(c, card); emit(c, 'DISCARD', { seat: p.seat, card: card });
  }

  function doEnd(c, p) {
    const s = c.s; needTurn(s, p, 'play');
    if (p.hand.length > p.hp) fail('Descarte até ficar com ' + p.hp + ' carta(s)');
    endTurn(c);
  }

  function checkTarget(s, p, a, rule) {
    const t = P(s, a.target);
    if (!t || !t.alive) fail('Escolha um alvo');
    if (t.seat === p.seat) fail('Não pode mirar em você');
    if (rule === 'range' && distance(s, p.seat, t.seat) > range(p)) fail('Alvo fora de alcance');
    if (rule === 'dist1' && distance(s, p.seat, t.seat) > 1) fail('Só a distância 1');
    return t;
  }

  function doPlay(c, p, a) {
    const s = c.s; needTurn(s, p, 'play');
    const card = p.hand.find((x) => x.id === a.cardId);
    if (!card) fail('Carta não está na mão');
    let kind = card.kind;
    // Valéria usa Tiro como Errou e vice-versa só em resposta; na vez, Errou como Tiro
    if (hasChar(p, 'valeria') && kind === 'errou' && a.as === 'tiro') kind = 'tiro';
    const def = KINDS[kind];

    // limites
    if (def.t === 'azul' && kind !== 'cadeia' && !def.w && p.equip.some((e) => e.kind === kind)) fail('Você já tem essa carta em jogo');

    switch (kind) {
      case 'tiro': {
        const unlimited = hasChar(p, 'joca') || p.equip.some((e) => e.kind === 'repetidor');
        if (s.turn.bangs >= 1 && !unlimited) fail('Só 1 Tiro por turno');
        const t = checkTarget(s, p, a, 'range');
        removeFrom(p.hand, card.id); discardCard(c, card); s.turn.bangs++;
        emit(c, 'PLAY', { seat: p.seat, card: card, target: t.seat });
        s.stack.push({ type: 'volley', kind: 'tiro', source: p.seat, queue: [t.seat], cur: null });
        volleyStep(c); break;
      }
      case 'errou': fail('Errou só serve para se defender');
      case 'tonico': {
        if (alive(s).length <= 2) fail('Tônico sem efeito com 2 jogadores');
        if (p.hp >= p.maxHp) fail('Vida já está cheia');
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card }); heal(c, p, 1); break;
      }
      case 'taberna':
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card });
        alive(s).forEach((q) => heal(c, q, 1)); break;
      case 'diligencia': case 'carroca':
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card }); drawN(c, p, kind === 'diligencia' ? 2 : 3); break;
      case 'armazem': {
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card });
        const order = []; let t = p.seat;
        for (let i = 0; i < alive(s).length; i++) { order.push(t); t = nextAlive(s, t); }
        const cards = []; for (let i = 0; i < order.length; i++) { const d = draw1(s); if (d) cards.push(d); }
        s.stack.push({ type: 'store', cards: cards, order: order, idx: 0 }); break;
      }
      case 'assalto': case 'confisco': {
        const t = checkTarget(s, p, a, kind === 'assalto' ? 'dist1' : null);
        let taken;
        if (a.targetCardId) {
          if (!t.equip.some((e) => e.id === a.targetCardId)) fail('Carta em jogo não encontrada');
          taken = removeFrom(t.equip, a.targetCardId);
        } else {
          if (!t.hand.length) fail('O alvo não tem cartas na mão');
          taken = t.hand.splice(Math.floor(rnd(s) * t.hand.length), 1)[0];
        }
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card, target: t.seat });
        if (kind === 'assalto') { p.hand.push(taken); emit(c, 'STEAL', { from: t.seat, to: p.seat, n: 1, card: a.targetCardId ? taken : null }); }
        else { discardCard(c, taken); emit(c, 'FORCE_DISCARD', { seat: t.seat, card: a.targetCardId ? taken : null }); }
        break;
      }
      case 'rajada': case 'boiada': {
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card });
        const queue = []; let t = nextAlive(s, p.seat);
        while (t !== p.seat) { queue.push(t); t = nextAlive(s, t); }
        s.stack.push({ type: 'volley', kind: kind === 'rajada' ? 'rajada' : 'boiada', source: p.seat, queue: queue, cur: null });
        volleyStep(c); break;
      }
      case 'duelo': {
        const t = checkTarget(s, p, a, null);
        removeFrom(p.hand, card.id); discardCard(c, card);
        emit(c, 'PLAY', { seat: p.seat, card: card, target: t.seat });
        s.stack.push({ type: 'duel', a: p.seat, b: t.seat, turn: t.seat }); break;
      }
      case 'cadeia': {
        const t = checkTarget(s, p, a, null);
        if (t.role === 'xerife') fail('Não pode prender o Xerife');
        if (t.equip.some((e) => e.kind === 'cadeia')) fail('Esse jogador já está preso');
        removeFrom(p.hand, card.id); t.equip.push(card);
        emit(c, 'PLAY', { seat: p.seat, card: card, target: t.seat }); break;
      }
      default: { // cavalo, luneta, barril, dinamite, armas
        if (def.w) { const old = weaponOf(p); if (old) { removeFrom(p.equip, old.id); discardCard(c, old); } }
        removeFrom(p.hand, card.id); p.equip.push(card);
        emit(c, 'PLAY', { seat: p.seat, card: card });
      }
    }
  }

  function doRespond(c, p, a) {
    const s = c.s, v = top(s);
    if (!v) fail('Nada a responder');
    if (v.type === 'volley') {
      if (v.cur !== p.seat) fail('Não é a sua resposta');
      if (a.pass || a.cardId == null) { const t = p; v.cur = null; applyVolleyHit(c, v, t); return; }
      const ok = respCards(p, v).find((x) => x.id === a.cardId);
      if (!ok) fail(v.kind === 'boiada' ? 'Descarte um Tiro' : 'Use um Errou');
      removeFrom(p.hand, ok.id); discardCard(c, ok);
      v.need--; emit(c, 'RESPOND', { seat: p.seat, card: ok });
      if (v.need <= 0) { v.cur = null; emit(c, 'DODGE', { seat: p.seat }); }
      else if (!canRespond(s, v, p)) { v.cur = null; applyVolleyHit(c, v, p); }
      return;
    }
    if (v.type === 'duel') {
      if (v.turn !== p.seat) fail('Não é a sua vez no duelo');
      if (a.pass || a.cardId == null) {
        s.stack.pop(); const other = p.seat === v.a ? v.b : v.a;
        damage(c, p, 1, other); return;
      }
      const ok = p.hand.find((x) => x.id === a.cardId && (x.kind === 'tiro' || (hasChar(p, 'valeria') && x.kind === 'errou')));
      if (!ok) fail('Descarte um Tiro');
      removeFrom(p.hand, ok.id); discardCard(c, ok); emit(c, 'RESPOND', { seat: p.seat, card: ok });
      v.turn = p.seat === v.a ? v.b : v.a; return;
    }
    if (v.type === 'store') {
      if (v.order[v.idx] !== p.seat) fail('Não é a sua escolha');
      const card = removeFrom(v.cards, a.cardId); if (!card) fail('Escolha uma das cartas reveladas');
      p.hand.push(card); v.idx++; emit(c, 'STORE_PICK', { seat: p.seat, card: card }); return;
    }
    if (v.type === 'dying') {
      if (v.player !== p.seat) fail('Não é você');
      if (a.pass || a.cardId == null) { s.stack.pop(); eliminate(c, p, v.source); return; }
      const card = p.hand.find((x) => x.id === a.cardId && x.kind === 'tonico');
      if (!card) fail('Só o Tônico salva agora');
      removeFrom(p.hand, card.id); discardCard(c, card);
      emit(c, 'PLAY', { seat: p.seat, card: card }); heal(c, p, 1);
      if (p.hp >= 1) s.stack.pop();
      return;
    }
    fail('Nada a responder');
  }

  // ───────── Visão por jogador ─────────
  function viewFor(state, seat) {
    const s = clone(state), over = s.phase === 'GAME_OVER';
    s.deck = { count: s.deck.length };
    s.discardTop = s.discard.length ? s.discard[s.discard.length - 1] : null;
    s.discard = { count: s.discard.length };
    s.players.forEach((p) => {
      if (p.seat !== seat) {
        p.handCount = p.hand.length; p.hand = [];
        if (!(p.role === 'xerife' || !p.alive || over)) p.role = null;
      }
    });
    s.stack.forEach((v) => {
      if (v.type === 'pepe' && v.player !== seat) v.cards = v.cards.map(() => null);
    });
    s.seed = 0; s.viewer = seat;
    return s;
  }

  /** Ações legais simples de consulta (usado pelos bots e pela UI) */
  function whoMustAct(state) {
    const v = state.stack[state.stack.length - 1];
    if (state.phase === 'GAME_OVER') return null;
    if (!v) return state.turn.player;
    if (v.type === 'volley') return v.cur;
    if (v.type === 'duel') return v.turn;
    if (v.type === 'store') return v.order[v.idx];
    if (v.type === 'dying' || v.type === 'pepe') return v.player;
    return null;
  }

  return { createGame, applyAction, viewFor, whoMustAct, distance, rawDistance, range, KINDS, NAMES, CHARS, COUNTS, ROLES };
});
