/* Blackjack — motor puro (sem DOM). Mesa contra a banca, até 6 jogadores, fichas com apostas.
 * Regras: 6 baralhos; banca para em qualquer 17 (inclusive 17 "soft"); Blackjack paga 3:2; a banca confere Blackjack
 * quando mostra 10 ou Ás; Dobrar em qualquer mão de 2 cartas (também depois de Separar); Separar cartas de mesmo valor-nome (até 4 mãos,
 * Ases recebem só 1 carta e não re-separam); Seguro (até metade da aposta, paga 2:1) quando a banca mostra Ás; Desistir (late surrender:
 * só como primeira ação, devolve metade); aposta lateral "Par Perfeito" nas 2 primeiras cartas (misto 6:1, colorido 12:1, perfeito 25:1). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BlackjackEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RULES = { decks: 6, start: 1000, minBet: 10, maxBet: 500, step: 10, maxSide: 100, maxHands: 4, reshuffleBelow: 78, maxPlayers: 6, minPlayers: 1,
    pairs: { misto: 6, colorido: 12, perfeito: 25 },
    idleMs: { BETTING: 40000, INSURANCE: 30000, PLAYING: 40000 } }; // tempo parado até o jogador ficar "ausente"
  const SUITS = ['S', 'H', 'D', 'C'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RED = { H: 1, D: 1 };

  function mulberry(s) { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return { s, r: ((t ^ (t >>> 14)) >>> 0) / 4294967296 }; }
  function rnd(st) { const o = mulberry(st.rs); st.rs = o.s; return o.r; }

  function buildShoe(st) {
    const sh = []; let n = 0;
    for (let d = 0; d < RULES.decks; d++) for (const s of SUITS) for (const r of RANKS) sh.push({ id: 'c' + (n++), rank: r, suit: s });
    for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); const t = sh[i]; sh[i] = sh[j]; sh[j] = t; }
    return sh;
  }
  function pval(c) { return c.rank === 'A' ? 11 : (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J') ? 10 : parseInt(c.rank, 10); }
  /** { total, soft } — soft = há um Ás valendo 11 */
  function score(cards) {
    let t = 0, aces = 0;
    cards.forEach((c) => { t += pval(c); if (c.rank === 'A') aces++; });
    while (t > 21 && aces > 0) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 };
  }
  const isBJ = (cards) => cards.length === 2 && score(cards).total === 21;
  const tenVal = (c) => pval(c) === 10;

  function newHand(cards, bet, fromSplit) { return { cards: cards || [], bet, doubled: false, fromSplit: !!fromSplit, done: false, surrendered: false, aces: false, result: null, payout: 0 }; }

  function createGame(opts) {
    const players = opts.players.map((p, i) => ({ seat: i, id: p.id, name: p.name, chips: RULES.start, rebuys: 0, bet: 0, side: 0, ready: false, insured: 0, insDecided: false,
      hands: [], sideResult: null, sidePay: 0, chipsStart: RULES.start, base: RULES.start, roundNet: 0, biggest: 0, rounds: 0, handsWon: 0, handsLost: 0, handsPush: 0, blackjacks: 0, peak: RULES.start, absent: false }));
    const st = { v: 1, rs: (opts.seed >>> 0) || 1, round: 1, phase: 'BETTING', players, dealer: { cards: [], reveal: false }, shoe: [], turn: null, log: [], reshuffled: true, winner: null };
    st.shoe = buildShoe(st);
    return st;
  }

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const livePlayers = (s) => s.players.filter((p) => p.bet > 0 && p.hands.length);
  function draw(s) { if (!s.shoe.length) s.shoe = buildShoe(s); return s.shoe.pop(); }
  function ev(s, e) { s.log.push(e); if (s.log.length > 60) s.log.shift(); }

  /** Quem precisa agir agora (lista de assentos) */
  function pending(s) {
    if (!s) return [];
    if (s.phase === 'BETTING') return s.players.filter((p) => !p.ready).map((p) => p.seat);
    if (s.phase === 'INSURANCE') return s.players.filter((p) => p.bet > 0 && !p.insDecided).map((p) => p.seat);
    if (s.phase === 'PLAYING' && s.turn) return [s.turn.seat];
    return [];
  }

  function pairKind(a, b) {
    if (a.rank !== b.rank) return null;
    if (a.suit === b.suit) return 'perfeito';
    return (RED[a.suit] ? 1 : 0) === (RED[b.suit] ? 1 : 0) ? 'colorido' : 'misto';
  }

  // ───────── rodada ─────────
  function startRound(s) {
    // todos apostaram
    const bettors = s.players.filter((p) => p.bet > 0);
    if (!bettors.length) { s.players.forEach((p) => { p.ready = false; }); ev(s, { type: 'NOBETS' }); return; }
    s.dealer = { cards: [], reveal: false };
    s.players.forEach((p) => {
      p.hands = []; p.sideResult = null; p.sidePay = 0; p.insured = 0; p.insDecided = p.bet <= 0; p.roundNet = 0; p.chipsStart = p.chips;
      if (p.bet > 0) { p.chips -= p.bet + p.side; p.rounds++; }
    });
    for (let k = 0; k < 2; k++) {
      bettors.forEach((p) => { if (k === 0) p.hands.push(newHand([draw(s)], p.bet)); else p.hands[0].cards.push(draw(s)); });
      s.dealer.cards.push(draw(s));
    }
    bettors.forEach((p) => {
      const h = p.hands[0];
      if (p.side > 0) {
        const kd = pairKind(h.cards[0], h.cards[1]);
        if (kd) { p.sideResult = kd; p.sidePay = p.side * (1 + RULES.pairs[kd]); p.chips += p.sidePay; } else { p.sideResult = 'perdeu'; }
      }
      if (isBJ(h.cards)) { h.done = true; }
    });
    ev(s, { type: 'DEAL' });
    const up = s.dealer.cards[0];
    if (up.rank === 'A') { s.phase = 'INSURANCE'; s.turn = null; return; }
    afterInsurance(s);
  }

  function afterInsurance(s) {
    const up = s.dealer.cards[0];
    if ((up.rank === 'A' || tenVal(up)) && isBJ(s.dealer.cards)) { s.dealer.reveal = true; ev(s, { type: 'DEALER_BJ' }); return settle(s); }
    if (up.rank === 'A' || tenVal(up)) ev(s, { type: 'NOBJ' });
    s.phase = 'PLAYING';
    advance(s, 0, 0);
  }

  /** Procura a próxima mão pendente a partir de (seat, hand); sem mão → banca joga */
  function advance(s, seat, hand) {
    for (let i = seat; i < s.players.length; i++) {
      const p = s.players[i];
      for (let j = (i === seat ? hand : 0); j < p.hands.length; j++) {
        const h = p.hands[j];
        if (!h.done) { s.turn = { seat: i, hand: j }; return; }
      }
    }
    s.turn = null; dealerPlay(s);
  }

  function dealerPlay(s) {
    s.dealer.reveal = true;
    const alive = livePlayers(s).some((p) => p.hands.some((h) => !h.surrendered && score(h.cards).total <= 21 && !(isBJ(h.cards) && !h.fromSplit)));
    if (alive) {
      for (;;) { const sc = score(s.dealer.cards); if (sc.total >= 17) break; s.dealer.cards.push(draw(s)); ev(s, { type: 'DEALER_HIT' }); }
    }
    settle(s);
  }

  function settle(s) {
    const dsc = score(s.dealer.cards).total, dbj = isBJ(s.dealer.cards);
    s.players.forEach((p) => {
      if (p.bet <= 0) return;
      let anyWin = 0;
      p.hands.forEach((h) => {
        const t = score(h.cards).total, nat = isBJ(h.cards) && !h.fromSplit;
        let pay = 0, res;
        if (h.surrendered) { pay = h.bet / 2; res = 'surrender'; }
        else if (t > 21) { pay = 0; res = 'bust'; }
        else if (nat) { if (dbj) { pay = h.bet; res = 'push'; } else { pay = h.bet * 2.5; res = 'blackjack'; } }
        else if (dbj) { pay = 0; res = 'lose'; }
        else if (dsc > 21) { pay = h.bet * 2; res = 'win'; }
        else if (t > dsc) { pay = h.bet * 2; res = 'win'; }
        else if (t === dsc) { pay = h.bet; res = 'push'; }
        else { pay = 0; res = 'lose'; }
        h.result = res; h.payout = pay; p.chips += pay;
        if (res === 'win' || res === 'blackjack') p.handsWon++; else if (res === 'push') p.handsPush++; else p.handsLost++;
        if (res === 'blackjack') p.blackjacks++;
        if (res === 'win' || res === 'blackjack') anyWin = 1;
      });
      if (p.insured > 0 && dbj) p.chips += p.insured * 3;
      p.roundNet = p.chips - p.chipsStart;
      if (p.roundNet > p.biggest) p.biggest = p.roundNet;
      if (p.chips > p.peak) p.peak = p.chips;
    });
    s.phase = 'ROUND_OVER'; s.turn = null;
    ev(s, { type: 'ROUND_OVER' });
  }

  // ───────── ações ─────────
  function fail(error) { return { ok: false, error }; }

  function applyAction(state, a) {
    const s = clone(state), me = s.players[a.player];
    if (!me && a.type !== 'END_GAME') return fail('Jogador inválido.');
    const t = a.type, prevAt = s.lastAt;
    if (t !== 'ABSENT' && typeof a.at === 'number') s.lastAt = a.at;
    if (me && me.absent && !a.auto && t !== 'ABSENT') { me.absent = false; ev(s, { type: 'BACK', seat: me.seat }); } // voltou a jogar
    if (t === 'RETURN') return { ok: true, state: s };
    if (t === 'ABSENT') { // qualquer cliente pode marcar quem ficou parado além do limite
      const lim = RULES.idleMs[s.phase];
      if (!lim || typeof a.at !== 'number' || typeof prevAt !== 'number') return fail('Sem controle de tempo.');
      if (a.at - prevAt < lim) return fail('Ainda dentro do tempo.');
      if (me.absent) return fail('Já está ausente.');
      if (pending(s).indexOf(me.seat) < 0) return fail('Esse jogador não está devendo jogada.');
      me.absent = true; ev(s, { type: 'ABSENT', seat: me.seat });
      return { ok: true, state: s };
    }

    if (t === 'BET') {
      if (s.phase !== 'BETTING') return fail('Não é hora de apostar.');
      const bet = a.bet | 0, side = a.side | 0;
      if (bet < 0 || side < 0) return fail('Aposta inválida.');
      if (bet === 0 && side > 0) return fail('A aposta lateral exige a aposta principal.');
      if (bet > 0 && (bet < RULES.minBet || bet > RULES.maxBet || bet % RULES.step)) return fail('Aposta de ' + RULES.minBet + ' a ' + RULES.maxBet + ' (de ' + RULES.step + ' em ' + RULES.step + ').');
      if (side > RULES.maxSide || side % RULES.step) return fail('Aposta lateral até ' + RULES.maxSide + '.');
      if (bet + side > me.chips) return fail('Fichas insuficientes.');
      me.bet = bet; me.side = side; me.ready = true;
      ev(s, { type: 'BET', seat: me.seat, bet });
      if (s.players.every((p) => p.ready)) startRound(s);
      return { ok: true, state: s };
    }

    if (t === 'INSURE') {
      if (s.phase !== 'INSURANCE') return fail('Não há seguro agora.');
      if (me.bet <= 0 || me.insDecided) return fail('Você já decidiu.');
      if (a.take) {
        const amt = me.bet / 2;
        if (amt > me.chips) return fail('Fichas insuficientes para o seguro.');
        me.insured = amt; me.chips -= amt;
      }
      me.insDecided = true;
      ev(s, { type: 'INSURE', seat: me.seat, take: !!a.take });
      if (s.players.every((p) => p.insDecided)) afterInsurance(s);
      return { ok: true, state: s };
    }

    if (t === 'NEXT_ROUND') {
      if (s.phase !== 'ROUND_OVER') return fail('A rodada ainda não acabou.');
      s.round++; s.phase = 'BETTING'; s.dealer = { cards: [], reveal: false }; s.turn = null;
      if (s.shoe.length < RULES.reshuffleBelow) { s.shoe = buildShoe(s); s.reshuffled = true; ev(s, { type: 'SHUFFLE' }); } else s.reshuffled = false;
      s.players.forEach((p) => {
        p.hands = []; p.bet = 0; p.side = 0; p.ready = false; p.insured = 0; p.insDecided = false; p.sideResult = null; p.sidePay = 0; p.roundNet = 0;
        if (p.chips < RULES.minBet) { p.chips += RULES.start; p.rebuys++; ev(s, { type: 'REBUY', seat: p.seat }); }
      });
      return { ok: true, state: s };
    }

    if (t === 'TAKEOVER') { // um humano assume o lugar de um bot (a qualquer momento); o saldo conta a partir daqui
      if (s.phase === 'ENDED') return fail('A mesa já acabou.');
      me.id = a.id; me.name = a.name; me.absent = false;
      me.base = (s.phase === 'PLAYING' || s.phase === 'INSURANCE') ? me.chipsStart : me.chips;
      me.rebuys = 0; me.biggest = 0; me.rounds = 0; me.handsWon = 0; me.handsLost = 0; me.handsPush = 0; me.blackjacks = 0; me.peak = me.chips;
      ev(s, { type: 'TAKEOVER', seat: me.seat });
      return { ok: true, state: s };
    }

    if (t === 'END_GAME') {
      if (s.phase !== 'ROUND_OVER' && s.phase !== 'BETTING') return fail('Termine a rodada primeiro.');
      if (s.phase === 'BETTING' && s.players.some((p) => p.ready && p.bet > 0)) return fail('Há apostas na mesa.');
      s.phase = 'ENDED'; s.turn = null; ev(s, { type: 'END' });
      return { ok: true, state: s };
    }

    // ações de jogo
    if (s.phase !== 'PLAYING' || !s.turn) return fail('Não é hora de jogar.');
    if (s.turn.seat !== a.player) return fail('Não é a sua vez.');
    const hi = s.turn.hand, h = me.hands[hi];

    if (t === 'HIT') {
      h.cards.push(draw(s)); ev(s, { type: 'HIT', seat: me.seat, hand: hi });
      const sc = score(h.cards).total;
      if (sc >= 21) h.done = true;
      if (h.done) advance(s, me.seat, hi);
      return { ok: true, state: s };
    }
    if (t === 'STAND') { h.done = true; ev(s, { type: 'STAND', seat: me.seat, hand: hi }); advance(s, me.seat, hi); return { ok: true, state: s }; }
    if (t === 'DOUBLE') {
      if (h.cards.length !== 2) return fail('Só dá para dobrar com 2 cartas.');
      if (h.aces) return fail('Ases separados recebem só uma carta.');
      if (me.chips < h.bet) return fail('Fichas insuficientes para dobrar.');
      me.chips -= h.bet; h.bet *= 2; h.doubled = true; h.cards.push(draw(s)); h.done = true;
      ev(s, { type: 'DOUBLE', seat: me.seat, hand: hi }); advance(s, me.seat, hi); return { ok: true, state: s };
    }
    if (t === 'SPLIT') {
      if (h.cards.length !== 2 || h.cards[0].rank !== h.cards[1].rank) return fail('Só dá para separar duas cartas iguais.');
      if (me.hands.length >= RULES.maxHands) return fail('Máximo de ' + RULES.maxHands + ' mãos.');
      if (me.chips < h.bet) return fail('Fichas insuficientes para separar.');
      if (h.aces) return fail('Ases separados não separam de novo.');
      me.chips -= h.bet;
      const second = newHand([h.cards.pop()], h.bet, true);
      h.fromSplit = true;
      const isAce = h.cards[0].rank === 'A';
      h.cards.push(draw(s)); second.cards.push(draw(s));
      if (isAce) { h.aces = true; second.aces = true; h.done = true; second.done = true; }
      else { if (score(h.cards).total === 21) h.done = true; if (score(second.cards).total === 21) second.done = true; }
      me.hands.splice(hi + 1, 0, second);
      ev(s, { type: 'SPLIT', seat: me.seat, hand: hi });
      advance(s, me.seat, hi);
      return { ok: true, state: s };
    }
    if (t === 'SURRENDER') {
      if (me.hands.length !== 1 || h.cards.length !== 2 || h.fromSplit) return fail('Só dá para desistir como primeira jogada.');
      h.surrendered = true; h.done = true; ev(s, { type: 'SURRENDER', seat: me.seat });
      advance(s, me.seat, hi); return { ok: true, state: s };
    }
    return fail('Ação desconhecida.');
  }

  /** O que o jogador pode fazer na mão atual */
  function options(s, seat) {
    const o = { hit: false, stand: false, double: false, split: false, surrender: false };
    if (!s || s.phase !== 'PLAYING' || !s.turn || s.turn.seat !== seat) return o;
    const p = s.players[seat], h = p.hands[s.turn.hand];
    o.hit = o.stand = true;
    if (h.cards.length === 2 && !h.aces && p.chips >= h.bet) o.double = true;
    if (h.cards.length === 2 && h.cards[0].rank === h.cards[1].rank && p.hands.length < RULES.maxHands && p.chips >= h.bet && !h.aces) o.split = true;
    if (p.hands.length === 1 && h.cards.length === 2 && !h.fromSplit) o.surrender = true;
    return o;
  }

  /** Resumo final (ordenado por saldo) */
  function standings(s) {
    return s.players.map((p) => ({ seat: p.seat, id: p.id, name: p.name, chips: p.chips, rebuys: p.rebuys, net: p.chips - p.base - RULES.start * p.rebuys, biggest: p.biggest, rounds: p.rounds, handsWon: p.handsWon, handsLost: p.handsLost, handsPush: p.handsPush, blackjacks: p.blackjacks, peak: p.peak }))
      .sort((a, b) => b.net - a.net);
  }

  return { RULES, SUITS, RANKS, createGame, applyAction, pending, options, score, isBJ, pval, pairKind, standings };
});
