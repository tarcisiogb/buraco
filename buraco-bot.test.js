const assert = require('assert');
const E = require('./buraco-engine.js');
const Bot = require('./buraco-bot.js')(E);
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('ok  ' + name); } catch (e) { console.log('FALHOU ' + name + '\n' + e.stack); process.exitCode = 1; } }

function play(seed, bots, target, maxRounds) {
  let s = E.createGame({ seed, targetScore: target });
  let steps = 0, rounds = 1, stats = { batida: 0, stock: 0, canastras: 0 };
  while (s.phase !== 'GAME_OVER' && steps++ < 20000) {
    if (s.phase === 'ROUND_OVER') {
      if (s.roundResult.reason === 'BATIDA') stats.batida++; else stats.stock++;
      if (++rounds > maxRounds) return { s, steps, rounds, stats, capped: true };
      s = E.applyAction(s, { type: 'START_NEXT_ROUND', player: 0 }).state; continue;
    }
    const a = Bot.pendingAction(s, bots);
    assert(a, `bot sem ação: seed ${seed} fase ${s.phase} vez ${s.turn.player} mão ${s.players[s.turn.player].hand.length}`);
    const r = E.applyAction(s, a);
    assert(r.ok, `ação recusada ${JSON.stringify(a)}: ${r.error && r.error.message}`);
    s = r.state;
  }
  assert(steps < 20000, 'partida não terminou: seed ' + seed);
  return { s, steps, rounds, stats };
}

t('40 partidas bot x bot (meta 1500) terminam sem travar', () => {
  let tot = { batida: 0, stock: 0 }, rds = 0, wins = { A: 0, B: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const r = play(seed, [0, 1, 2, 3], 1500, 60);
    assert(!r.capped, 'muitas rodadas: seed ' + seed);
    tot.batida += r.stats.batida; tot.stock += r.stats.stock; rds += r.rounds; wins[r.s.winner]++;
  }
  console.log('   rodadas/partida', (rds / 40).toFixed(1), 'batidas', tot.batida, 'monte acabou', tot.stock, 'vitórias', JSON.stringify(wins));
});

t('rodada bot x bot: bate com frequência razoável', () => {
  let bat = 0, tot = 0;
  for (let seed = 100; seed < 160; seed++) {
    let s = E.createGame({ seed }); let st = 0;
    while (s.phase !== 'ROUND_OVER' && st++ < 3000) s = E.applyAction(s, Bot.pendingAction(s, [0,1,2,3])).state;
    assert(s.phase === 'ROUND_OVER');
    tot++; if (s.roundResult.reason === 'BATIDA') bat++;
  }
  console.log('   batidas', bat, '/', tot);
});

t('bots votam sim no encerramento; pausa congela o bot', () => {
  let s = E.createGame({ seed: 5 });
  s = E.applyAction(s, { type: 'PROPOSE_END', player: 0 }).state;
  let a = Bot.pendingAction(s, [1, 2, 3]); assert.strictEqual(a.type, 'VOTE_END');
  for (let i = 0; i < 3; i++) { a = Bot.pendingAction(s, [1, 2, 3]); s = E.applyAction(s, a).state; }
  assert.strictEqual(s.phase, 'GAME_OVER'); assert.strictEqual(s.winner, null);
  let p = E.createGame({ seed: 5 }); p = E.applyAction(p, { type: 'PAUSE', player: 1 }).state;
  assert.strictEqual(Bot.pendingAction(p, [0]), null);
});

t('humano + 3 bots: bots só agem nos seus assentos', () => {
  let s = E.createGame({ seed: 9 }), acted = new Set(), st = 0;
  while (s.turn.player !== 0 && st++ < 50) { const a = Bot.pendingAction(s, [1, 2, 3]); acted.add(a.player); s = E.applyAction(s, a).state; }
  assert(!acted.has(0)); assert.strictEqual(Bot.pendingAction(s, [1, 2, 3]), null);
});
console.log(n + ' passaram');
