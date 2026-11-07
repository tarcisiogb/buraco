/* Faroeste — bots. Só usam o que um jogador veria: a própria mão e papel, o Xerife, equipamentos, vidas,
 * tamanho das mãos e papéis já revelados. Toda ação é validada no motor antes de ser devolvida. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.FaroesteBot = factory(root.FaroesteEngine);
})(typeof self !== 'undefined' ? self : this, function (FE) {
  'use strict';

  const VAL = { tonico: 9, errou: 8, tiro: 7, barril: 6, luneta: 5, cavalo: 4, diligencia: 6, carroca: 6, armazem: 5, taberna: 4, duelo: 5, rajada: 4, boiada: 4, assalto: 6, confisco: 5, cadeia: 5, dinamite: 1,
    rifle: 5, carabina: 4, pistolalonga: 3, canocurto: 2, repetidor: 2 };

  function trial(state, a) { const r = FE.applyAction(state, a); return r.ok ? r.state : null; }
  const alive = (s) => s.players.filter((p) => p.alive);
  const sheriffSeat = (s) => s.players.find((p) => p.role === 'xerife').seat;

  /** Quem feriu o Xerife / feriu a mim nas últimas jogadas (só eventos públicos) */
  function hostility(s, me) {
    const sh = sheriffSeat(s), vs = {}, vme = {};
    (s.log || []).forEach((e) => {
      if (e.type === 'DAMAGE' && e.source != null) {
        if (e.seat === sh) vs[e.source] = (vs[e.source] || 0) + 1;
        if (e.seat === me) vme[e.source] = (vme[e.source] || 0) + 1;
      }
    });
    return { vs, vme };
  }

  /** Peso de um alvo como inimigo (0 = não atacar) segundo o papel do bot */
  function weight(s, me, t, hostile) {
    const mp = s.players[me], tp = s.players[t], sh = sheriffSeat(s), n = alive(s).length;
    const hurtSheriff = hostile.vs[t] || 0, hurtMe = hostile.vme[t] || 0;
    let w;
    switch (mp.role) {
      case 'xerife': w = 1 + hurtMe * 2 + hurtSheriff * 2; break;
      case 'ajudante': w = t === sh ? 0 : 1 + hurtSheriff * 3 + hurtMe * 1.5; break;
      case 'bandido': w = t === sh ? 6 : 0.5 + hurtMe * 2; if (t !== sh && hurtSheriff) w *= 0.3; break;
      default: // renegado
        if (n === 2) w = 8;
        else if (t === sh) w = n >= 4 ? 0.2 : 1.5;
        else w = 1.2 + hurtMe;
    }
    if (tp.role && tp.role === mp.role && mp.role !== 'xerife' && mp.role !== 'renegado') w = 0; // revelado e do mesmo time
    return w * (1 + (tp.maxHp - Math.max(1, tp.hp)) * 0.15);
  }
  function targetsOrdered(s, me, hostile, filter) {
    const out = [];
    s.players.forEach((p) => { if (p.alive && p.seat !== me && (!filter || filter(p))) { const w = weight(s, me, p.seat, hostile); if (w > 0) out.push({ seat: p.seat, w }); } });
    return out.sort((a, b) => b.w - a.w);
  }

  const cardScore = (c, p) => {
    let v = VAL[c.kind] || 3;
    if (FE.KINDS[c.kind].t === 'azul' && p.equip.some((e) => e.kind === c.kind)) v = 0.5; // repetida: injogável
    return v;
  };

  // ───────── decisões ─────────
  function respond(s, me) {
    const p = s.players[me], top = s.stack[s.stack.length - 1];
    if (top.type === 'volley') {
      const want = top.kind === 'boiada' ? 'tiro' : 'errou';
      const cards = p.hand.filter((c) => c.kind === want || (p.char === 'valeria' && (c.kind === 'tiro' || c.kind === 'errou')));
      const tiros = p.hand.filter((c) => c.kind === 'tiro').length;
      if (top.kind === 'boiada' && !(p.hp <= 2 || tiros >= 2)) return { type: 'RESPOND', player: me, pass: true };
      if (cards.length >= (top.need || 1) || (cards.length && top.need > 1)) return { type: 'RESPOND', player: me, cardId: cards[0].id };
      return { type: 'RESPOND', player: me, pass: true };
    }
    if (top.type === 'duel') {
      const c = p.hand.find((x) => x.kind === 'tiro') || (p.char === 'valeria' ? p.hand.find((x) => x.kind === 'errou') : null);
      return c ? { type: 'RESPOND', player: me, cardId: c.id } : { type: 'RESPOND', player: me, pass: true };
    }
    if (top.type === 'dying') {
      const t = p.hand.find((x) => x.kind === 'tonico');
      if (t) return { type: 'RESPOND', player: me, cardId: t.id };
      if (p.char === 'sid' && p.hand.length >= 2) {
        const w = p.hand.slice().sort((a, b) => cardScore(a, p) - cardScore(b, p)).slice(0, 2);
        return { type: 'HEAL_DISCARD', player: me, cardIds: w.map((x) => x.id) };
      }
      return { type: 'RESPOND', player: me, pass: true };
    }
    if (top.type === 'store') {
      const best = top.cards.slice().sort((a, b) => cardScore(b, p) - cardScore(a, p))[0];
      return { type: 'RESPOND', player: me, cardId: best.id };
    }
    if (top.type === 'pepe') {
      const w = top.cards.slice().sort((a, b) => cardScore(b, p) - cardScore(a, p)).slice(0, 2);
      return { type: 'PICK', player: me, cardIds: w.map((x) => x.id) };
    }
    return null;
  }

  function drawChoice(s, me) {
    const p = s.players[me], hostile = hostility(s, me);
    if (p.char === 'pedrao' && s.discard.length) {
      const top = s.discard[s.discard.length - 1];
      if (['tonico', 'errou', 'tiro', 'barril', 'diligencia', 'carroca', 'rifle'].indexOf(top.kind) >= 0 && cardScore(top, p) >= 5) return { type: 'DRAW', player: me, source: 'discard' };
    }
    if (p.char === 'caca') {
      const t = targetsOrdered(s, me, hostile, (q) => q.hand.length > 0)[0];
      if (t) return { type: 'DRAW', player: me, source: 'hand', target: t.seat };
    }
    return { type: 'DRAW', player: me };
  }

  function playStage(s, me) {
    const p = s.players[me], hostile = hostility(s, me), n = alive(s).length, hand = p.hand;
    const has = (k) => hand.find((c) => c.kind === k);
    const ok = (a) => trial(s, a) ? a : null;
    const play = (c, extra) => ok(Object.assign({ type: 'PLAY', player: me, cardId: c.id }, extra || {}));
    // 1) cura
    const tonic = has('tonico');
    if (tonic && p.hp < p.maxHp && n > 2 && (p.hp <= p.maxHp - 1)) { const a = play(tonic); if (a) return a; }
    if (p.char === 'sid' && p.hp < p.maxHp && hand.length >= 4) {
      const w = hand.slice().sort((a, b) => cardScore(a, p) - cardScore(b, p)).slice(0, 2);
      const a = ok({ type: 'HEAL_DISCARD', player: me, cardIds: w.map((x) => x.id) }); if (a) return a;
    }
    // 2) equipar
    for (const k of ['barril', 'luneta', 'cavalo']) { const c = has(k); if (c && !p.equip.some((e) => e.kind === k)) { const a = play(c); if (a) return a; } }
    const cur = FE.range(p);
    const weapons = hand.filter((c) => FE.KINDS[c.kind].w && FE.KINDS[c.kind].w > cur).sort((a, b) => FE.KINDS[b.kind].w - FE.KINDS[a.kind].w);
    if (weapons.length) { const a = play(weapons[0]); if (a) return a; }
    // 3) comprar cartas
    for (const k of ['carroca', 'diligencia', 'armazem']) { const c = has(k); if (c) { const a = play(c); if (a) return a; } }
    const tab = has('taberna');
    if (tab && (p.hp < p.maxHp || s.players.some((q) => q.alive && q.seat !== me && q.hp < q.maxHp && q.role === 'xerife' && p.role !== 'bandido'))) { const a = play(tab); if (a) return a; }
    // 4) Cadeia em inimigo
    const jail = has('cadeia');
    if (jail) for (const t of targetsOrdered(s, me, hostile, (q) => q.role !== 'xerife')) { if (t.w >= 0.8) { const a = play(jail, { target: t.seat }); if (a) return a; } }
    // 5) Tiro no melhor alvo ao alcance
    const shots = hand.filter((c) => c.kind === 'tiro');
    if (shots.length) for (const t of targetsOrdered(s, me, hostile)) { if (t.w >= 0.4) { const a = play(shots[0], { target: t.seat }); if (a) return a; } }
    if (p.char === 'valeria') { const e = has('errou'); if (e && hand.filter((c) => c.kind === 'errou').length >= 2) for (const t of targetsOrdered(s, me, hostile)) { const a = play(e, { target: t.seat, as: 'tiro' }); if (a) return a; } }
    // 6) Assalto / Confisco
    for (const k of ['assalto', 'confisco']) {
      const c = has(k); if (!c) continue;
      for (const t of targetsOrdered(s, me, hostile)) {
        const tp = s.players[t.seat], eq = tp.equip.find((e) => e.kind === 'barril') || tp.equip.find((e) => FE.KINDS[e.kind].w) || tp.equip[0];
        const a = (eq && t.w >= 0.8 && k === 'assalto') ? play(c, { target: t.seat, targetCardId: eq.id }) : (tp.hand.length ? play(c, { target: t.seat }) : null);
        if (a) return a;
      }
    }
    // 7) Duelo com folga de Tiros
    const duel = has('duelo');
    if (duel && shots.length >= 2) for (const t of targetsOrdered(s, me, hostile)) { if (t.w >= 1 && s.players[t.seat].hand.length <= shots.length + 1) { const a = play(duel, { target: t.seat }); if (a) return a; } }
    // 8) Rajada / Boiada se sobra carta (e não machuca o time sabido)
    for (const k of ['rajada', 'boiada']) {
      const c = has(k); if (!c) continue;
      const risky = p.role === 'ajudante' || p.role === 'xerife' ? p.hp <= 2 : false;
      if (!risky && hand.length > p.hp) { const a = play(c); if (a) return a; }
    }
    // 9) Dinamite: só joga se for bandido/renegado... geralmente é melhor descartar
    // 10) descartar o excesso
    if (hand.length > p.hp) {
      const sorted = hand.slice().sort((a, b) => cardScore(a, p) - cardScore(b, p));
      for (const c of sorted) { const a = ok({ type: 'DISCARD', player: me, cardId: c.id }); if (a) return a; }
    }
    return { type: 'END_TURN', player: me };
  }

  function chooseAction(s, me) {
    if (s.phase === 'GAME_OVER' || FE.whoMustAct(s) !== me) return null;
    const p = s.players[me];
    let a = null;
    if (s.stack.length) a = respond(s, me);
    else if (s.turn.stage === 'draw') a = drawChoice(s, me);
    else a = playStage(s, me);
    if (a && trial(s, a)) return a;
    // reserva: qualquer ação válida
    const tries = [];
    if (s.stack.length) { tries.push({ type: 'RESPOND', player: me, pass: true }); p.hand.forEach((c) => tries.push({ type: 'RESPOND', player: me, cardId: c.id })); }
    else if (s.turn.stage === 'draw') tries.push({ type: 'DRAW', player: me });
    else { p.hand.forEach((c) => tries.push({ type: 'DISCARD', player: me, cardId: c.id })); tries.unshift({ type: 'END_TURN', player: me }); }
    for (const t of tries) if (trial(s, t)) return t;
    return null;
  }

  /** Ação pendente dos bots (assentos em `bots`), ou null */
  function pendingAction(s, bots) {
    if (!s || s.phase === 'GAME_OVER') return null;
    const who = FE.whoMustAct(s);
    if (who == null || bots.indexOf(who) < 0) return null;
    return chooseAction(s, who);
  }

  return { chooseAction, pendingAction };
});
