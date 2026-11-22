const E = require('./blackjack-engine.js');
let ok = 0, bad = 0;
function t(name, fn) { try { fn(); ok++; console.log('ok  ' + name); } catch (e) { bad++; console.log('FALHOU ' + name + ': ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' esperado ' + JSON.stringify(b) + ' veio ' + JSON.stringify(a)); }
const C = (s) => { // "AS" "10H" "KD"
  const suit = s.slice(-1), rank = s.slice(0, -1); return { id: 'x' + Math.random(), rank, suit };
};
// ordem de saque: p0c1, banca-up, p1c1, ... (1ª rodada de cartas), depois 2ª rodada, depois extras
function rig(state, order) { const filler = []; for (let i = 0; i < 60; i++) filler.push(C('2C')); state.shoe = filler.concat(order.slice().reverse().map(C)); return state; }
function game(n, order) { let s = E.createGame({ players: Array.from({ length: n }, (_, i) => ({ id: 'u' + i, name: 'J' + i })), seed: 7 }); if (order) rig(s, order); return s; }
const A = (s, a) => { const r = E.applyAction(s, a); if (!r.ok) throw new Error('rejeitada: ' + r.error); return r.state; };
const bet = (s, seat, b, side) => A(s, { type: 'BET', player: seat, bet: b, side: side || 0 });

t('pontuação com Ases', () => {
  eq(E.score([C('AS'), C('KD')]).total, 21);
  eq(E.score([C('AS'), C('AD'), C('9C')]).total, 21);
  eq(E.score([C('AS'), C('6D')]).soft, true);
  eq(E.score([C('KS'), C('6D'), C('9H')]).total, 25);
});
t('baralho de 6 e embaralhamento determinístico', () => {
  const a = game(1), b = game(1); eq(a.shoe.length, 312); eq(a.shoe.map((c) => c.rank + c.suit), b.shoe.map((c) => c.rank + c.suit));
});
t('apostas inválidas e só deal quando todos apostam', () => {
  let s = game(2);
  eq(E.applyAction(s, { type: 'BET', player: 0, bet: 15 }).ok, false);
  eq(E.applyAction(s, { type: 'BET', player: 0, bet: 600 }).ok, false);
  eq(E.applyAction(s, { type: 'BET', player: 0, bet: 0, side: 10 }).ok, false);
  s = bet(s, 0, 100); eq(s.phase, 'BETTING'); s = bet(s, 1, 50); eq(s.phase !== 'BETTING', true);
});
t('vitória simples paga 1:1', () => {
  // p0: 10,9 (19); banca: 10,7 (17)
  let s = game(1, ['10S', '10H', '9S', '7H']); s = bet(s, 0, 100); eq(s.phase, 'PLAYING');
  s = A(s, { type: 'STAND', player: 0 }); eq(s.phase, 'ROUND_OVER'); eq(s.players[0].chips, 1100); eq(s.players[0].hands[0].result, 'win');
});
t('Blackjack natural paga 3:2', () => {
  let s = game(1, ['AS', '9H', 'KS', '7H']); s = bet(s, 0, 100); eq(s.phase, 'ROUND_OVER'); eq(s.players[0].chips, 1150); eq(s.players[0].hands[0].result, 'blackjack');
});
t('banca com Blackjack (10 aparente): jogador perde sem jogar', () => {
  let s = game(1, ['10S', 'KH', '9S', 'AH']); s = bet(s, 0, 100); eq(s.phase, 'ROUND_OVER'); eq(s.players[0].chips, 900);
});
t('empate em Blackjack devolve a aposta', () => {
  let s = game(1, ['AS', 'KH', 'KS', 'AH']); s = bet(s, 0, 100); eq(s.phase, 'ROUND_OVER'); eq(s.players[0].chips, 1000); eq(s.players[0].hands[0].result, 'push');
});
t('seguro: banca com Ás e Blackjack paga 2:1', () => {
  let s = game(1, ['10S', 'AH', '9S', 'KH']); s = bet(s, 0, 100); eq(s.phase, 'INSURANCE');
  s = A(s, { type: 'INSURE', player: 0, take: true }); eq(s.phase, 'ROUND_OVER');
  // perde 100, seguro 50 paga 150 → saldo 1000 - 100 - 50 + 150 = 1000
  eq(s.players[0].chips, 1000);
});
t('seguro recusado e banca sem Blackjack: segue o jogo', () => {
  let s = game(1, ['10S', 'AH', '9S', '5H']); s = bet(s, 0, 100); eq(s.phase, 'INSURANCE');
  s = A(s, { type: 'INSURE', player: 0, take: false }); eq(s.phase, 'PLAYING');
});
t('seguro perdido custa metade da aposta', () => {
  let s = game(1, ['10S', 'AH', '9S', '5H', '10D']); s = bet(s, 0, 100); s = A(s, { type: 'INSURE', player: 0, take: true });
  eq(s.players[0].chips, 850); s = A(s, { type: 'STAND', player: 0 }); // banca A,5 = soft 16 → compra 10 → 16 → ... 
  eq(s.phase, 'ROUND_OVER');
});
t('dobrar: dobra a aposta, 1 carta e termina', () => {
  let s = game(1, ['5S', '10H', '6S', '7H', '10D']); s = bet(s, 0, 100); s = A(s, { type: 'DOUBLE', player: 0 });
  // jogador 5+6+10=21 vs banca 17 → ganha 200
  eq(s.phase, 'ROUND_OVER'); eq(s.players[0].chips, 1200);
});
t('estourar perde e a banca não compra', () => {
  let s = game(1, ['10S', '10H', '6S', '6H', 'KD']); s = bet(s, 0, 100); s = A(s, { type: 'HIT', player: 0 });
  eq(s.phase, 'ROUND_OVER'); eq(s.players[0].hands[0].result, 'bust'); eq(s.dealer.cards.length, 2); eq(s.players[0].chips, 900);
});
t('banca para em todo 17 e compra até 17', () => {
  let s = game(1, ['10S', '6H', '9S', '5H', '6D']); s = bet(s, 0, 100); s = A(s, { type: 'STAND', player: 0 });
  // banca 6+5=11 +6=17 para
  eq(E.score(s.dealer.cards).total, 17); eq(s.players[0].hands[0].result, 'win');
});
t('banca estoura: todos que não estouraram ganham', () => {
  let s = game(1, ['10S', '10H', '8S', '6H', 'KD']); s = bet(s, 0, 100); s = A(s, { type: 'STAND', player: 0 });
  eq(E.score(s.dealer.cards).total, 26); eq(s.players[0].chips, 1100);
});
t('separar: duas mãos, aposta por mão', () => {
  let s = game(1, ['8S', '10H', '8D', '7H', '3C', '2C', '10C', '10D']); s = bet(s, 0, 100); eq(E.options(s, 0).split, true);
  s = A(s, { type: 'SPLIT', player: 0 }); eq(s.players[0].hands.length, 2); eq(s.players[0].chips, 800);
  eq(s.turn, { seat: 0, hand: 0 });
  s = A(s, { type: 'STAND', player: 0 }); eq(s.turn, { seat: 0, hand: 1 }); s = A(s, { type: 'STAND', player: 0 });
  eq(s.phase, 'ROUND_OVER');
});
t('Ases separados: uma carta cada e 21 não é Blackjack', () => {
  let s = game(1, ['AS', '9H', 'AD', '7H', 'KC', 'KD']); s = bet(s, 0, 100); s = A(s, { type: 'SPLIT', player: 0 });
  eq(s.phase, 'ROUND_OVER'); eq(s.players[0].hands.map((h) => h.result), ['win', 'win']); eq(s.players[0].chips, 1200);
});
t('desistir devolve metade e só na primeira jogada', () => {
  let s = game(1, ['10S', '10H', '6S', '7H']); s = bet(s, 0, 100); eq(E.options(s, 0).surrender, true);
  s = A(s, { type: 'SURRENDER', player: 0 }); eq(s.players[0].chips, 950); eq(s.players[0].hands[0].result, 'surrender');
  let s2 = game(1, ['2S', '10H', '3S', '7H', '2D']); s2 = bet(s2, 0, 100); s2 = A(s2, { type: 'HIT', player: 0 }); eq(E.options(s2, 0).surrender, false);
});
t('Par Perfeito: misto 6:1, colorido 12:1, perfeito 25:1', () => {
  const run = (c1, c2) => { let s = game(1, [c1, '10H', c2, '7H']); s = bet(s, 0, 100, 10); return s; };
  let s = run('8S', '8H'); eq(s.players[0].sideResult, 'misto'); eq(s.players[0].sidePay, 70);
  s = run('8H', '8D'); eq(s.players[0].sideResult, 'colorido'); eq(s.players[0].sidePay, 130);
  s = run('8H', '8H'); eq(s.players[0].sideResult, 'perfeito'); eq(s.players[0].sidePay, 260);
  s = run('8S', '9H'); eq(s.players[0].sideResult, 'perdeu'); eq(s.players[0].sidePay, 0);
  // saldo: aposta 100 + lateral 10 saem; perfeito devolve 260
  s = run('8H', '8H'); eq(s.players[0].chips, 1000 - 110 + 260);
});
t('múltiplos jogadores jogam em ordem', () => {
  let s = game(2, ['10S', '10D', '10H', '7H', '9S', '9D']); s = bet(s, 0, 100); s = bet(s, 1, 50);
  eq(E.pending(s), [0]); s = A(s, { type: 'STAND', player: 0 }); eq(E.pending(s), [1]);
  eq(E.applyAction(s, { type: 'STAND', player: 0 }).ok, false);
  s = A(s, { type: 'STAND', player: 1 }); eq(s.phase, 'ROUND_OVER');
});
t('jogador que não aposta (0) assiste a rodada', () => {
  let s = game(2, ['10S', '10D', '9S', '7H']); s = bet(s, 0, 0); s = bet(s, 1, 100); eq(s.players[0].hands.length, 0); eq(E.pending(s), [1]);
});
t('próxima rodada, recompra quando quebra e fim da mesa', () => {
  let s = game(1, ['10S', '10H', '6S', '7H', 'KD']); s = bet(s, 0, 500); s = A(s, { type: 'HIT', player: 0 }); s.players[0].chips = 5;
  s = A(s, { type: 'NEXT_ROUND', player: 0 }); eq(s.phase, 'BETTING'); eq(s.players[0].chips, 1005); eq(s.players[0].rebuys, 1); eq(s.round, 2);
  s = A(s, { type: 'END_GAME', player: 0 }); eq(s.phase, 'ENDED');
  eq(E.standings(s)[0].net, 1005 - 2000);
});
t('partida longa aleatória mantém as fichas consistentes', () => {
  let s = game(3);
  const total0 = () => s.players.reduce((n, p) => n + p.chips, 0);
  for (let r = 0; r < 300; r++) {
    for (const p of s.players) { let side = r % 3 === 0 ? 10 : 0, b = Math.min(10 * (1 + (r % 5)), Math.floor((p.chips - side) / 10) * 10); if (b <= 0) { b = 0; side = 0; } s = A(s, { type: 'BET', player: p.seat, bet: b, side }); }
    let guard = 0;
    while (s.phase !== 'ROUND_OVER' && guard++ < 400) {
      if (s.phase === 'INSURANCE') { for (const q of E.pending(s)) s = A(s, { type: 'INSURE', player: q, take: q % 2 === 0 && s.players[q].chips >= s.players[q].bet / 2 }); continue; }
      const seat = s.turn.seat, o = E.options(s, seat), h = s.players[seat].hands[s.turn.hand], sc = E.score(h.cards).total;
      const act = o.split && r % 4 === 0 ? 'SPLIT' : o.double && sc >= 9 && sc <= 11 ? 'DOUBLE' : sc < 15 ? 'HIT' : 'STAND';
      s = A(s, { type: act, player: seat });
    }
    if (s.phase !== 'ROUND_OVER') throw new Error('rodada travou');
    s.players.forEach((p) => { if (p.chips < 0 || !Number.isInteger(p.chips)) throw new Error('fichas inválidas ' + p.chips); });
    s = A(s, { type: 'NEXT_ROUND', player: 0 });
  }
});
t('humano assume o lugar do bot: saldo conta a partir da entrada', () => {
  let s = game(2, ['10S', '10D', '9S', '7H', '8D', '8C']); s = bet(s, 0, 100); s = bet(s, 1, 100);
  s = A(s, { type: 'TAKEOVER', player: 1, id: 'humano', name: 'Fulano' }); eq(s.players[1].id, 'humano');
  s = A(s, { type: 'STAND', player: 0 }); s = A(s, { type: 'STAND', player: 1 });
  const st = E.standings(s).find((x) => x.id === 'humano'); eq(st.net, s.players[1].roundNet);
});
t('ausente: só depois do limite, jogam por ele e ele volta ao agir', () => {
  let s = game(2, ['10S', '10D', '9S', '7H', '8D', '8C']); s.lastAt = 1000;
  eq(E.applyAction(s, { type: 'ABSENT', player: 0, at: 20000 }).ok, false); // cedo demais
  s = A(s, { type: 'BET', player: 1, bet: 50, side: 0, at: 5000 });
  eq(E.applyAction(s, { type: 'ABSENT', player: 1, at: 99000 }).ok, false); // já apostou, não deve nada
  s = A(s, { type: 'ABSENT', player: 0, at: 60000 }); eq(s.players[0].absent, true);
  eq(E.applyAction(s, { type: 'ABSENT', player: 0, at: 61000 }).ok, false);
  s = A(s, { type: 'BET', player: 0, bet: 0, side: 0, auto: true, at: 60100 }); eq(s.players[0].absent, true); // ação automática não tira o ausente
  eq(s.phase, 'PLAYING'); eq(E.pending(s), [1]);
  s = A(s, { type: 'RETURN', player: 0, at: 62000 }); eq(s.players[0].absent, false);
});
console.log(ok + ' passaram, ' + bad + ' falharam'); process.exit(bad ? 1 : 0);
