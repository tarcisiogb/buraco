const FE = require('./faroeste-engine.js'), Bot = require('./faroeste-bot.js')(FE);
let ok = 0, bad = 0; const t = (n, f) => { try { f(); ok++; console.log('ok  ' + n); } catch (e) { bad++; console.log('ERRO ' + n + ': ' + e.message); } };
function playGame(n, seed) {
  let s = FE.createGame({ players: Array.from({ length: n }, (_, i) => ({ id: 'bot:' + i, name: 'B' + i })), seed }), steps = 0, turns = 0;
  const bots = s.players.map((p) => p.seat);
  while (s.phase !== 'GAME_OVER' && steps++ < 6000) {
    const a = Bot.pendingAction(s, bots);
    if (!a) throw new Error('bot sem ação (seed ' + seed + ', n ' + n + ')');
    const r = FE.applyAction(s, a); if (!r.ok) throw new Error('ação inválida ' + JSON.stringify(a) + ' ' + r.error);
    if (a.type === 'END_TURN') turns++; s = r.state;
  }
  if (s.phase !== 'GAME_OVER') throw new Error('não terminou (seed ' + seed + ', n ' + n + ')');
  return { s, turns };
}
t('bots terminam partidas de 4 a 7 jogadores sem erro', () => {
  const win = {}, tr = []; let games = 0;
  for (let n = 4; n <= 7; n++) for (let seed = 1; seed <= 25; seed++) { const g = playGame(n, seed * 31 + n); win[g.s.winner] = (win[g.s.winner] || 0) + 1; tr.push(g.turns); games++; }
  tr.sort((a, b) => a - b);
  console.log('   vitórias', JSON.stringify(win), '· turnos (mediana)', tr[tr.length >> 1], 'máx', tr[tr.length - 1]);
  if (!win.xerife || !win.bandidos) throw new Error('um dos lados nunca vence');
});
t('bot responde a Tiro com Errou quando tem', () => {
  const s = FE.createGame({ players: [0, 1, 2, 3].map((i) => ({ id: 'b' + i, name: 'B' + i })), seed: 5 });
  const sh = s.players.find((p) => p.role === 'xerife').seat, tg = (sh + 1) % 4;
  s.turn = { player: sh, stage: 'play', bangs: 0, drew: true, over: false };
  s.players[sh].hand = [{ id: 'z1', kind: 'tiro', suit: 'C', value: 5 }];
  s.players[tg].hand = [{ id: 'z2', kind: 'errou', suit: 'D', value: 3 }]; s.players[tg].equip = []; s.players[sh].equip = [];
  s.stack = [{ type: 'volley', kind: 'tiro', source: sh, queue: [], cur: tg, need: 1 }];
  const a = Bot.chooseAction(s, tg); if (a.type !== 'RESPOND' || a.cardId !== 'z2') throw new Error(JSON.stringify(a));
});
t('Ajudante não atira no Xerife', () => {
  const s = FE.createGame({ players: [0, 1, 2, 3, 4].map((i) => ({ id: 'b' + i, name: 'B' + i })), seed: 9 });
  const aj = s.players.find((p) => p.role === 'ajudante').seat, sh = s.players.find((p) => p.role === 'xerife').seat;
  s.turn = { player: aj, stage: 'play', bangs: 0, drew: true, over: false };
  s.players[aj].hand = [{ id: 'z1', kind: 'tiro', suit: 'C', value: 5 }]; s.players[aj].equip = [{ id: 'w', kind: 'rifle', suit: 'C', value: 2 }];
  for (let i = 0; i < 20; i++) { const a = Bot.chooseAction(s, aj); if (a.type === 'PLAY' && a.target === sh) throw new Error('atirou no Xerife'); }
});
console.log(ok + ' passaram, ' + bad + ' falharam'); process.exit(bad ? 1 : 0);
