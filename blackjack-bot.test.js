const E = require('./blackjack-engine.js'), B = require('./blackjack-bot.js')(E);
let ok = 0, bad = 0;
function t(n, f) { try { f(); ok++; console.log('ok  ' + n); } catch (e) { bad++; console.log('FALHOU ' + n + ': ' + e.message); } }
t('6 bots jogam 300 rodadas sem travar e com fichas íntegras', () => {
  let s = E.createGame({ players: Array.from({ length: 6 }, (_, i) => ({ id: 'bot:' + i, name: 'B' + i })), seed: 11 });
  const bots = [0, 1, 2, 3, 4, 5]; let steps = 0, rounds = 0;
  while (rounds < 300) {
    if (s.phase === 'ROUND_OVER') { s = E.applyAction(s, { type: 'NEXT_ROUND', player: 0 }).state; rounds++; continue; }
    const a = B.pendingAction(s, bots); if (!a) throw new Error('travou em ' + s.phase);
    const r = E.applyAction(s, a); if (!r.ok) throw new Error(r.error); s = r.state;
    if (++steps > 100000) throw new Error('loop');
    s.players.forEach((p) => { if (p.chips < 0 || !Number.isInteger(p.chips)) throw new Error('fichas ' + p.chips); });
  }
});
t('estratégia básica: ~ perda pequena da banca (não é suicida)', () => {
  let s = E.createGame({ players: [{ id: 'bot:0', name: 'B' }], seed: 5 }); let net = 0, bets = 0;
  for (let r = 0; r < 4000; r++) {
    s.players[0].chips = 100000;
    let a;
    s = E.applyAction(s, { type: 'BET', player: 0, bet: 100, side: 0 }).state; bets += 100;
    const c0 = s.players[0].chipsStart;
    while (s.phase !== 'ROUND_OVER') { a = B.pendingAction(s, [0]); s = E.applyAction(s, a).state; }
    net += s.players[0].chips - c0;
    s = E.applyAction(s, { type: 'NEXT_ROUND', player: 0 }).state;
  }
  const edge = net / bets; console.log('   vantagem observada:', (edge * 100).toFixed(2) + '%');
  if (edge < -0.06) throw new Error('bot perde demais: ' + edge);
});
t('bot aposta dentro dos limites', () => {
  const s = E.createGame({ players: [{ id: 'bot:0', name: 'B' }], seed: 1 }); const a = B.chooseAction(s, 0);
  if (a.type !== 'BET' || a.bet < 10 || a.bet > 500 || a.bet % 10) throw new Error(JSON.stringify(a));
});
console.log(ok + ' passaram, ' + bad + ' falharam'); process.exit(bad ? 1 : 0);
