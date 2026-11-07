// Testes do buraco-engine.js — rode com: node buraco-engine.test.js
const assert = require('assert');
const E = require('./buraco-engine.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

let nid = 5000;
const K = (str) => str.trim().split(/\s+/).map((t) => ({
  id: nid++, rank: t.slice(0, -1), suit: t.slice(-1), deck: 0
}));
const ids = (cards) => cards.map((c) => c.id);

/** Estado limpo: mãos vazias, monte de reis de paus, mortos de enchimento */
function fresh(opts = {}) {
  const s = E.createGame({ seed: 1, now: 0, config: Object.assign({ drawSeconds: 20, playSeconds: 40 }, opts.config) });
  s.players.forEach((p) => { p.hand = []; });
  s.stock = K(Array(30).fill('KC').join(' '));
  s.discard = [];
  s.mortos = [
    { cards: K('3H 3H 4H 4H 5H 5H 6H 6H 7H 7H 8H') },
    { cards: K('3D 3D 4D 4D 5D 5D 6D 6D 7D 7D 8D') }
  ];
  s.turn = { player: 0, deadline: 20000, drewFrom: null };
  s.phase = 'WAITING_TURN';
  return s;
}
const addMeld = (s, team, str, option = 0) => {
  const cards = K(str);
  const lay = E.findMeldLayouts(cards)[option];
  assert(lay, 'jogo de teste inválido: ' + str);
  const m = { id: s.nextMeldId++, suit: lay.suit, cards: lay.entries };
  s.teams[team].melds.push(m);
  return m;
};
const play = (s, a, now = 1000) => E.applyAction(s, a, now);
const must = (r) => { assert(r.ok, r.error && r.error.code + ': ' + r.error.message); return r.state; };
const L = (str) => E.findMeldLayouts(K(str));

// ───────── Baralho e distribuição
test('baralho tem 104 cartas, sem coringas', () => {
  const d = E.createDeck();
  assert.strictEqual(d.length, 104);
  assert.strictEqual(new Set(d.map((c) => c.id)).size, 104);
});
test('distribuição: 11 por jogador, 2 mortos de 11, monte 38, lixo vazio', () => {
  const s = E.createGame({ seed: 7 });
  s.players.forEach((p) => assert.strictEqual(p.hand.length, 11));
  assert.strictEqual(s.mortos.length, 2);
  s.mortos.forEach((m) => assert.strictEqual(m.cards.length, 11));
  assert.strictEqual(s.stock.length, 38);
  assert.strictEqual(s.discard.length, 0);
  assert.strictEqual(s.phase, 'WAITING_TURN');
});
test('mesma semente → mesma distribuição', () => {
  const a = E.createGame({ seed: 99 }), b = E.createGame({ seed: 99 }), c = E.createGame({ seed: 100 });
  assert.deepStrictEqual(a.players[0].hand, b.players[0].hand);
  assert.notDeepStrictEqual(a.players[0].hand, c.players[0].hand);
});
test('pontos das cartas', () => {
  const p = (t) => E.cardPoints(K(t)[0]);
  assert.strictEqual(p('AS'), 15);
  ['KS', 'QS', 'JS', '10S', '9S', '8S', '2S'].forEach((t) => assert.strictEqual(p(t), 10, t));
  ['7S', '6S', '5S', '4S', '3S'].forEach((t) => assert.strictEqual(p(t), 5, t));
});

// ───────── Validação de jogos
test('sequências válidas', () => {
  ['5S 6S 7S', 'QH KH AH', 'AS 2S 3S', '7S 5S 6S'].forEach((s) => assert(L(s).length, s));
});
test('sequências inválidas', () => {
  ['5S 6H 7S', '7S 7H 7D', '5S 6S', '5S 6S 8S', '5S 5S 6S'].forEach((s) => assert.strictEqual(L(s).length, 0, s));
});
test('não dá a volta: K A 3 inválido; K A 2 vale com 2 coringa (Q-K-A)', () => {
  assert.strictEqual(L('KS AS 3S').length, 0);
  const l = L('KS AS 2S');
  assert(l.length);
  assert.strictEqual(l[0].wilds, 1);
});
test('Ás baixo e alto', () => {
  assert.strictEqual(L('AS 2S 3S')[0].clean, true);
  assert.strictEqual(L('QS KS AS')[0].clean, true);
});
test('2 do mesmo naipe na posição natural é normal (jogo limpo)', () => {
  assert.strictEqual(L('AS 2S 3S')[0].clean, true);
  assert.strictEqual(L('2S 3S 4S')[0].clean, true);
});
test('2 de outro naipe é sempre coringa', () => {
  const l = L('5S 6S 2H');
  assert(l.length);
  assert(l.every((x) => !x.clean));
});
test('2 no meio é coringa e jogo fica sujo', () => {
  const l = L('5S 2S 7S');
  assert.strictEqual(l[0].wilds, 1);
  assert.strictEqual(l[0].entries.find((e) => e.card.rank === '2').pos, 6);
});
test('no máximo 1 coringa por jogo', () => {
  assert.strictEqual(L('5S 2H 2D 8S').length, 0);
  assert.strictEqual(L('5S 2H 2D 6S').length, 0);
});
test('2 natural + 1 coringa no mesmo jogo', () => {
  const l = L('AS 2S 4S 2H 5S');
  // A,2(nat),3(2H coringa),4,5
  assert(l.length);
  assert.strictEqual(l[0].wilds, 1);
});
test('jogo com 3 cartas só de 2 não forma', () => {
  assert.strictEqual(L('2S 2S 2S').length, 0);
});
test('máximo 14 cartas; A→A limpo', () => {
  const all = 'AS 2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS AS';
  const l = L(all);
  assert(l.length);
  assert.strictEqual(l[0].size, 14);
  assert.strictEqual(l[0].clean, true);
});

// ───────── Canastras
const info = (str, i = 0) => {
  const lay = L(str)[i];
  return E.meldInfo({ suit: lay.suit, cards: lay.entries });
};
test('canastra limpa 7 cartas: +200', () => assert.strictEqual(info('3S 4S 5S 6S 7S 8S 9S').bonus, 200));
test('canastra suja: +100', () => {
  const i = info('3S 4S 5S 6S 7S 8S 2H');
  assert.strictEqual(i.bonus, 100);
  assert.strictEqual(i.kind, 'suja');
});
test('6 cartas não é canastra', () => assert.strictEqual(info('3S 4S 5S 6S 7S 8S').isCanastra, false));
test('canastra A→K limpa: +500', () => assert.strictEqual(info('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS').bonus, 500));
test('canastra 2→A limpa (13): +500', () => assert.strictEqual(info('2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS AS').bonus, 500));
test('canastra A→A limpa (14): +1000', () => assert.strictEqual(info('AS 2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS AS').bonus, 1000));
test('13/14 suja vale 100', () => {
  assert.strictEqual(info('AS 2H 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS').bonus, 100);
});

// ───────── Fluxo do turno
test('comprar do monte e descartar passa a vez', () => {
  let s = fresh();
  s.players[0].hand = K('3S 9H');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  assert.strictEqual(s.phase, 'PLAYING');
  assert.strictEqual(s.players[0].hand.length, 3);
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.turn.player, 1);
  assert.strictEqual(s.phase, 'WAITING_TURN');
  assert.strictEqual(s.discard.length, 1);
});
test('fora da vez é recusado', () => {
  const s = fresh();
  assert.strictEqual(play(s, { type: 'DRAW_STOCK', player: 1 }).error.code, 'NOT_YOUR_TURN');
});
test('não descarta antes de comprar; não compra duas vezes', () => {
  let s = fresh();
  s.players[0].hand = K('3S 9H');
  assert.strictEqual(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }).error.code, 'WRONG_PHASE');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  assert.strictEqual(play(s, { type: 'DRAW_STOCK', player: 0 }).error.code, 'WRONG_PHASE');
});
test('pegar o lixo leva todas as cartas, sem obrigar usar o topo', () => {
  let s = fresh();
  s.players[0].hand = K('3S');
  s.discard = K('9H 10D KC');
  s = must(play(s, { type: 'DRAW_DISCARD', player: 0 }));
  assert.strictEqual(s.players[0].hand.length, 4);
  assert.strictEqual(s.discard.length, 0);
});
test('lixo vazio: não pode pegar', () => {
  const s = fresh();
  assert.strictEqual(play(s, { type: 'DRAW_DISCARD', player: 0 }).error.code, 'DISCARD_EMPTY');
});

// ───────── Baixar e adicionar
test('baixar jogo novo exige 3+ cartas', () => {
  let s = fresh();
  s.players[0].hand = K('5S 6S 9H 9D');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  const h = s.players[0].hand;
  assert.strictEqual(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(h.slice(0, 2)) }).error.code, 'INVALID_MELD');
});
test('baixar jogo e adicionar 1 carta por vez', () => {
  let s = fresh();
  s.players[0].hand = K('5S 6S 7S 8S 9H 9D');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  const h = s.players[0].hand;
  s = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(h.slice(0, 3)) }));
  const m = s.teams.A.melds[0];
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: h[3].id }));
  assert.strictEqual(s.teams.A.melds[0].cards.length, 4);
});
test('parceiro adiciona a jogo da dupla; adversário não', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '5S 6S 7S');
  s.turn.player = 2; s.phase = 'PLAYING';
  s.players[2].hand = K('8S 9H');
  s = must(play(s, { type: 'ADD_TO_MELD', player: 2, meldId: m.id, cardId: s.players[2].hand[0].id }));
  let t = fresh();
  const m2 = addMeld(t, 'A', '5S 6S 7S');
  t.turn.player = 1; t.phase = 'PLAYING';
  t.players[1].hand = K('8S 9H');
  assert.strictEqual(play(t, { type: 'ADD_TO_MELD', player: 1, meldId: m2.id, cardId: t.players[1].hand[0].id }).error.code, 'MELD_NOT_FOUND');
});
test('jogos nunca se unem (carta que encaixa em dois jogos entra em um só)', () => {
  let s = fresh();
  addMeld(s, 'A', '3S 4S 5S');
  const m2 = addMeld(s, 'A', '7S 8S 9S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('6S 9H');
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m2.id, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.teams.A.melds.length, 2);
});
test('carta fora do naipe ou da sequência não encaixa', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '5S 6S 7S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9S 8H 9D');
  assert.strictEqual(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[0].id }).error.code, 'INVALID_MELD');
  assert.strictEqual(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[1].id }).error.code, 'INVALID_MELD');
});
test('Ás entra no fim (alto) e no começo (baixo)', () => {
  let s = fresh();
  const m = addMeld(s, 'A', 'QS KS JS');
  const m2 = addMeld(s, 'A', '2S 3S 4S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('AS AS 9H');
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[0].id }));
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m2.id, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.teams.A.melds[0].cards.length, 4);
  assert.strictEqual(s.teams.A.melds[1].cards.length, 4);
});
test('K-A não dá a volta com 2: A no fim de Q-K não aceita 2 natural depois', () => {
  let s = fresh();
  const m = addMeld(s, 'A', 'QS KS AS');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('2S 9H');
  // 2♠ só entraria como coringa abaixo (J) — vale como coringa, nunca depois do A
  const opts = E.getAddOptions(s, 0, m.id, s.players[0].hand[0].id);
  assert(opts.length);
  assert(opts.every((o) => o.entries[o.entries.length - 1].pos === 14 && o.wilds === 1));
});

// ───────── Coringa: reposicionar
test('caso do vídeo: 3♦ 2♦(coringa em 4) 5♦ + 4♦ → 2♦ fica coringa em 6 e 7♦ entra', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '3D 2D 5D'); // 2 coringa na posição 4
  assert.strictEqual(m.cards.find((e) => e.card.rank === '2').pos, 4);
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('4D 7D 9H');
  const opts = E.getAddOptions(s, 0, m.id, s.players[0].hand[0].id);
  assert.strictEqual(opts[0].clean, true); // padrão: 2 vai para a posição natural
  const wildIdx = opts.findIndex((o) => !o.clean);
  assert(wildIdx > 0);
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[0].id, option: wildIdx }));
  const two = s.teams.A.melds[0].cards.find((e) => e.card.rank === '2');
  assert.strictEqual(two.pos, 6);
  assert.strictEqual(two.wild, true);
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.teams.A.melds[0].cards.length, 5);
});
test('coringa chega à posição natural → jogo vira limpo', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '3S 2S 5S'); // 2♠ coringa em 4
  assert.strictEqual(m.cards.filter((e) => e.wild).length, 1);
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('4S 9H');
  const opts = E.getAddOptions(s, 0, m.id, s.players[0].hand[0].id);
  assert(opts.length);
  assert.strictEqual(opts[0].clean, true); // opção 0 = mais limpa
  s = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(E.meldInfo(s.teams.A.melds[0]).clean, true);
});
test('segundo coringa no mesmo jogo é recusado', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '5S 2H 7S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('2D 9H');
  assert.strictEqual(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: s.players[0].hand[0].id }).error.code, 'INVALID_MELD');
});

// ───────── Morto
test('esvaziar em pé: pega o morto, continua o turno, relógio reinicia', () => {
  let s = fresh();
  s.players[0].hand = K('5S 6S 7S 9H');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }, 1000)); // hand: 5 cartas (KC)
  const h = s.players[0].hand;
  const kc = h.find((c) => c.rank === 'K');
  s = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(h.slice(0, 3)) }, 2000));
  assert.strictEqual(s.teams.A.mortoTaken, false);
  // sobram 9H e KC; baixa um jogo? não dá — monta cenário direto
  let t = fresh();
  t.turn.player = 0; t.phase = 'PLAYING'; t.turn.deadline = 99999;
  t.players[0].hand = K('5S 6S 7S');
  t = must(play(t, { type: 'LAY_MELD', player: 0, cardIds: ids(t.players[0].hand) }, 5000));
  assert.strictEqual(t.teams.A.mortoTaken, true);
  assert.strictEqual(t.players[0].hand.length, 11);
  assert.strictEqual(t.phase, 'PLAYING');
  assert.strictEqual(t.turn.player, 0);
  assert.strictEqual(t.turn.deadline, 5000 + 40000);
  assert.strictEqual(t.mortos.length, 1);
  void kc;
});
test('esvaziar descartando: pega o morto e o turno acaba', () => {
  let s = fresh();
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9H');
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.teams.A.mortoTaken, true);
  assert.strictEqual(s.players[0].hand.length, 11);
  assert.strictEqual(s.turn.player, 1);
});
test('regra da última carta: não pode esvaziar sem morto nem batida', () => {
  let s = fresh();
  s.teams.A.mortoTaken = true;
  s.mortos.shift();
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9H');
  assert.strictEqual(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }).error.code, 'LAST_CARD_RULE');
  let t = fresh();
  t.teams.A.mortoTaken = true;
  t.mortos.shift();
  t.turn.player = 0; t.phase = 'PLAYING';
  t.players[0].hand = K('5S 6S 7S');
  assert.strictEqual(play(t, { type: 'LAY_MELD', player: 0, cardIds: ids(t.players[0].hand) }).error.code, 'LAST_CARD_RULE');
});
test('baixar deixando 1 carta sem poder descartar é recusado (beco sem saída)', () => {
  let t = fresh();
  t.teams.A.mortoTaken = true;
  t.mortos.shift();
  t.turn.player = 0; t.phase = 'PLAYING';
  t.players[0].hand = K('5S 6S 7S 9H');
  assert.strictEqual(play(t, { type: 'LAY_MELD', player: 0, cardIds: ids(t.players[0].hand.slice(0, 3)) }).error.code, 'LAST_CARD_RULE');
});
test('parceiro com cartas: jogador vazio da dupla só pega morto uma vez', () => {
  let s = fresh();
  s.teams.A.mortoTaken = true;
  s.mortos.shift();
  assert.strictEqual(E.emptyOutcome(s, 0), null);
  assert.strictEqual(E.emptyOutcome(s, 1), 'MORTO');
});

// ───────── Batida
test('bater: morto pego + canastra limpa → fim da rodada, +100', () => {
  let s = fresh();
  s.teams.A.mortoTaken = true;
  s.mortos.shift();
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 9S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9H');
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.phase, 'ROUND_OVER');
  assert.strictEqual(s.roundResult.reason, 'BATIDA');
  assert.strictEqual(s.roundResult.detail.A.batida, 100);
});
test('bater sem canastra limpa é impedido', () => {
  let s = fresh();
  s.teams.A.mortoTaken = true;
  s.mortos.shift();
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 2H'); // suja
  assert.strictEqual(E.emptyOutcome(s, 0), null);
});
test('bônus de batida pode ser configurado (0 = sem bônus)', () => {
  let s = fresh({ config: { batidaBonus: 0 } });
  s.teams.A.mortoTaken = true;
  s.mortos.shift();
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 9S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9H');
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.roundResult.detail.A.batida, 0);
});
test('bater de novo depois de pegar o morto em pé', () => {
  let s = fresh();
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 9S');
  s.turn.player = 0; s.phase = 'PLAYING'; s.turn.deadline = 99999;
  s.players[0].hand = K('5H 6H 7H');
  s.mortos[0].cards = K('8C 9C 10C');
  s = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(s.players[0].hand) }, 100));
  assert.strictEqual(s.teams.A.mortoTaken, true);
  const h = s.players[0].hand;
  s = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(h) }, 200));
  assert.strictEqual(s.phase, 'ROUND_OVER');
  assert.strictEqual(s.roundResult.reason, 'BATIDA');
});

// ───────── Monte esgotado
test('monte acaba: um morto vira monte (sem dono); quem não pegou morto leva -100', () => {
  let s = fresh();
  s.stock = K('KC');
  s.mortos = [{ cards: K('3D 3D 4D') }];
  s.teams.A.mortoTaken = true;
  s.players[0].hand = K('9H');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  assert.strictEqual(s.stock.length, 3);
  assert.strictEqual(s.mortos.length, 0);
  assert.strictEqual(E.scoreRound(s, null).B.morto, -100);
  assert.strictEqual(E.scoreRound(s, null).A.morto, 0);
});
test('morto não tem dono: a segunda dupla a esvaziar pega o que sobrou; a terceira vez não há', () => {
  let s = fresh();
  assert.strictEqual(E.emptyOutcome(s, 0), 'MORTO');
  assert.strictEqual(E.emptyOutcome(s, 1), 'MORTO');
  s.turn.player = 1; s.phase = 'PLAYING';
  s.players[1].hand = K('9H');
  s = must(play(s, { type: 'DISCARD', player: 1, cardId: s.players[1].hand[0].id }));
  assert.strictEqual(s.teams.B.mortoTaken, true);
  assert.strictEqual(s.mortos.length, 1);
  assert.strictEqual(E.emptyOutcome(s, 0), 'MORTO');
  s.teams.A.mortoTaken = true; s.mortos = [];
  assert.strictEqual(E.emptyOutcome(s, 2), null);
});
test('dois mortos viram monte: rodada termina com -100 para as duas duplas', () => {
  let s = fresh();
  s.stock = K('KC');
  s.mortos = [{ cards: K('3H') }, { cards: K('3D') }];
  s.players.forEach((p) => { p.hand = K('9H 9D'); });
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  assert.strictEqual(s.stock.length, 1);
  assert.strictEqual(s.mortos.length, 1);
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  s = must(play(s, { type: 'DRAW_STOCK', player: 1 }));
  assert.strictEqual(s.mortos.length, 0);
  s = must(play(s, { type: 'DISCARD', player: 1, cardId: s.players[1].hand[0].id }));
  s = must(play(s, { type: 'DRAW_STOCK', player: 2 }));
  assert.strictEqual(s.pendingRoundEnd, true);
  s = must(play(s, { type: 'DISCARD', player: 2, cardId: s.players[2].hand[0].id }));
  assert.strictEqual(s.phase, 'ROUND_OVER');
  assert.strictEqual(s.roundResult.detail.A.morto, -100);
  assert.strictEqual(s.roundResult.detail.B.morto, -100);
});
test('monte acaba sem morto: rodada termina ao fim da vez', () => {
  let s = fresh();
  s.stock = K('KC');
  s.mortos = [];
  s.teams.A.mortoTaken = true; s.teams.B.mortoTaken = true;
  s.players[0].hand = K('9H 9D');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  assert.strictEqual(s.pendingRoundEnd, true);
  assert.strictEqual(s.phase, 'PLAYING');
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.phase, 'ROUND_OVER');
  assert.strictEqual(s.roundResult.reason, 'STOCK_EMPTY');
});
test('stockEmptyEnd=immediate encerra na hora', () => {
  let s = fresh({ config: { stockEmptyEnd: 'immediate' } });
  s.stock = K('KC');
  s.mortos = [];
  s.players[0].hand = K('9H');
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }));
  assert.strictEqual(s.phase, 'ROUND_OVER');
});

// ───────── Pontuação
test('exemplo: A = 220, B = 35', () => {
  let s = fresh();
  // A: canastra limpa 3..9 = 5*5 + 10*2 = 25+... calculado abaixo
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 9S'); // 5+5+5+5+5+10+10 = 45, +200
  s.teams.A.mortoTaken = true;
  s.players[0].hand = K('5H');           // -5
  s.players[2].hand = K('KH');           // -10
  // A = 45 + 200 - 15 = 230 ; ajusta para 220 com mais 10 em mão
  s.players[2].hand = K('KH QH');        // -20 → 45+200-5-20 = 220
  // B: não pegou morto (-100), jogo 5H 6H 7H = 15 ; canastra nenhuma ; mão 0 ... queremos 35
  addMeld(s, 'B', '10D JD QD KD AD');    // 10+10+10+10+15 = 55 → 55 -100 = -45 ; ajusta
  s.teams.B.mortoTaken = true;           // sem -100
  s.players[1].hand = K('JC JC');        // -20 → 55-20 = 35
  const d = E.scoreRound(s, null);
  assert.strictEqual(d.A.total, 220);
  assert.strictEqual(d.B.total, 35);
  assert.strictEqual(d.A.morto, 0);
  assert.strictEqual(d.A.limpa.count, 1);
  assert.strictEqual(d.A.limpa.points, 200);
});
test('morto não pego: -100', () => {
  const s = fresh();
  assert.strictEqual(E.scoreRound(s, null).A.morto, -100);
});
test('dupla sem morto pego leva -100 mesmo que o morto tenha virado monte', () => {
  const s = fresh();
  assert.strictEqual(E.scoreRound(s, null).A.morto, -100);
});

// ───────── Fim de partida
function endRound(s, a, b) {
  s.scores = { A: a, B: b };
  s.teams.A.mortoTaken = true; s.teams.B.mortoTaken = true;
  s.mortos = [];
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 9S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9H');
  return must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
}
test('meta de 3000 atingida → GAME_OVER com vencedor', () => {
  let s = endRound(fresh(), 2900, 0);
  assert.strictEqual(s.phase, 'GAME_OVER');
  assert.strictEqual(s.winner, 'A');
});
test('abaixo da meta → ROUND_OVER e START_NEXT_ROUND reinicia', () => {
  let s = endRound(fresh(), 0, 0);
  assert.strictEqual(s.phase, 'ROUND_OVER');
  const scores = JSON.parse(JSON.stringify(s.scores));
  s = must(play(s, { type: 'START_NEXT_ROUND', player: 0 }));
  assert.strictEqual(s.round, 2);
  assert.deepStrictEqual(s.scores, scores);
  assert.strictEqual(s.phase, 'WAITING_TURN');
  s.players.forEach((p) => assert.strictEqual(p.hand.length, 11));
});
test('as duas passam de 3000: vence a maior', () => {
  let s = fresh();
  s.scores = { A: 0, B: 3200 };
  s = endRound(s, 0, 3200);
  // A ganha ~245 → 245 < 3200 → B vence
  assert.strictEqual(s.winner, 'B');
});
test('empate acima da meta → partida continua', () => {
  let s = fresh();
  s.teams.A.mortoTaken = true; s.teams.B.mortoTaken = true; s.mortos = [];
  addMeld(s, 'A', '3S 4S 5S 6S 7S 8S 9S');
  const detail = E.scoreRound(s, 'A');
  s.scores = { A: 3000 - detail.A.total, B: 3000 - detail.B.total };
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('9H');
  s = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(s.scores.A, 3000);
  assert.strictEqual(s.scores.B, 3000);
  assert.strictEqual(s.winner, null);
  assert.strictEqual(s.phase, 'ROUND_OVER');
});
test('após GAME_OVER ações são recusadas', () => {
  let s = endRound(fresh(), 2900, 0);
  assert.strictEqual(play(s, { type: 'DRAW_STOCK', player: 1 }).error.code, 'GAME_OVER');
});

// ───────── Tempo
test('20s sem comprar → compra automática do monte; 40s depois → descarte automático', () => {
  let s = fresh();
  s.players[0].hand = K('3S 9H');
  let ev = E.processTimeouts(s, 20001);
  assert(ev.some((e) => e.type === 'TIMEOUT_COMPRA'));
  assert.strictEqual(s.phase, 'PLAYING');
  assert.strictEqual(s.turn.deadline, 60000);
  assert.strictEqual(s.discard.length, 0);
  ev = E.processTimeouts(s, 60000);
  assert(ev.some((e) => e.type === 'TIMEOUT_JOGADA'));
  assert.strictEqual(s.turn.player, 1);
  assert.strictEqual(s.discard.length, 1);
});
test('compra automática pega o lixo se o topo encaixa em jogo da dupla', () => {
  let s = fresh();
  addMeld(s, 'A', '5S 6S 7S');
  s.players[0].hand = K('9H');
  s.discard = K('JD 8S');
  E.processTimeouts(s, 20001);
  assert.strictEqual(s.discard.length, 0);
  assert.strictEqual(s.players[0].hand.length, 3);
});
test('compra automática pega o lixo se topo forma jogo novo com a mão', () => {
  let s = fresh();
  s.players[0].hand = K('5H 6H');
  s.discard = K('7H');
  E.processTimeouts(s, 20001);
  assert.strictEqual(s.discard.length, 0);
});
test('compra automática olha só o topo e vai ao monte se não serve', () => {
  let s = fresh();
  addMeld(s, 'A', '5S 6S 7S');
  s.players[0].hand = K('9H');
  s.discard = K('8S JD'); // 8S serve, mas o topo é JD
  E.processTimeouts(s, 20001);
  assert.strictEqual(s.discard.length, 2);
  assert.strictEqual(s.players[0].hand.length, 2);
});
test('compra automática com lixo vazio compra do monte', () => {
  let s = fresh();
  s.players[0].hand = K('9H');
  E.processTimeouts(s, 20001);
  assert.strictEqual(s.players[0].hand.length, 2);
});
test('descarte automático: menor pontuação fora de sequência', () => {
  const c = E.chooseAutoDiscard(K('5S 6S KH 3D 9C'));
  assert.strictEqual(c.rank + c.suit, '3D');
});
test('descarte automático: vizinhos protegem; sem livres, menor da mão', () => {
  const c = E.chooseAutoDiscard(K('5S 6S 7S 8S'));
  assert.strictEqual(c.rank, '5'); // todas protegidas → menor (5), desempate menor rank
});
test('descarte automático: desempate por menor rank; 2 por último', () => {
  assert.strictEqual(E.chooseAutoDiscard(K('3S 7H 2D')).rank, '3'); // 3 (5pts) antes de 7 (5pts)
  assert.strictEqual(E.chooseAutoDiscard(K('2S KH')).rank, 'K'); // 10 pts cada; o 2 fica por último
});
test('Ás é vizinho do 2 e do K', () => {
  const hand = K('AS 2S 9H');
  assert.strictEqual(E.chooseAutoDiscard(hand).rank, '9');
  assert.strictEqual(E.chooseAutoDiscard(K('AS KS 9H')).rank, '9');
});
test('várias vezes estouradas são processadas em cadeia', () => {
  let s = fresh();
  for (let i = 0; i < 4; i++) s.players[i].hand = K('3S 9H 4D');
  E.processTimeouts(s, 400000);
  assert(s.turn.player !== 0 || s.discard.length >= 4);
  assert(s.discard.length >= 4);
});
test('ação atrasada: applyAction processa timeout antes e recusa quem perdeu a vez', () => {
  let s = fresh();
  s.players[0].hand = K('3S 9H');
  const r = E.applyAction(s, { type: 'DRAW_STOCK', player: 0 }, 70000);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error.code, 'NOT_YOUR_TURN');
  assert.strictEqual(r.state.turn.player, 1);
});
test('applyAction não altera o estado original', () => {
  const s = fresh();
  s.players[0].hand = K('3S 9H');
  const copy = JSON.stringify(s);
  E.applyAction(s, { type: 'DRAW_STOCK', player: 0 }, 1000);
  assert.strictEqual(JSON.stringify(s), copy);
});

// ───────── Serialização e privacidade
test('estado sobrevive a JSON (Firebase) e continua jogável', () => {
  let s = E.createGame({ seed: 5, now: 0 });
  s = JSON.parse(JSON.stringify(s));
  const r = E.applyAction(s, { type: 'DRAW_STOCK', player: 0 }, 1000);
  assert(r.ok);
});
test('viewFor esconde mãos alheias, monte e mortos', () => {
  const s = E.createGame({ seed: 5, now: 0 });
  const v = E.viewFor(s, 1);
  assert(Array.isArray(v.players[1].hand));
  assert.strictEqual(v.players[0].hand, undefined);
  assert.strictEqual(v.players[0].handCount, 11);
  assert.strictEqual(v.stock, undefined);
  assert.strictEqual(v.stockCount, 38);
  assert(!JSON.stringify(v).includes('"cards":[{"id"') || !v.mortos[0].cards);
});
test('partida simulada completa só com timeouts termina sem erros', () => {
  let s = E.createGame({ seed: 11, now: 0, config: { drawSeconds: 20, playSeconds: 40 } });
  let t = 0, guard = 0;
  while (s.phase !== 'GAME_OVER' && s.round <= 3 && guard++ < 5000) {
    t += 61000;
    E.processTimeouts(s, t);
    if (s.phase === 'ROUND_OVER') s = E.applyAction(s, { type: 'START_NEXT_ROUND', player: 0 }, t).state;
    const n = s.players.reduce((a, p) => a + p.hand.length, 0) + s.stock.length + s.discard.length +
      s.mortos.reduce((a, m) => a + m.cards.length, 0) +
      ['A', 'B'].reduce((a, k) => a + s.teams[k].melds.reduce((b, m) => b + m.cards.length, 0), 0);
    if (s.phase !== 'ROUND_OVER' && s.phase !== 'GAME_OVER') assert.strictEqual(n, 104, 'conservação de cartas');
  }
  assert(guard < 5000, 'travou');
  assert(s.round >= 3);
});

// ───────── Sem tempo, pausa, encerramento, várias cartas
test('por padrão não há limite de tempo', () => {
  let s = E.createGame({ seed: 3, now: 0 });
  assert.strictEqual(s.turn.deadline, null);
  assert.deepStrictEqual(E.processTimeouts(s, 9e9), []);
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }, 5));
  assert.strictEqual(s.turn.deadline, null);
});
test('pausa bloqueia jogadas e retoma; relógio não corre durante a pausa', () => {
  let s = fresh();
  s.players[0].hand = K('3S 9H');
  s = must(play(s, { type: 'PAUSE', player: 2 }, 1000));
  assert.strictEqual(s.paused.by, 2);
  assert.strictEqual(play(s, { type: 'DRAW_STOCK', player: 0 }, 2000).error.code, 'PAUSED');
  assert.deepStrictEqual(E.processTimeouts(JSON.parse(JSON.stringify(s)), 999999), []);
  s = must(play(s, { type: 'RESUME', player: 1 }, 31000));
  assert.strictEqual(s.paused, null);
  assert.strictEqual(s.turn.deadline, 20000 + 30000);
  s = must(play(s, { type: 'DRAW_STOCK', player: 0 }, 32000));
});
test('não retoma jogo que não está pausado', () => {
  assert.strictEqual(play(fresh(), { type: 'RESUME', player: 0 }).error.code, 'NOT_PAUSED');
});
test('encerrar antecipado: precisa dos 4 sim; um não cancela a proposta', () => {
  let s = fresh(); s.scores = { A: 500, B: 300 };
  s = must(play(s, { type: 'PROPOSE_END', player: 0 }));
  s = must(play(s, { type: 'VOTE_END', player: 1, yes: true }));
  s = must(play(s, { type: 'VOTE_END', player: 2, yes: false }));
  assert.strictEqual(s.endVote, null);
  s = must(play(s, { type: 'PROPOSE_END', player: 1 }));
  [0, 2, 3].forEach((p) => { s = must(play(s, { type: 'VOTE_END', player: p, yes: true })); });
  assert.strictEqual(s.phase, 'GAME_OVER');
  assert.strictEqual(s.winner, null); // pontos cancelados
  assert.strictEqual(s.roundResult.reason, 'EARLY');
  assert.strictEqual(s.roundResult.cancelled, true);
});
test('END_NOW encerra direto, sem vencedor', () => {
  let s = fresh();
  s = must(play(s, { type: 'END_NOW', player: 0 }));
  assert.strictEqual(s.phase, 'GAME_OVER');
  assert.strictEqual(s.winner, null);
});
test('adicionar várias cartas de uma vez ao mesmo jogo', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '3S 4S 5S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('6S 7S 8S 9H');
  const c = s.players[0].hand;
  s = must(play(s, { type: 'ADD_MANY', player: 0, meldId: m.id, cardIds: [c[2].id, c[0].id, c[1].id] }));
  assert.strictEqual(s.teams.A.melds[0].cards.length, 6);
  assert.strictEqual(s.players[0].hand.length, 1);
});
test('várias cartas: se uma não encaixa, nada é aplicado', () => {
  let s = fresh();
  const m = addMeld(s, 'A', '3S 4S 5S');
  s.turn.player = 0; s.phase = 'PLAYING';
  s.players[0].hand = K('6S 9D 9H');
  const c = s.players[0].hand;
  const r = play(s, { type: 'ADD_MANY', player: 0, meldId: m.id, cardIds: [c[0].id, c[1].id] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(s.teams.A.melds[0].cards.length, 3);
});

// ───────── Vulnerável (seção 8.5) ─────────
function vul(handStr, extra = '') {
  const s = fresh({ config: { drawSeconds: 0, playSeconds: 0 } });
  s.teams.A.vulnerable = true; s.teams.A.opened = false;
  const hand = K(handStr + ' ' + extra);
  s.players[0].hand = hand; s.phase = 'PLAYING'; s.turn = { player: 0, deadline: null, drewFrom: 'STOCK' };
  return { s, hand };
}
test('vulnerável: dupla com 1500+ começa a rodada vulnerável; a outra não', () => {
  const s = fresh(); s.scores = { A: 1500, B: 1499 };
  E._internal.dealRound(s, 0);
  assert.strictEqual(s.teams.A.vulnerable, true); assert.strictEqual(s.teams.A.opened, false);
  assert.strictEqual(s.teams.B.vulnerable, false); assert.strictEqual(s.teams.B.opened, true);
});
test('vulnerável: jogo de 15 pontos não abre; descartar é recusado até abrir; desfazer devolve as cartas', () => {
  const { s, hand } = vul('3S 4S 5S', '9C 9D KH');
  let r = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(hand.slice(0, 3)), option: 0 }));
  assert.strictEqual(r.teams.A.opened, false); assert.strictEqual(r.opening.points, 15);
  const d = play(r, { type: 'DISCARD', player: 0, cardId: hand[3].id });
  assert.strictEqual(d.ok, false); assert.strictEqual(d.error.code, 'OPENING_INCOMPLETE');
  r = must(play(r, { type: 'UNDO_OPENING', player: 0 }));
  assert.strictEqual(r.players[0].hand.length, 6); assert.strictEqual(r.teams.A.melds.length, 0); assert.strictEqual(r.opening, null);
  must(play(r, { type: 'DISCARD', player: 0, cardId: hand[3].id }));
});
test('vulnerável: vários jogos no mesmo turno somam 75 e abrem a dupla', () => {
  const { s, hand } = vul('9H 10H JH QH KH', '8S 9S 10S 4C');
  let r = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(hand.slice(0, 5)), option: 0 })); // 50
  assert.strictEqual(r.teams.A.opened, false);
  r = must(play(r, { type: 'LAY_MELD', player: 0, cardIds: ids(hand.slice(5, 8)), option: 0 }));   // +30 = 80
  assert.strictEqual(r.teams.A.opened, true); assert.strictEqual(r.opening, null);
  assert(r.events === undefined || true);
  must(play(r, { type: 'DISCARD', player: 0, cardId: hand[8].id }));
});
test('vulnerável: não pode esvaziar a mão antes de somar 75', () => {
  const { s, hand } = vul('3S 4S 5S');
  const r = play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(hand), option: 0 });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.error.code, 'OPENING_INCOMPLETE');
});
test('vulnerável: dupla já aberta joga normal; a outra dupla nunca é afetada', () => {
  const { s, hand } = vul('3S 4S 5S', '9C 9D');
  s.teams.A.opened = true;
  let r = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(hand.slice(0, 3)), option: 0 }));
  must(play(r, { type: 'DISCARD', player: 0, cardId: hand[3].id }));
  const t = fresh(); t.players[1].hand = K('3S 4S 5S 9C'); t.phase = 'PLAYING'; t.turn = { player: 1, deadline: null, drewFrom: 'STOCK' };
  t.teams.A.vulnerable = true; t.teams.A.opened = false;
  const r2 = must(play(t, { type: 'LAY_MELD', player: 1, cardIds: ids(t.players[1].hand.slice(0, 3)), option: 0 }));
  must(play(r2, { type: 'DISCARD', player: 1, cardId: t.players[1].hand[3].id }));
});
test('vulnerável: estourar o tempo com descida incompleta desfaz e descarta', () => {
  const { s, hand } = vul('3S 4S 5S', '9C 9D KH');
  s.config.playSeconds = 40; s.turn.deadline = 50000;
  const r = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(hand.slice(0, 3)), option: 0 }, 1000));
  const t = E.applyAction(r, { type: 'PAUSE', player: 1 }, 99999); // força processTimeouts
  assert.strictEqual(t.state.opening, null); assert.strictEqual(t.state.teams.A.melds.length, 0);
});

test('2 no lugar natural pode virar coringa para encaixar uma carta com buraco (2-3-4 + 6)', () => {
  const s = fresh({ config: { drawSeconds: 0, playSeconds: 0 } });
  const m = addMeld(s, 'A', '2D 3D 4D');
  const six = K('6D')[0];
  s.players[0].hand = [six, ...K('9C 9H')]; s.phase = 'PLAYING'; s.turn = { player: 0, deadline: null, drewFrom: 'STOCK' };
  const opts = E.getAddOptions(s, 0, m.id, six.id);
  assert(opts.length >= 1, 'deveria permitir');
  const r = must(play(s, { type: 'ADD_TO_MELD', player: 0, meldId: m.id, cardId: six.id, option: 0 }));
  const meld = r.teams.A.melds[0];
  assert.strictEqual(meld.cards.length, 4);
  assert.strictEqual(meld.cards.filter((e) => e.wild).length, 1);
  assert.deepStrictEqual(meld.cards.map((e) => e.pos), [3, 4, 5, 6]);
});
test('2 natural continua natural quando a carta encaixa sem buraco (2-3-4 + 5)', () => {
  const s = fresh({ config: { drawSeconds: 0, playSeconds: 0 } });
  const m = addMeld(s, 'A', '2D 3D 4D');
  const five = K('5D')[0];
  const opts = E.findAddLayouts(m, five);
  assert.strictEqual(opts[0].wilds, 0);
});
test('partida salva antes da regra: vira vulnerável pelo placar atual e exige os 75 pontos', () => {
  const s = fresh({ config: { drawSeconds: 0, playSeconds: 0 } });
  delete s.config.vulnerableAt; delete s.config.openMin;
  s.teams.A = { melds: [], mortoTaken: false }; s.teams.B = { melds: [], mortoTaken: false };
  s.scores = { A: 2940, B: 1335 };
  s.players[0].hand = K('3S 4S 5S 9C 9D'); s.phase = 'PLAYING'; s.turn = { player: 0, deadline: null, drewFrom: 'STOCK' };
  const r = must(play(s, { type: 'LAY_MELD', player: 0, cardIds: ids(s.players[0].hand.slice(0, 3)), option: 0 }));
  assert.strictEqual(r.teams.A.vulnerable, true); assert.strictEqual(r.teams.B.vulnerable, false);
  const d = play(r, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[3].id });
  assert.strictEqual(d.ok, false); assert.strictEqual(d.error.code, 'OPENING_INCOMPLETE');
});
test('histórico: cada rodada concluída entra em state.history (quem bateu, pontos)', () => {
  let s = E.createGame({ seed: 3, config: { drawSeconds: 0, playSeconds: 0 } });
  s.teams.A.mortoTaken = true; addMeld(s, 'A', '4S 5S 6S 7S 8S 9S 10S');
  s.players[0].hand = K('3C'); s.phase = 'PLAYING'; s.turn = { player: 0, deadline: null, drewFrom: 'STOCK' };
  const r = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(r.history.length, 1); assert.strictEqual(r.history[0].reason, 'BATIDA'); assert.strictEqual(r.history[0].by, 0);
});
test('histórico guarda canastras, bater sem coringa, maior lixo levado e vulnerável', () => {
  let s = E.createGame({ seed: 3, config: { drawSeconds: 0, playSeconds: 0 } });
  s.teams.A.mortoTaken = true; addMeld(s, 'A', '4S 5S 6S 7S 8S 9S 10S');
  s.discard = K('3C 3D 3H 4C 4D 4H 5C 5D 5H 6C 6D');
  s.players[0].hand = K('KC 9H'); s.phase = 'WAITING_TURN'; s.turn = { player: 0, deadline: null, drewFrom: null };
  let r = must(play(s, { type: 'DRAW_DISCARD', player: 0 }));
  assert.strictEqual(r.pile[0], 11);
  r.players[0].hand = K('3C'); // sobra uma carta para bater
  r = must(play(r, { type: 'DISCARD', player: 0, cardId: r.players[0].hand[0].id }));
  const h = r.history[0];
  assert.strictEqual(h.by, 0); assert.strictEqual(h.sem, true); assert.strictEqual(h.lixo, 11);
  assert.strictEqual(h.cnt.A.limpa, 1); assert.strictEqual(h.vul.A, false);
});
test('sem morto na mesa e sem ter pego: dupla com canastra limpa PODE bater (−100 do morto, +100 da batida)', () => {
  const s = fresh({ config: { drawSeconds: 0, playSeconds: 0 } });
  s.mortos = []; s.teams.B.mortoTaken = true; addMeld(s, 'A', '4S 5S 6S 7S 8S 9S 10S');
  s.players[0].hand = K('3C'); s.phase = 'PLAYING'; s.turn = { player: 0, deadline: null, drewFrom: 'STOCK' };
  const r = must(play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }));
  assert.strictEqual(r.roundResult.reason, 'BATIDA');
  const d = r.roundResult.detail.A;
  assert.strictEqual(d.morto, -100); assert.strictEqual(d.batida, 100);
});
test('sem canastra limpa não bate, e a mensagem explica', () => {
  const s = fresh({ config: { drawSeconds: 0, playSeconds: 0 } });
  s.mortos = []; s.teams.B.mortoTaken = true;
  s.players[0].hand = K('3C'); s.phase = 'PLAYING'; s.turn = { player: 0, deadline: null, drewFrom: 'STOCK' };
  const r = play(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.error.code, 'LAST_CARD_RULE');
  assert(/canastra limpa/.test(r.error.message));
});
console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
