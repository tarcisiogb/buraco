/*
 * Buraco Aberto — Bot (nível 2)
 * UMD: window.BuracoBot / require('./buraco-bot.js')(Engine)
 *
 * O bot só olha o que um humano veria: a própria mão, os jogos da mesa, o lixo
 * e as contagens. Toda jogada é conferida no motor (applyAction num clone) antes
 * de ser escolhida, então o bot nunca envia uma ação inválida e nunca trava:
 * se nada der certo, cai num plano de reserva (comprar e descartar qualquer carta válida).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.BuracoBot = factory(root.BuracoEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const teamOf = (i) => (i % 2 === 0 ? 'A' : 'B');
  const posOf = (rank) => (rank === 'A' ? [1, 14] : [{ '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 }[rank]]);
  const wildCount = (entries) => entries.filter((e) => e.wild).length;

  /** Simula a ação num clone; devolve o novo estado ou null se o motor recusar */
  function trial(state, action) {
    const r = E.applyAction(state, action, state.turn.deadline != null ? state.turn.deadline - 1 : Date.now());
    return r.ok ? r.state : null;
  }

  function hasCleanCanastra(team) {
    return team.melds.some((m) => { const i = E.meldInfo(m); return i.isCanastra && i.clean; });
  }

  // ───────────── Compra ─────────────

  function chooseDraw(state, me) {
    const team = state.teams[teamOf(me)];
    const canStock = state.stock.length > 0, canDisc = state.discard.length > 0;
    if (!canStock && !canDisc) return null;
    if (!canStock) return { type: 'DRAW_DISCARD', player: me };
    if (!canDisc) return { type: 'DRAW_STOCK', player: me };
    if (E.topCardUsable(state, me)) return { type: 'DRAW_DISCARD', player: me };
    // lixo: levar quando as cartas dele ajudam (encaixam nos jogos ou combinam com a mão)
    const hand = state.players[me].hand, pile = state.discard, top = pile[pile.length - 1];
    let useful = 0;
    for (const c of pile) {
      if (team.melds.some((m) => E.findAddLayouts(m, c).length)) { useful += 2; continue; }
      let adj = 0, gap = 0;
      for (const h of hand) if (h.suit === c.suit) { if (near(h, c, 1)) adj++; else if (near(h, c, 2)) gap++; }
      useful += Math.min(2, adj) * 1 + Math.min(2, gap) * 0.4;
      if (!adj && !gap && pile.some((o) => o.id !== c.id && o.suit === c.suit && near(o, c, 1))) useful += 0.4;
    }
    if (top) { // a carta de cima pesa mais: é a que dá para usar já
      let adjTop = 0; for (const h of hand) if (h.suit === top.suit && near(h, top, 1)) adjTop++;
      useful += adjTop * 0.5;
    }
    const mine = team.mortoTaken, other = state.teams[teamOf((me + 1) % 4)];
    const behind = state.scores[teamOf((me + 1) % 4)] - state.scores[teamOf(me)] >= 200;
    const aggr = (mine ? 0 : 1) + (behind ? 1 : 0) + (other.melds.length > team.melds.length + 2 ? 1 : 0);
    const need = Math.max(1, (pile.length >= 8 ? 1.5 : pile.length >= 4 ? 2 : 2.5) - 0.6 * aggr);
    if (useful >= need) return { type: 'DRAW_DISCARD', player: me };
    if (pile.length >= 7) return { type: 'DRAW_DISCARD', player: me };
    return { type: 'DRAW_STOCK', player: me };
  }

  function near(a, b, d) {
    for (const x of posOf(a.rank)) for (const y of posOf(b.rank)) if (Math.abs(x - y) <= d && !(x === y && a.rank === b.rank && a.suit === b.suit && a.id === b.id)) return true;
    return false;
  }

  // ───────────── Jogadas na mesa ─────────────

  /** Coringa só para bater (ou, no fim do monte, para não ficar preso com pontos na mão) */
  function wildOk(state, me, newSize, action) {
    if (state.stock.length <= 2 && newSize <= 5) return true; // último recurso no fim do monte: livra pontos sem sujar canastra
    const ts = trial(state, action);
    return !!(ts && ts.phase === 'ROUND_OVER' && ts.roundResult && ts.roundResult.reason === 'BATIDA');
  }

  /** Cartas da mão que encaixam num jogo da dupla, sem gastar coringa à toa */
  function bestAdd(state, me) {
    const p = state.players[me], team = state.teams[teamOf(me)];
    let best = null;
    for (const meld of team.melds) {
      const size = meld.cards.length, before = wildCount(meld.cards);
      for (const c of p.hand) {
        const lays = E.findAddLayouts(meld, c);
        if (!lays.length) continue;
        let oi = 0;
        lays.forEach((l, i) => { if (wildCount(l.entries) < wildCount(lays[oi].entries)) oi = i; });
        const lay = lays[oi], used = wildCount(lay.entries) - before; // coringas a mais
        if (used > 0 && !wildOk(state, me, size + 1, { type: 'ADD_TO_MELD', player: me, meldId: meld.id, cardId: c.id, option: oi })) continue;
        // prioridade: jogos grandes (rumo à canastra), sem gastar coringa
        const score = size * 2 - used * 20 + (size + 1 === 7 ? 6 : 0) + (c.rank === '2' ? -3 : 0);
        if (!best || score > best.score) best = { score, action: { type: 'ADD_TO_MELD', player: me, meldId: meld.id, cardId: c.id, option: oi } };
      }
    }
    return best ? best.action : null;
  }

  /** Sequências naturais na mão (3+ cartas do mesmo naipe em posições seguidas) */
  function runCandidates(hand) {
    const out = [];
    for (const suit of E.SUITS) {
      const byPos = {};
      for (const c of hand) {
        if (c.suit !== suit) continue;
        for (const pos of posOf(c.rank)) (byPos[pos] = byPos[pos] || []).push(c);
      }
      let start = null;
      for (let pos = 1; pos <= 15; pos++) {
        if (byPos[pos]) { if (start === null) start = pos; continue; }
        if (start !== null) {
          const end = pos - 1;
          if (end - start + 1 >= 3) out.push(buildRun(byPos, start, end));
          start = null;
        }
      }
    }
    return out.filter((r) => r);
  }

  function buildRun(byPos, start, end) {
    const used = new Set(), ids = [];
    for (let pos = start; pos <= end; pos++) {
      const c = (byPos[pos] || []).find((x) => !used.has(x.id));
      if (!c) return null;
      used.add(c.id); ids.push(c.id);
    }
    return ids;
  }

  /** Jogo novo do mesmo naipe e perto de um jogo da dupla: espera a carta que falta, a não ser para bater/abrir/fim do monte */
  function splitsOwnMeld(state, me, ids) {
    const hand = state.players[me].hand, tm = state.teams[teamOf(me)];
    if (hand.length - ids.length <= 1 || state.stock.length <= 2 || (tm.vulnerable && !tm.opened)) return false;
    const cards = ids.map((id) => hand.find((c) => c.id === id));
    for (const m of tm.melds) for (const mc of m.cards) {
      if (mc.rank === '2') continue;
      for (const c of cards) if (c.suit === mc.suit && c.rank !== '2' && near(c, mc, 3)) return true;
    }
    return false;
  }

  function bestLay(state, me) {
    const hand = state.players[me].hand;
    const cands = [];
    for (const run of runCandidates(hand)) {
      // do maior para o menor (pontas), para sobrar carta e respeitar a regra da última carta
      for (let len = run.length; len >= 3; len--) {
        cands.push(run.slice(0, len));
        if (len > 3) cands.push(run.slice(run.length - len));
      }
    }
    // com um coringa (2) cobrindo um buraco — só se a mão estiver cheia
    if (hand.length <= 6 || state.stock.length <= 2) {
      const twos = hand.filter((c) => c.rank === '2');
      if (twos.length) {
        for (const a of hand) for (const b of hand) {
          if (a.id >= b.id || a.suit !== b.suit || a.rank === '2' || b.rank === '2') continue;
          if (near(a, b, 2)) cands.push([a.id, b.id, twos[0].id]);
        }
      }
    }
    const tm0 = state.teams[teamOf(me)], vul = tm0.vulnerable && !tm0.opened;
    const pts = (ids) => ids.reduce((a, id) => a + E.cardPoints(hand.find((c) => c.id === id)), 0);
    cands.sort((x, y) => vul ? (pts(y) - pts(x)) : (y.length - x.length));
    for (const ids of cands) {
      const opts = E.getMeldOptions(state, me, ids);
      if (!opts.length) continue;
      let oi = 0;
      opts.forEach((l, i) => { if (wildCount(l.entries) < wildCount(opts[oi].entries)) oi = i; });
      if (splitsOwnMeld(state, me, ids)) continue;
      const action = { type: 'LAY_MELD', player: me, cardIds: ids, option: oi };
      if (wildCount(opts[oi].entries) > 0 && !wildOk(state, me, ids.length, action)) continue;
      if (trial(state, action)) return action;
    }
    return null;
  }

  // ───────────── Descarte ─────────────

  function chooseDiscards(state, me) {
    const p = state.players[me], myTeam = state.teams[teamOf(me)], oppTeam = state.teams[teamOf((me + 1) % 4)];
    const scored = p.hand.map((c) => {
      let keep = E.cardPoints(c) * 0.08;
      if (c.rank === '2') keep += 7;
      if (c.rank === 'A') keep += 1;
      for (const o of p.hand) {
        if (o.id === c.id || o.suit !== c.suit) continue;
        if (o.rank === c.rank) { keep += 0.6; continue; }
        if (near(o, c, 1)) keep += 3.2; else if (near(o, c, 2)) keep += 1.6;
      }
      if (myTeam.melds.some((m) => E.findAddLayouts(m, c).length)) keep += 10;
      if (oppTeam.melds.some((m) => E.findAddLayouts(m, c).length)) keep += 5; // não "alimentar" o adversário
      return { c, keep };
    });
    scored.sort((a, b) => a.keep - b.keep || b.c.id - a.c.id);
    return scored.map((s) => s.c);
  }

  // ───────────── Escolha da ação ─────────────

  /** Próxima jogada na mesa (encaixar carta ou baixar jogo), ou null */
  /** Trava final: nenhuma jogada pode aumentar o número de coringas nos jogos da dupla, a não ser para bater */
  function addsWild(state, me, a) {
    if (!a || (a.type !== 'ADD_TO_MELD' && a.type !== 'LAY_MELD')) return false;
    const ts = trial(state, a); if (!ts) return false;
    const cnt = (st) => st.teams[teamOf(me)].melds.reduce((n, m) => n + wildCount(m.cards), 0);
    if (cnt(ts) <= cnt(state)) return false;
    if (ts.phase === 'ROUND_OVER' && ts.roundResult && ts.roundResult.reason === 'BATIDA') return false;
    if (state.stock.length <= 2 && (a.type === 'LAY_MELD' ? a.cardIds.length : 99) <= 5) return false;
    return true;
  }
  function tableAction(state, me) {
    const t0 = tableAction0(state, me);
    return addsWild(state, me, t0) ? null : t0;
  }
  function tableAction0(state, me) {
    const add = bestAdd(state, me);
    if (add && trial(state, add)) return add;
    const lay = bestLay(state, me);
    if (lay) return lay;
    const team = state.teams[teamOf(me)];
    for (const meld of team.melds) for (const c of state.players[me].hand) {
      const lays = E.findAddLayouts(meld, c);
      if (!lays.length) continue;
      let oi = 0;
      lays.forEach((l, i) => { if (wildCount(l.entries) < wildCount(lays[oi].entries)) oi = i; });
      const a = { type: 'ADD_TO_MELD', player: me, meldId: meld.id, cardId: c.id, option: oi };
      if (wildCount(lays[oi].entries) > wildCount(meld.cards) && !wildOk(state, me, meld.cards.length + 1, a)) continue;
      if (trial(state, a)) return a;
    }
    return null;
  }

  /** Dupla vulnerável: simula as descidas e vê se chega aos pontos mínimos neste turno */
  function canOpen(state, me) {
    let sim = state;
    for (let i = 0; i < 14 && sim; i++) {
      if (sim.teams[teamOf(me)].opened) return true;
      const a = tableAction(sim, me);
      if (!a) return false;
      sim = trial(sim, a);
    }
    return !!(sim && sim.teams[teamOf(me)].opened);
  }

  /** Próxima ação do bot sentado em `me` (vez dele). Retorna null se não for a vez. */
  function chooseAction(state, me) {
    if (state.paused || state.turn.player !== me) return null;
    if (state.phase === 'WAITING_TURN') {
      const draw = chooseDraw(state, me);
      if (draw && trial(state, draw)) return draw;
      for (const t of ['DRAW_STOCK', 'DRAW_DISCARD']) { const a = { type: t, player: me }; if (trial(state, a)) return a; }
      return null;
    }
    if (state.phase !== 'PLAYING') return null;
    const tm = state.teams[teamOf(me)];
    const vulnerable = tm.vulnerable && !tm.opened;
    // dupla vulnerável: só começa a descer se der para chegar nos pontos mínimos
    if (!(vulnerable && !state.opening && !canOpen(state, me))) {
      const t = tableAction(state, me);
      if (t) return t;
      if (state.opening) return { type: 'UNDO_OPENING', player: me };
    }
    for (const c of chooseDiscards(state, me)) {
      const a = { type: 'DISCARD', player: me, cardId: c.id };
      if (trial(state, a)) return a;
    }
    // reserva: qualquer ação válida
    for (const c of state.players[me].hand) {
      const a = { type: 'DISCARD', player: me, cardId: c.id };
      if (trial(state, a)) return a;
    }
    return null;
  }

  /**
   * Ação pendente dos bots: `bots` = lista de assentos (0..3) controlados por bot.
   * Votos de encerramento (sempre "sim") e a vez de jogar. null se nada a fazer.
   */
  function pendingAction(state, bots) {
    if (!state || state.paused || state.phase === 'GAME_OVER') return null;
    if (state.endVote) {
      for (const b of bots) if (!state.endVote.yes.includes(b)) return { type: 'VOTE_END', player: b, yes: true };
    }
    if (state.phase === 'WAITING_TURN' || state.phase === 'PLAYING') {
      if (bots.includes(state.turn.player)) return chooseAction(state, state.turn.player);
    }
    return null;
  }

  return { chooseAction, pendingAction, chooseDiscards };
});
