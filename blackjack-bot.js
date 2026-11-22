/* Blackjack — bots (estratégia básica). Só usam o que um jogador vê: as próprias cartas e a carta aberta da banca. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.BlackjackBot = factory(root.BlackjackEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const trial = (s, a) => { const r = E.applyAction(s, a); return r.ok ? r.state : null; };
  const first = (s, a) => (trial(s, a) ? a : null);

  function betAction(s, me) {
    const p = s.players[me];
    // aposta ~5% das fichas, de 10 em 10, com um pouco de variação por rodada/assento
    let b = Math.floor((p.chips * (0.04 + ((s.round + me) % 4) * 0.02)) / 10) * 10;
    b = Math.max(E.RULES.minBet, Math.min(E.RULES.maxBet, b));
    let side = ((s.round * 7 + me * 3) % 5 === 0 && p.chips >= 400) ? 10 : 0;
    while (b + side > p.chips && b > E.RULES.minBet) b -= 10;
    if (b + side > p.chips) { b = 0; side = 0; }
    return { type: 'BET', player: me, bet: b, side };
  }

  function playAction(s, me) {
    const p = s.players[me], h = p.hands[s.turn.hand], o = E.options(s, me);
    const up = E.pval(s.dealer.cards[0]), sc = E.score(h.cards), t = sc.total;
    const upv = up === 11 ? 11 : up; // Ás = 11
    const A = (type) => ({ type, player: me });
    // pares
    if (o.split) {
      const r = h.cards[0].rank, v = E.pval(h.cards[0]);
      let sp = false;
      if (r === 'A' || r === '8') sp = true;
      else if (r === '9') sp = !(upv === 7 || upv >= 10);
      else if (v === 7 || v === 3 || v === 2) sp = upv <= 7;
      else if (r === '6') sp = upv <= 6;
      else if (r === '4') sp = upv === 5 || upv === 6;
      if (sp) return A('SPLIT');
    }
    // desistir
    if (o.surrender && !sc.soft) { if (t === 16 && (upv >= 9)) return A('SURRENDER'); if (t === 15 && upv === 10) return A('SURRENDER'); }
    if (sc.soft) {
      if (t >= 19) return A('STAND');
      if (t === 18) { if (upv >= 9) return A('HIT'); if (o.double && upv >= 3 && upv <= 6) return A('DOUBLE'); return A('STAND'); }
      if (o.double && upv >= 4 && upv <= 6 && t >= 15) return A('DOUBLE');
      if (o.double && upv >= 5 && upv <= 6) return A('DOUBLE');
      return A('HIT');
    }
    if (t >= 17) return A('STAND');
    if (t >= 13) return upv <= 6 ? A('STAND') : A('HIT');
    if (t === 12) return upv >= 4 && upv <= 6 ? A('STAND') : A('HIT');
    if (t === 11) return o.double && upv !== 11 ? A('DOUBLE') : A('HIT');
    if (t === 10) return o.double && upv <= 9 ? A('DOUBLE') : A('HIT');
    if (t === 9) return o.double && upv >= 3 && upv <= 6 ? A('DOUBLE') : A('HIT');
    return A('HIT');
  }

  function chooseAction(s, me) {
    if (!s || s.phase === 'ENDED') return null;
    let a = null;
    if (s.phase === 'BETTING') { if (!s.players[me].ready) a = s.players[me].absent ? { type: 'BET', player: me, bet: 0, side: 0 } : betAction(s, me); }
    else if (s.phase === 'INSURANCE') { const p = s.players[me]; if (p.bet > 0 && !p.insDecided) a = { type: 'INSURE', player: me, take: false }; }
    else if (s.phase === 'PLAYING' && s.turn && s.turn.seat === me) a = playAction(s, me);
    if (a && trial(s, a)) return a;
    // reserva
    const tries = [];
    if (s.phase === 'BETTING' && !s.players[me].ready) tries.push({ type: 'BET', player: me, bet: 0, side: 0 });
    if (s.phase === 'INSURANCE') tries.push({ type: 'INSURE', player: me, take: false });
    if (s.phase === 'PLAYING') tries.push({ type: 'STAND', player: me });
    for (const x of tries) if (trial(s, x)) return x;
    return null;
  }

  /** Ação pendente dos bots (assentos em `bots`), ou null. Se for rodada acabada, não faz nada (humanos tocam "Próxima rodada"). */
  function pendingAction(s, bots) {
    if (!s || s.phase === 'ENDED' || s.phase === 'ROUND_OVER') return null;
    const need = E.pending(s);
    for (const seat of need) if (bots.indexOf(seat) >= 0) { const a = chooseAction(s, seat); if (a) return a; }
    return null;
  }
  return { chooseAction, pendingAction };
});
