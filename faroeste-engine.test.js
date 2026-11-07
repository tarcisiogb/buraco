const E = require('./faroeste-engine.js');
let ok = 0, bad = 0;
function t(name, fn) { try { fn(); ok++; console.log('ok  ' + name); } catch (e) { bad++; console.log('ERRO ' + name + ': ' + e.message); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' esperado ' + JSON.stringify(b) + ' obteve ' + JSON.stringify(a)); };
const yes = (v, m) => { if (!v) throw new Error(m || 'falso'); };
let uid = 0;
const C = (kind, suit, value) => ({ id: 'x' + (uid++), kind, suit: suit || 'C', value: value || 5 });

/** monta estado controlado: n jogadores, papéis, personagens, mãos; turno do assento 0 já na fase 'play' */
function mk(n, opts) {
  opts = opts || {};
  const s = E.createGame({ players: Array.from({ length: n }, (_, i) => ({ id: 'u' + i, name: 'J' + i })), seed: 1 });
  const roles = opts.roles || E.ROLES[n];
  s.players.forEach((p, i) => { p.role = roles[i]; p.char = (opts.chars || [])[i] || 'joca'.replace('joca', 'paco') && ((opts.chars || [])[i] || 'zzz'); p.maxHp = 4 + (p.role === 'xerife' ? 1 : 0); p.hp = p.maxHp; p.hand = []; p.equip = []; p.alive = true; });
  s.stack = []; s.discard = []; s.winner = null; s.phase = 'PLAYING';
  s.deck = []; for (let i = 0; i < 40; i++) s.deck.push(C('errou', 'D', 3));
  s.turn = { player: 0, stage: 'play', bangs: 0, drew: true, over: false };
  return s;
}
const act = (s, a) => { const r = E.applyAction(s, a); if (!r.ok) throw new Error('ação recusada: ' + r.error); return r.state; };
const refuse = (s, a, frag) => { const r = E.applyAction(s, a); yes(!r.ok, 'deveria recusar'); if (frag) yes(r.error.indexOf(frag) >= 0, 'msg: ' + r.error); };

t('4 a 7 jogadores, papéis e vidas', () => {
  for (let n = 4; n <= 7; n++) {
    const s = E.createGame({ players: Array.from({ length: n }, (_, i) => ({ id: 'u' + i, name: 'J' + i })), seed: n });
    eq(s.players.map((p) => p.role).sort(), E.ROLES[n].slice().sort());
    const sh = s.players.find((p) => p.role === 'xerife');
    eq(s.turn.player, sh.seat); eq(s.deck.length, 80 - s.players.reduce((a, p) => a + p.hand.length, 0));
    s.players.forEach((p) => eq(p.hand.length, p.maxHp));
  }
});
t('baralho tem 80 cartas com as quantidades combinadas', () => {
  const s = E.createGame({ players: [0, 1, 2, 3].map((i) => ({ id: 'u' + i, name: 'J' + i })), seed: 3 });
  const all = s.deck.concat.apply(s.deck, s.players.map((p) => p.hand));
  eq(all.length, 80);
  const cnt = {}; all.forEach((c) => cnt[c.kind] = (cnt[c.kind] || 0) + 1);
  eq(Object.keys(cnt).sort().map((k) => k + cnt[k]), Object.keys(E.COUNTS).sort().map((k) => k + E.COUNTS[k]));
  eq(all.filter((c) => c.suit === 'H').length, 20);
});
t('distância com 2 jogadores vizinhos e circular', () => {
  const s = mk(6);
  eq(E.distance(s, 0, 1), 1); eq(E.distance(s, 0, 3), 3); eq(E.distance(s, 0, 5), 1); eq(E.distance(s, 0, 4), 2);
});
t('Cavalo Veloz +1 e Luneta -1 (mínimo 1)', () => {
  const s = mk(6);
  s.players[3].equip.push(C('cavalo')); eq(E.distance(s, 0, 3), 4);
  s.players[0].equip.push(C('luneta')); eq(E.distance(s, 0, 3), 3); eq(E.distance(s, 0, 1), 1);
});
t('jogador eliminado deixa de contar na distância', () => {
  const s = mk(6); s.players[1].alive = false; s.players[1].hp = 0;
  eq(E.distance(s, 0, 2), 1);
});
t('Tiro: fora de alcance é recusado; com arma alcança', () => {
  const s = mk(6); s.players[0].hand = [C('tiro'), C('rifle')];
  refuse(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 3 }, 'alcance');
  const s2 = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[1].id });
  const s3 = act(s2, { type: 'PLAY', player: 0, cardId: s2.players[0].hand[0].id, target: 3 });
  eq(s3.players[3].hp, 3);
});
t('Tiro: alvo se defende com Errou', () => {
  const s = mk(4); s.players[0].hand = [C('tiro')]; s.players[1].hand = [C('errou'), C('tiro')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(E.whoMustAct(r), 1);
  r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id });
  eq(r.players[1].hp, 5 - 1 + 0 || 4); eq(r.stack.length, 0);
});
t('Tiro: sem resposta perde 1 vida', () => {
  const s = mk(4); s.players[0].hand = [C('tiro')]; s.players[1].hand = [C('tiro')];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(r.players[1].hp, 3); eq(r.stack.length, 0);
});
t('Só 1 Tiro por turno; Repetidor libera', () => {
  const s = mk(4); s.players[0].hand = [C('tiro'), C('tiro')]; s.players[1].hand = [];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  refuse(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id, target: 1 }, '1 Tiro');
  const s2 = mk(4); s2.players[0].hand = [C('tiro'), C('tiro')]; s2.players[0].equip.push(C('repetidor'));
  r = act(s2, { type: 'PLAY', player: 0, cardId: s2.players[0].hand[0].id, target: 1 });
  r = act(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id, target: 3 });
  eq(r.players[3].hp, 3);
});
t('Barril: copas cancela, outro naipe não', () => {
  let s = mk(4); s.players[0].hand = [C('tiro')]; s.players[1].equip.push(C('barril')); s.players[1].hand = [];
  s.deck.unshift(C('errou', 'H', 9));
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hp, 4);
  s = mk(4); s.players[0].hand = [C('tiro')]; s.players[1].equip.push(C('barril')); s.players[1].hand = [];
  s.deck.unshift(C('errou', 'S', 9));
  r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hp, 3);
});
t('Armas: só 1; a nova descarta a anterior', () => {
  const s = mk(4); s.players[0].hand = [C('rifle'), C('canocurto')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id });
  r = act(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id });
  eq(r.players[0].equip.length, 1); eq(r.players[0].equip[0].kind, 'canocurto'); eq(E.range(r.players[0]), 2);
});
t('Não pode ter duas cartas iguais em jogo', () => {
  const s = mk(4); s.players[0].hand = [C('cavalo'), C('cavalo')];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id });
  refuse(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id }, 'em jogo');
});
t('Tônico cura, mas não passa do máximo', () => {
  const s = mk(4); s.players[0].hand = [C('tonico')];
  refuse(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id }, 'cheia');
  s.players[0].hp = 2; const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id }); eq(r.players[0].hp, 3);
});
t('Taberna cura todos os vivos', () => {
  const s = mk(5); s.players.forEach((p) => p.hp = 2); s.players[3].alive = false; s.players[0].hand = [C('taberna')];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id });
  eq(r.players.filter((p) => p.alive).map((p) => p.hp), [3, 3, 3, 3]);
});
t('Diligência e Carroça compram 2 e 3', () => {
  const s = mk(4); s.players[0].hand = [C('diligencia'), C('carroca')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id }); eq(r.players[0].hand.length, 3);
  r = act(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand.find((x) => x.kind === 'carroca').id }); eq(r.players[0].hand.length, 5);
});
t('Assalto só a distância 1, rouba carta; Confisco descarta', () => {
  const s = mk(6); s.players[0].hand = [C('assalto'), C('confisco')]; s.players[2].hand = [C('tiro')]; s.players[1].hand = [C('errou')];
  refuse(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 2 }, 'distância');
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(r.players[0].hand.map((x) => x.kind), ['confisco', 'errou']); eq(r.players[1].hand.length, 0);
  r = act(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id, target: 2 });
  eq(r.players[2].hand.length, 0); eq(r.discard.length, 3);
});
t('Assalto em carta em jogo à escolha', () => {
  const s = mk(4); s.players[0].hand = [C('assalto')]; const h = C('luneta'); s.players[1].equip.push(h);
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1, targetCardId: h.id });
  eq(r.players[1].equip.length, 0); eq(r.players[0].hand[0].kind, 'luneta');
});
t('Rajada atinge todos os outros; Errou defende; não conta como Tiro', () => {
  const s = mk(4); s.players[0].hand = [C('rajada'), C('tiro')]; s.players[1].hand = [C('errou')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id });
  eq(E.whoMustAct(r), 1);
  r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id });
  eq(r.players.map((p) => p.hp), [5, 4, 3, 3].map((v, i) => i === 0 ? 5 : (i === 1 ? 4 : 3)).map((v, i) => i === 0 ? 5 : v));
  r = act(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id, target: 1 }); // ainda pode dar 1 Tiro
  eq(r.players[1].hp, 3);
});
t('Estouro da Boiada: Tiro descartado salva; sem Tiro perde vida', () => {
  const s = mk(4); s.players[0].hand = [C('boiada')]; s.players[1].hand = [C('tiro')]; s.players[2].hand = [C('errou')]; s.players[3].hand = [];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id });
  eq(E.whoMustAct(r), 1); r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id });
  eq(r.players[1].hp, 4); eq(r.players[2].hp, 3); eq(r.players[3].hp, 3);
});
t('Duelo alterna Tiros e quem falha perde 1 vida', () => {
  const s = mk(4); s.players[0].hand = [C('duelo'), C('tiro')]; s.players[1].hand = [C('tiro')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(E.whoMustAct(r), 1); r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id });
  eq(E.whoMustAct(r), 0); r = act(r, { type: 'RESPOND', player: 0, cardId: r.players[0].hand[0].id });
  eq(E.whoMustAct(r), 1); r = act(r, { type: 'RESPOND', player: 1, pass: true });
  eq(r.players[1].hp, 3); eq(r.stack.length, 0);
});
t('Armazém: cada um escolhe uma carta, a partir de quem jogou', () => {
  const s = mk(4); s.players[0].hand = [C('armazem')];
  s.deck = [C('tiro'), C('errou'), C('tonico'), C('rifle')].concat(s.deck);
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id });
  const v = r.stack[0]; eq(v.cards.length, 4);
  for (let seat = 0; seat < 4; seat++) { eq(E.whoMustAct(r), seat); r = act(r, { type: 'RESPOND', player: seat, cardId: r.stack[0].cards[0].id }); }
  eq(r.stack.length, 0); eq(r.players.map((p) => p.hand.length), [1, 1, 1, 1]);
});
t('Cadeia: ♥ solta; outro naipe pula a vez; não prende o Xerife', () => {
  let s = mk(4, { roles: ['bandido', 'xerife', 'bandido', 'renegado'] }); s.players[0].hand = [C('cadeia')];
  refuse(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }, 'Xerife');
  s.players[0].hand = [C('cadeia')];
  s.players[3].hand = [];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 2 });
  eq(r.players[2].equip[0].kind, 'cadeia');
  // fim do turno do 0 -> vez do 1; 1 termina -> vez do 2 que está preso
  r.players[0].hand = []; r = act(r, { type: 'END_TURN', player: 0 });
  r.deck.unshift(C('errou', 'S', 4)); r.players[1].hand = [];
  r = act(r, { type: 'DRAW', player: 1 }); r = act(r, { type: 'END_TURN', player: 1 });
  // saque da cadeia do 2 (topo: ♠) -> pula para o 3
  eq(r.turn.player, 3 - 0 === 3 ? 3 : 3);
  // com ♥ solta
  let q = mk(4); q.players[0].hand = [C('cadeia')]; q.players[1].hand = [];
  q = act(q, { type: 'PLAY', player: 0, cardId: q.players[0].hand[0].id, target: 2 });
  q.players[0].hand = []; q = act(q, { type: 'END_TURN', player: 0 });
  q = act(q, { type: 'DRAW', player: 1 }); q.deck.unshift(C('errou', 'H', 4)); q = act(q, { type: 'END_TURN', player: 1 });
  eq(q.turn.player, 2); eq(q.turn.stage, 'draw'); eq(q.players[2].equip.length, 0);
});
t('Dinamite: explode com ♠2-9 (3 vidas); senão passa à esquerda', () => {
  let s = mk(4); s.players[1].equip.push(C('dinamite')); s.players[0].hand = [];
  s.deck.unshift(C('errou', 'S', 5)); s.players[1].hand = [];
  let r = act(s, { type: 'END_TURN', player: 0 });
  eq(r.players[1].hp, 1); eq(r.players[1].equip.length, 0);
  s = mk(4); s.players[1].equip.push(C('dinamite')); s.players[0].hand = []; s.deck.unshift(C('errou', 'S', 12));
  r = act(s, { type: 'END_TURN', player: 0 });
  eq(r.players[1].hp, 4); eq(r.players[2].equip[0].kind, 'dinamite');
});
t('Dinamite mata sem recompensa e a vez passa', () => {
  const s = mk(4); s.players[1].equip.push(C('dinamite')); s.players[1].hp = 3; s.players[1].hand = []; s.players[0].hand = [];
  s.deck.unshift(C('errou', 'S', 5));
  const r = act(s, { type: 'END_TURN', player: 0 });
  yes(!r.players[1].alive); eq(r.turn.player, 2);
});
t('Dinamite: Tônico salva antes de morrer', () => {
  const s = mk(4); s.players[1].equip.push(C('dinamite')); s.players[1].hp = 3; s.players[1].hand = [C('tonico'), C('tonico')]; s.players[0].hand = [];
  s.deck.unshift(C('errou', 'S', 5));
  let r = act(s, { type: 'END_TURN', player: 0 });
  eq(E.whoMustAct(r), 1); r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id });
  eq(r.players[1].hp, 1); yes(r.players[1].alive); eq(r.turn.player, 1); eq(r.turn.stage, 'draw');
});
t('Tônico em risco de morte; com 2 jogadores vivos não vale', () => {
  const s = mk(4); s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [C('tonico')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(E.whoMustAct(r), 1); r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id });
  eq(r.players[1].hp, 1); yes(r.players[1].alive);
  const s2 = mk(4); s2.players[2].alive = false; s2.players[3].alive = false; s2.players[0].hand = [C('tiro')]; s2.players[1].hp = 1; s2.players[1].hand = [C('tonico')];
  const r2 = act(s2, { type: 'PLAY', player: 0, cardId: s2.players[0].hand[0].id, target: 1 });
  yes(!r2.players[1].alive);
});
t('Eliminar Bandido dá 3 cartas; Xerife que mata Ajudante perde tudo', () => {
  let s = mk(5, { roles: ['bandido', 'bandido', 'xerife', 'ajudante', 'renegado'] }); s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  yes(!r.players[1].alive); eq(r.players[0].hand.length, 3);
  s = mk(5, { roles: ['xerife', 'ajudante', 'bandido', 'bandido', 'renegado'] }); s.players[0].hand = [C('tiro'), C('errou')]; s.players[0].equip.push(C('cavalo')); s.players[1].hp = 1; s.players[1].hand = [];
  r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(r.players[0].hand.length, 0); eq(r.players[0].equip.length, 0);
});
t('Fim: Xerife morto -> Bandidos; só Renegado -> Renegado; sem Bandidos/Renegado -> Xerife', () => {
  let s = mk(4, { roles: ['bandido', 'xerife', 'bandido', 'renegado'] }); s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(r.phase, 'GAME_OVER'); eq(r.winner, 'bandidos');
  s = mk(4, { roles: ['renegado', 'xerife', 'bandido', 'bandido'] }); s.players[2].alive = false; s.players[3].alive = false;
  s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [];
  r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.winner, 'renegado');
  s = mk(4, { roles: ['xerife', 'bandido', 'bandido', 'renegado'] }); s.players[2].alive = false; s.players[3].alive = false;
  s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [];
  r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.winner, 'xerife');
  s = mk(5, { roles: ['xerife', 'bandido', 'ajudante', 'bandido', 'renegado'] }); s.players[3].alive = false; s.players[4].alive = false;
  s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [];
  r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.winner, 'xerife');
  // Xerife morto, Renegado + Ajudante vivos: Bandidos vencem
  s = mk(5, { roles: ['bandido', 'xerife', 'ajudante', 'renegado', 'bandido'] }); s.players[4].alive = false;
  s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [];
  r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.winner, 'bandidos');
});
t('Fim de turno: descarte até o limite da vida; depois passa a vez', () => {
  const s = mk(4); s.players[0].hand = [C('tiro'), C('tiro'), C('tiro'), C('tiro'), C('tiro'), C('tiro')]; // vida 5
  refuse(s, { type: 'END_TURN', player: 0 }, 'Descarte');
  let r = act(s, { type: 'DISCARD', player: 0, cardId: s.players[0].hand[0].id }); r = act(r, { type: 'END_TURN', player: 0 });
  eq(r.turn.player, 1); eq(r.turn.stage, 'draw');
});
t('Vez: ações fora de turno e sem comprar são recusadas', () => {
  const s = mk(4); s.turn.stage = 'draw'; s.players[0].hand = [C('tiro')];
  refuse(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }, 'Compre');
  refuse(s, { type: 'DRAW', player: 1 }, 'vez');
  const r = act(s, { type: 'DRAW', player: 0 }); eq(r.players[0].hand.length, 3); refuse(r, { type: 'DRAW', player: 0 }, 'comprou');
});
t('Monte acaba: descarte é embaralhado', () => {
  const s = mk(4); s.turn.stage = 'draw'; s.deck = [C('tiro')]; s.discard = [C('errou'), C('errou'), C('errou')];
  const r = act(s, { type: 'DRAW', player: 0 }); eq(r.players[0].hand.length, 2); eq(r.deck.length, 2);
});
// ── Personagens ──
t('Tião Pistola: compra ao perder vida', () => {
  const s = mk(4, { chars: [0, 'tiao'] }); s.players[0].hand = [C('tiro')]; s.players[1].hand = [];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hand.length, 1);
});
t('Dona Valéria: Tiro vale como Errou', () => {
  const s = mk(4, { chars: [0, 'valeria'] }); s.players[0].hand = [C('tiro')]; s.players[1].hand = [C('tiro')];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  eq(E.whoMustAct(r), 1); r = act(r, { type: 'RESPOND', player: 1, cardId: r.players[1].hand[0].id }); eq(r.players[1].hp, 4);
});
t('Zé do Gringo: rouba carta de quem o feriu', () => {
  const s = mk(4, { chars: [0, 'zegringo'] }); s.players[0].hand = [C('tiro'), C('tonico')]; s.players[1].hand = [];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hand.map((x) => x.kind), ['tonico']);
});
t('Cacá Ligeiro: 1ª carta da mão de outro', () => {
  const s = mk(4, { chars: ['caca'] }); s.turn.stage = 'draw'; s.players[1].hand = [C('rifle')];
  const r = act(s, { type: 'DRAW', player: 0, source: 'hand', target: 1 }); eq(r.players[0].hand.length, 2); eq(r.players[1].hand.length, 0);
});
t('Pedrão Sorte: 1ª do descarte', () => {
  const s = mk(4, { chars: ['pedrao'] }); s.turn.stage = 'draw'; s.discard = [C('rifle')];
  const r = act(s, { type: 'DRAW', player: 0, source: 'discard' }); eq(r.players[0].hand.map((x) => x.kind).sort(), ['errou', 'rifle']);
});
t('Pepe Almanaque: vê 3, fica com 2, devolve 1 ao topo', () => {
  const s = mk(4, { chars: ['pepe'] }); s.turn.stage = 'draw'; s.deck = [C('tiro'), C('rifle'), C('tonico'), C('errou')];
  let r = act(s, { type: 'DRAW', player: 0 }); eq(E.whoMustAct(r), 0); eq(r.stack[0].cards.length, 3);
  const [a, b, c3] = r.stack[0].cards; r = act(r, { type: 'PICK', player: 0, cardIds: [a.id, c3.id] });
  eq(r.players[0].hand.length, 2); eq(r.deck[0].id, b.id); eq(r.turn.stage, 'play');
});
t('Madame Berenice: Barril embutido', () => {
  const s = mk(4, { chars: [0, 'berenice'] }); s.players[0].hand = [C('tiro')]; s.players[1].hand = []; s.deck.unshift(C('errou', 'H', 3));
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hp, 4);
});
t('Paco Foragido +1 distância; Rosinha -1', () => {
  const s = mk(6, { chars: [0, 0, 'paco', 0, 0, 0] }); eq(E.distance(s, 0, 2), 3);
  const q = mk(6, { chars: ['rosinha'] }); eq(E.distance(q, 0, 3), 2);
});
t('Nando Matador: precisa de 2 Errou', () => {
  const s = mk(4, { chars: ['nando'] }); s.players[0].hand = [C('tiro')]; s.players[1].hand = [C('errou')];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hp, 3); // só 1 Errou: não adianta
  const q = mk(4, { chars: ['nando'] }); q.players[0].hand = [C('tiro')]; q.players[1].hand = [C('errou'), C('errou')];
  let r2 = act(q, { type: 'PLAY', player: 0, cardId: q.players[0].hand[0].id, target: 1 });
  r2 = act(r2, { type: 'RESPOND', player: 1, cardId: r2.players[1].hand[0].id }); eq(E.whoMustAct(r2), 1);
  r2 = act(r2, { type: 'RESPOND', player: 1, cardId: r2.players[1].hand[0].id }); eq(r2.players[1].hp, 4);
});
t('Suzana Recarga: compra quando a mão esvazia', () => {
  const s = mk(4, { chars: ['suzana'] }); s.players[0].hand = [C('rifle')];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id }); eq(r.players[0].hand.length, 1);
});
t('Abutre Samuel: leva as cartas de quem é eliminado', () => {
  const s = mk(5, { chars: [0, 0, 0, 'abutre'], roles: ['bandido', 'bandido', 'xerife', 'ajudante', 'renegado'] });
  s.players[0].hand = [C('tiro')]; s.players[1].hp = 1; s.players[1].hand = [C('rifle'), C('cavalo')];
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[3].hand.length, 2);
});
t('Joca Sem-Limite: vários Tiros', () => {
  const s = mk(4, { chars: ['joca'] }); s.players[0].hand = [C('tiro'), C('tiro')]; s.players[1].hand = [];
  let r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 });
  r = act(r, { type: 'PLAY', player: 0, cardId: r.players[0].hand[0].id, target: 1 }); eq(r.players[1].hp, 2);
});
t('Black Jack Rubião: ♥/♦ na 2ª carta compra mais 1', () => {
  const s = mk(4, { chars: ['blackjack'] }); s.turn.stage = 'draw'; s.deck = [C('tiro', 'S'), C('tiro', 'H'), C('rifle'), C('errou')];
  const r = act(s, { type: 'DRAW', player: 0 }); eq(r.players[0].hand.length, 3);
});
t('Sid Remendo: 2 cartas = 1 vida', () => {
  const s = mk(4, { chars: ['sid'] }); s.players[0].hp = 2; s.players[0].hand = [C('tiro'), C('tiro'), C('errou')];
  const r = act(s, { type: 'HEAL_DISCARD', player: 0, cardIds: [s.players[0].hand[0].id, s.players[0].hand[1].id] }); eq(r.players[0].hp, 3); eq(r.players[0].hand.length, 1);
});
t('Duque Trevo: no saque, usa a melhor de 2 cartas', () => {
  const s = mk(4, { chars: [0, 'duque'] }); s.players[0].hand = [C('tiro')]; s.players[1].equip.push(C('barril')); s.players[1].hand = [];
  s.deck.unshift(C('errou', 'S', 9)); s.deck.unshift(C('errou', 'H', 9)); // ♥ + ♠: escolhe ♥
  const r = act(s, { type: 'PLAY', player: 0, cardId: s.players[0].hand[0].id, target: 1 }); eq(r.players[1].hp, 4);
});
t('viewFor esconde mãos, monte e papéis alheios', () => {
  const s = mk(5); s.players[2].hand = [C('rifle')];
  const v = E.viewFor(s, 0);
  eq(v.players[2].hand, []); eq(v.players[2].handCount, 1); eq(v.deck.count, 40);
  yes(v.players[2].role === null || v.players[2].role === 'xerife');
  yes(v.players[0].role === 'xerife'); // assento 0 é o Xerife em mk()
  const v2 = E.viewFor(s, 2); yes(v2.players[2].role === 'ajudante' || v2.players[2].role); yes(v2.players[3].role === null);
});
t('Partidas aleatórias terminam sem erros (fuzz)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const n = 4 + (seed % 4);
    let s = E.createGame({ players: Array.from({ length: n }, (_, i) => ({ id: 'u' + i, name: 'J' + i })), seed: seed });
    let steps = 0; const rr = (() => { let x = seed * 9301 + 49297; return () => (x = (x * 9301 + 49297) % 233280) / 233280; })();
    while (s.phase !== 'GAME_OVER' && steps++ < 4000) {
      const who = E.whoMustAct(s); if (who == null) throw new Error('travou sem ninguém para agir (seed ' + seed + ')');
      const p = s.players[who], cands = [];
      const top = s.stack[s.stack.length - 1];
      if (top) {
        if (top.type === 'pepe') cands.push({ type: 'PICK', player: who, cardIds: [top.cards[0].id, top.cards[1].id] });
        else if (top.type === 'store') top.cards.forEach((c) => cands.push({ type: 'RESPOND', player: who, cardId: c.id }));
        else { p.hand.forEach((c) => cands.push({ type: 'RESPOND', player: who, cardId: c.id })); cands.push({ type: 'RESPOND', player: who, pass: true }); }
      } else if (s.turn.stage === 'draw') cands.push({ type: 'DRAW', player: who });
      else {
        p.hand.forEach((c) => { s.players.forEach((q) => { if (q.alive && q.seat !== who) cands.push({ type: 'PLAY', player: who, cardId: c.id, target: q.seat }); }); cands.push({ type: 'PLAY', player: who, cardId: c.id }); });
        if (p.hand.length > p.hp) p.hand.forEach((c) => cands.push({ type: 'DISCARD', player: who, cardId: c.id })); else cands.push({ type: 'END_TURN', player: who }, { type: 'END_TURN', player: who });
      }
      let moved = false;
      for (let k = 0; k < 40 && !moved; k++) { const a = cands[Math.floor(rr() * cands.length)]; const r = E.applyAction(s, a); if (r.ok) { s = r.state; moved = true; } }
      if (!moved) { // tenta qualquer coisa possível
        for (const a of cands) { const r = E.applyAction(s, a); if (r.ok) { s = r.state; moved = true; break; } }
      }
      if (!moved) throw new Error('sem ação válida (seed ' + seed + ', fase ' + s.turn.stage + ')');
    }
    yes(s.phase === 'GAME_OVER', 'não terminou (seed ' + seed + ')');
    const tot = s.deck.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length + p.equip.length, 0) + s.stack.reduce((a, v) => a + (v.cards ? v.cards.length : 0), 0);
    eq(tot, 80, 'cartas somem/aparecem (seed ' + seed + ')');
  }
});
console.log(ok + ' passaram, ' + bad + ' falharam'); process.exit(bad ? 1 : 0);
