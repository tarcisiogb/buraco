/* Faroeste — tela, lobby e sincronização (usa os globais do index.html: S, db, esc, toast, etc.) */
(function () {
  'use strict';
  var FE = window.FaroesteEngine, FA = window.FaroesteArt, BOT = window.FaroesteBot;
  var MAXP = 7, MINP = 4;
  var unsub = null, gameFor = null;
  var FW = function () { return (S.fw = S.fw || { game: null, v: 0, sending: false, sel: [], target: null, rules: false, hist: false, zoom: null, pepe: [], pick: null, lastTurn: null }); };

  // ───────── estilo ─────────
  var css = document.createElement('style');
  css.textContent = [
    '.fwscreen{position:fixed;inset:0;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 0%,#6b4423,#2b1a10);color:#f1e3bf;padding:calc(env(safe-area-inset-top,0px) + 10px) 10px calc(env(safe-area-inset-bottom,0px) + 10px);gap:6px;overflow:hidden;font-family:inherit}',
    '.fwtop{display:flex;align-items:center;gap:8px;flex:none}.fwtop .iconbtn{background:#f1e3bf;color:#2b1a10}',
    '.fwtop .st{flex:1;font-weight:700;font-size:14px;line-height:1.15;min-width:0}',
    '.fwopps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex:none}',
    '.fwopp{background:#00000030;border:2px solid #ffffff22;border-radius:12px;padding:5px 6px;position:relative;min-height:66px;cursor:pointer}',
    '.fwopp.turn{border-color:#e6c15a;box-shadow:0 0 0 2px #e6c15a66}.fwopp.dead{opacity:.45}.fwopp.tgt{border-color:#7fe0a0;box-shadow:0 0 0 3px #7fe0a088;animation:fwp 1s infinite}.fwopp.out{opacity:.5}',
    '@keyframes fwp{50%{box-shadow:0 0 0 6px #7fe0a044}}',
    '.fwopp .nm{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fwopp .ch{font-size:10px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fwopp .bl{display:flex;gap:1px;margin:2px 0;height:12px}.fwb{width:7px;height:12px}',
    '.fwopp .inf{font-size:10px;display:flex;gap:4px;flex-wrap:wrap;align-items:center}.fwopp .rl{position:absolute;top:3px;right:4px;font-size:13px}',
    '.fwmid{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:14px}',
    '.fwpile{display:flex;flex-direction:column;align-items:center;font-size:11px;gap:2px}.fwpile .fwc{width:58px;height:81px;display:block}',
    '.fwlog{max-width:150px;font-size:12px;line-height:1.3;opacity:.95}',
    '.fwme{background:#00000030;border-radius:14px;padding:6px 8px;display:flex;align-items:center;gap:8px;flex:none}.fwme .fwr{width:34px;height:42px}',
    '.fwme .nm{font-weight:700;font-size:13px}.fwme .eq{font-size:11px;display:flex;gap:4px;flex-wrap:wrap}.fwme .bl{display:flex;gap:2px;margin:2px 0}',
    '.eqc{background:#f1e3bf;color:#2b1a10;border-radius:8px;padding:1px 6px;font-weight:700}',
    '.fwhand{display:flex;flex:none;height:108px;padding-top:12px;overflow:hidden;justify-content:center;align-items:flex-end}',
    '.fwh{width:62px;flex:none;cursor:pointer;transition:transform .12s;filter:drop-shadow(0 2px 3px #0008)}.fwh .fwc{width:100%;display:block}.fwh.sel{transform:translateY(-12px)}.fwh.dim{opacity:.4}.fwh.can .fwc{outline:3px solid #e6c15a;border-radius:8px}',
    '.fwbar{display:flex;gap:6px;flex:none}.fwbar .btn{margin:0;flex:1;padding:10px 6px;font-size:14px}',
    '.fwprompt{background:#e6c15a;color:#2b1a10;border-radius:12px;padding:6px 10px;font-weight:700;font-size:13px;flex:none;text-align:center}',
    '.fwmodal{position:fixed;inset:0;background:#000a;display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}.fwmodal .box{background:#f1e3bf;color:#2b1a10;border-radius:16px;padding:14px;max-width:420px;width:100%;max-height:86vh;overflow:auto}',
    '.fwmodal h3{margin:0 0 8px}.fwcards{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0}.fwcards .fwc{width:86px;display:block;cursor:pointer}.fwcards .on .fwc{outline:4px solid #2f5d8a;border-radius:10px}',
    '.fwlob .row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}',
    '.fwbig .fwc{width:180px;display:block;margin:0 auto}'
  ].join('');
  document.head.appendChild(css);

  var EQI = { cavalo: '🐴', luneta: '🔭', barril: '🛢️', cadeia: '⛓️', dinamite: '🧨' };
  var KINDNAME = FE.NAMES;
  var TARGETED = { tiro: 1, assalto: 1, confisco: 1, duelo: 1, cadeia: 1 };
  var ROLE_ICON = { xerife: '⭐', ajudante: '🔰', bandido: '🥷', renegado: '🎭' };
  var ROLE_NAME = { xerife: 'Xerife', ajudante: 'Ajudante', bandido: 'Bandido', renegado: 'Renegado' };
  var CHARS = {}; FE.CHARS.forEach(function (c) { CHARS[c.id] = c; });

  function nm(g, seat) { return g.players[seat] ? g.players[seat].name : '?'; }
  function bullets(hp, max) { var s = ''; for (var i = 0; i < max; i++) s += FA.bulletSvg(i < hp); return s; }

  // ───────── criação / lobby ─────────
  function createMesa() {
    var nome = val('mesa_nome').trim() || ('Faroeste de ' + (S.me.apelido || primeiro(S.me.nome)));
    var seats = [S.user.uid]; for (var i = 1; i < MAXP; i++) seats.push(null);
    mesasCol().add({ nome: nome, criadoPor: S.user.uid, status: 'aguardando', jogo: 'faroeste', seats: seats, criadoEm: firebase.firestore.FieldValue.serverTimestamp() })
      .then(function (ref) { S.mesaId = ref.id; S.pendingMesa = ref.id; S.pendingAt = Date.now(); S._forceRender = true; render(); }).catch(toastErr);
  }
  function seatTx(key, fn) {
    S.seatBusy = S.seatBusy || {}; if (S.seatBusy[key]) return; S.seatBusy[key] = true;
    optSeats(fn);
    var ref = mesasCol().doc(S.mesaId);
    db.runTransaction(function (t) { return t.get(ref).then(function (d) {
      if (!d.exists) throw { message: 'Essa mesa não existe mais.' };
      var m = d.data(); if (m.status !== 'aguardando') throw { message: 'A partida já começou.' };
      var seats = m.seats.slice(); var r = fn(seats, true); if (r === false) return; t.update(ref, { seats: seats });
    }); }).catch(function (e) { toastErr(e); refreshMesa(); }).then(function () { S.seatBusy[key] = false; });
  }
  function sit() {
    var uid = S.user.uid;
    seatTx('sit', function (c, real) {
      if (c.indexOf(uid) >= 0) return false;
      var i = c.indexOf(null); if (i < 0) { if (real) throw { message: 'A mesa está cheia.' }; return false; }
      c[i] = uid;
    });
  }
  function stand() {
    var uid = S.user.uid;
    seatTx('stand', function (c) { var i = c.indexOf(uid); if (i < 0) return false; c[i] = null; });
  }
  function addBots(k) {
    seatTx('bots', function (c) {
      var used = c.filter(isBot), free = shuffleArr([0, 1, 2, 3, 4, 5, 6, 7].filter(function (x) { return used.indexOf('bot:' + x) < 0; })), put = 0;
      for (var i = 0; i < c.length && put < k; i++) if (!c[i]) { c[i] = 'bot:' + free[put++]; }
      if (!put) return false;
    });
  }
  function rmBot(idx) { seatTx('rmbot' + idx, function (c) { if (!isBot(c[idx])) return false; c[idx] = null; }); }
  function start() {
    var ref = mesasCol().doc(S.mesaId);
    db.runTransaction(function (tx) { return tx.get(ref).then(function (d) {
      if (!d.exists) throw { message: 'Essa mesa não existe mais.' };
      var m = d.data(); if (m.status !== 'aguardando') throw { message: 'A partida já começou.' };
      var seats = m.seats.filter(function (x) { return x; });
      if (!seats.some(function (x) { return !isBot(x); })) throw { message: 'Precisa de pelo menos um humano.' };
      if (seats.length < MINP) throw { message: 'Precisa de pelo menos ' + MINP + ' jogadores.' };
      var players = seats.map(function (u) { var p = playerByUid(u); return { id: u, name: p ? (p.apelido || primeiro(p.nome)) : '?' }; });
      var st = FE.createGame({ players: players, seed: Math.floor(Math.random() * 4294967296) });
      tx.set(estadoRef(S.mesaId), { json: JSON.stringify(st), v: 1 });
      tx.update(ref, { status: 'jogando', seats: seats, jogadores: seats, iniciadaEm: firebase.firestore.FieldValue.serverTimestamp() });
    }); }).catch(toastErr);
  }
  function del() {
    var id = S.mesaId; if (!confirm('Excluir esta mesa?')) return;
    estadoRef(id).delete().catch(function () {}).then(function () { return mesasCol().doc(id).delete(); }).then(function () { closeMesa(); }).catch(toastErr);
  }

  function lobbyHtml(m) {
    var me = mySeat(m), n = m.seats.filter(function (x) { return x; }).length, adm = m.criadoPor === S.user.uid || isMaster();
    var h = ['<div class="wrap fwlob"><div class="gtop"><button class="btn ghost mini" data-action="mesa-back">‹ Mesas</button><span class="muted">' + esc(m.nome || 'Mesa') + '</span></div>'];
    h.push('<div class="panel"><div class="eyebrow">Faroeste · de ' + MINP + ' a ' + MAXP + ' jogadores</div><h2 class="ph">Quem vai jogar?</h2><p class="muted" style="margin-top:6px">Cada um recebe um papel secreto. A ordem de chegada define quem fica ao lado de quem.</p>');
    m.seats.forEach(function (u, i) {
      var p = u ? playerByUid(u) : null;
      h.push('<div class="row">' + (p ? avatarMini(p) : '<div class="av empty">·</div>') + '<div class="grow"><div class="t">' + (p ? esc(p.apelido || primeiro(p.nome)) : 'Vaga ' + (i + 1)) + '</div></div>' + (p && p.bot && adm ? '<button class="btn ghost mini" data-action="fw-rmbot" data-id="' + i + '">Tirar</button>' : '') + '</div>');
    });
    h.push('<div class="muted" style="margin:10px 0;text-align:center">' + n + '/' + MAXP + ' jogadores</div>');
    if (me < 0) h.push('<button class="btn gold" data-action="fw-sit"' + (n >= MAXP ? ' disabled' : '') + '>Sentar na mesa</button>');
    else h.push('<button class="btn ghost" data-action="fw-stand">Levantar</button>');
    if (adm) {
      if (n < MAXP) h.push('<div class="randrow"><span>🤖 Colocar bots:</span>' + [1, 2, 3, 4].map(function (k) { return '<button class="btn ghost mini" data-action="fw-addbots" data-id="' + k + '"' + (k <= MAXP - n ? '' : ' disabled') + '>' + k + '</button>'; }).join('') + '</div>');
      h.push('<button class="btn" data-action="fw-start"' + (n >= MINP ? '' : ' disabled') + '>Começar partida (' + n + ' jogadores)</button>');
      h.push('<button class="btn ghost" data-action="fw-del">Excluir mesa</button>');
    } else h.push('<p class="muted" style="margin-top:12px;text-align:center">Quem criou a mesa começa a partida.</p>');
    h.push('</div></div>');
    return h.join('') + (S.toast ? '<div class="toast">' + esc(S.toast) + '</div>' : '');
  }

  // ───────── sincronização ─────────
  function listen(mid) {
    stop(); gameFor = mid;
    unsub = estadoRef(mid).onSnapshot(function (d) { accept(d); }, function () {});
  }
  function accept(d) {
    if (!d || !d.exists) return;
    var f = FW(), data = d.data(), v = data.v || 0;
    if (f.sending && v < f.v) return;
    if (!f.sending && f.game && v === f.v) return;
    if (v < f.v && !f.sending && f.game) return;
    var g; try { g = JSON.parse(data.json); } catch (e) { return; }
    var prev = f.game; f.game = g; f.v = v; clean();
    notify(prev, g);
    render();
  }
  function resync() { if (!S.mesaId) return Promise.resolve(); return estadoRef(S.mesaId).get({ source: 'server' }).then(accept).catch(function () {}); }
  setInterval(function () { var f = S.fw; if (f && f.game && S.mesaId && !f.sending && !document.hidden && gameFor === S.mesaId) resync(); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.fw && S.fw.game && gameFor === S.mesaId) resync(); });
  function stop() {
    if (unsub) { unsub(); unsub = null; } gameFor = null;
    if (S.fw) { S.fw.game = null; S.fw.v = 0; S.fw.sending = false; S.fw.sel = []; S.fw.target = null; S.fw.rules = false; S.fw.hist = false; S.fw.zoom = null; S.fw.pepe = []; S.fw.pick = null; S.fw.lastTurn = null; }
  }
  function clean() {
    var f = FW(), g = f.game, m = S.lastMesa; if (!g || !m) return; var me = mySeat(m); if (me < 0) return;
    var ids = g.players[me].hand.map(function (c) { return c.id; });
    f.sel = f.sel.filter(function (id) { return ids.indexOf(id) >= 0; });
  }
  function notify(prev, g) {
    var me = mySeat(S.lastMesa); if (me < 0) return;
    var mine = FE.whoMustAct(g) === me, was = prev ? FE.whoMustAct(prev) === me : false;
    if (mine && !was && typeof sfx === 'function') { try { sfx('turn'); } catch (e) {} }
  }

  function act(a, quiet) {
    var f = FW();
    if (f.sending) { if (!quiet) toast('Enviando a jogada anterior…'); return; }
    var g = f.game, r = FE.applyAction(g, a);
    if (!r.ok) { if (!quiet) toast(r.error); return; }
    f.game = r.state; f.v = (f.v || 0) + 1; f.sel = []; f.target = null; f.pick = null; f.pepe = [];
    f.sending = true; S._forceRender = true; render();
    var ref = estadoRef(S.mesaId);
    withTimeout(db.runTransaction(function (tx) { return tx.get(ref).then(function (d) {
      var st = JSON.parse(d.data().json), v = (d.data().v || 0) + 1, rr = FE.applyAction(st, a);
      if (!rr.ok) return { ok: false, error: rr.error };
      tx.set(ref, { json: JSON.stringify(rr.state), v: v }); return { ok: true, state: rr.state, v: v };
    }); }), 12000).then(function (res) {
      f.sending = false;
      if (!res.ok) { toast('A jogada não foi aceita: ' + res.error); resync(); }
      else {
        f.game = res.state; f.v = res.v;
        if (res.state.phase === 'GAME_OVER') { mesasCol().doc(S.mesaId).update({ status: 'encerrada' }).catch(function () {}); register(res.state, S.lastMesa); }
      }
      S._forceRender = true; render();
    }).catch(function () { f.sending = false; toast('Sem conexão: jogada não enviada. Tentando sincronizar…'); f.v = 0; resync(); S._forceRender = true; render(); });
  }
  function register(g, m) {
    try {
      var win = g.players.map(function (p) {
        if (g.winner === 'xerife') return p.role === 'xerife' || p.role === 'ajudante';
        if (g.winner === 'bandidos') return p.role === 'bandido';
        return p.role === 'renegado';
      });
      db.collection('partidasFaroeste').doc(S.mesaId).set({
        jogadores: m.seats, nome: m.nome || '', vencedor: g.winner,
        papeis: g.players.map(function (p) { return p.role; }), chars: g.players.map(function (p) { return p.char; }),
        venceu: win, abates: g.players.map(function (p, i) { return (g.kills && g.kills[i]) || 0; }),
        fim: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    } catch (e) {}
  }
  function play(type, extra) { var m = S.lastMesa, a = { type: type, player: mySeat(m) }; for (var k in (extra || {})) a[k] = extra[k]; act(a); }

  // ───────── textos ─────────
  function evText(g, e) {
    var N = function (s) { return nm(g, s); }, K = function (c) { return c && c.kind ? KINDNAME[c.kind] : ''; };
    switch (e.type) {
      case 'TURN': return 'Vez de ' + N(e.seat);
      case 'PLAY': return N(e.seat) + ' jogou ' + K(e.card) + (e.target != null ? ' em ' + N(e.target) : '');
      case 'DAMAGE': return N(e.seat) + ' perdeu ' + e.n + ' vida' + (e.n > 1 ? 's' : '');
      case 'HEAL': return N(e.seat) + ' recuperou vida';
      case 'DODGE': return N(e.seat) + ' se defendeu';
      case 'BARREL_SAVE': return 'Barril salvou ' + N(e.seat);
      case 'SAQUE': return 'Saque: ' + ({ S: '♠', H: '♥', D: '♦', C: '♣' }[e.card.suit]) + e.card.value;
      case 'ELIMINATED': return N(e.seat) + ' foi eliminado (' + ROLE_NAME[e.role] + ')';
      case 'DYNAMITE_BOOM': return 'A Dinamite explodiu em ' + N(e.seat) + '!';
      case 'DYNAMITE_PASS': return 'A Dinamite passou para ' + N(e.to);
      case 'JAIL_ESCAPE': return N(e.seat) + ' saiu da Cadeia';
      case 'JAIL_STAY': return N(e.seat) + ' continua preso e perde a vez';
      case 'STEAL': return N(e.to) + ' roubou de ' + N(e.from);
      case 'FORCE_DISCARD': return N(e.seat) + ' foi obrigado a descartar';
      case 'LOOT': return N(e.seat) + ' ficou com as cartas do eliminado';
      case 'SHERIFF_PENALTY': return N(e.seat) + ' perdeu todas as cartas (eliminou um Ajudante)';
      case 'BLACKJACK': return N(e.seat) + ' comprou mais uma (' + e.card.suit + ')';
      case 'GAME_OVER': return 'Fim de jogo!';
      default: return '';
    }
  }
  function lastLines(g, n) {
    var out = [], L = g.log || [];
    for (var i = L.length - 1; i >= 0 && out.length < n; i--) { var t = evText(g, L[i]); if (t) out.push(t); }
    return out;
  }
  var DESC = {
    tiro: 'Tira 1 vida de um jogador ao alcance da sua arma. O alvo pode se defender com um Errou. Só 1 Tiro por turno (sem restrição com o Repetidor).',
    errou: 'Defesa: descarte para cancelar um Tiro (ou uma Rajada) contra você. Não pode ser jogada por iniciativa própria.',
    tonico: 'Recupera 1 vida (nunca acima do máximo). Também pode ser usado fora do turno para evitar a eliminação.',
    taberna: 'Todos os jogadores vivos recuperam 1 vida.',
    diligencia: 'Compre 2 cartas do baralho.',
    carroca: 'Compre 3 cartas do baralho.',
    armazem: 'Viram-se cartas na mesa, uma por jogador vivo; começando por você, cada um escolhe uma para a mão.',
    assalto: 'Pegue uma carta de outro jogador (da mão, sorteada, ou de um equipamento dele) a distância 1.',
    confisco: 'Faça outro jogador, a qualquer distância, descartar uma carta (da mão, sorteada, ou de um equipamento).',
    rajada: 'Todos os outros jogadores precisam descartar um Errou ou perdem 1 vida.',
    boiada: 'Todos os outros jogadores precisam descartar um Tiro ou perdem 1 vida.',
    duelo: 'Desafie qualquer jogador: ele e você descartam Tiros alternadamente, ele primeiro. Quem não puder perde 1 vida.',
    cavalo: 'Equipamento: os outros jogadores te veem 1 posição mais longe (mais difícil te alcançar).',
    luneta: 'Equipamento: você enxerga todos 1 posição mais perto (alcança mais longe).',
    barril: 'Equipamento: ao ser atacado por um Tiro, faça um Saque; se sair ♥ copas, é como se tivesse jogado um Errou.',
    cadeia: 'Coloque em outro jogador (menos o Xerife). No começo do turno dele, faz-se um Saque: se não sair ♥ copas, ele perde a vez.',
    dinamite: 'Equipamento: no seu turno faz-se um Saque; ♠ de 2 a 9 explode (3 vidas de dano), senão passa para o próximo jogador.',
    repetidor: 'Arma de alcance 1. Permite jogar quantos Tiros quiser no turno.',
    canocurto: 'Arma de alcance 2.',
    pistolalonga: 'Arma de alcance 3.',
    carabina: 'Arma de alcance 4.',
    rifle: 'Arma de alcance 5.'
  };
  function cardsHelp() {
    var order = ['tiro', 'errou', 'tonico', 'taberna', 'diligencia', 'carroca', 'armazem', 'assalto', 'confisco', 'rajada', 'boiada', 'duelo', 'cavalo', 'luneta', 'barril', 'cadeia', 'dinamite', 'repetidor', 'canocurto', 'pistolalonga', 'carabina', 'rifle'];
    return order.map(function (k) { return '<p><b>' + esc(KINDNAME[k]) + '</b> — ' + esc(DESC[k] || '') + '</p>'; }).join('');
  }
  function summaryHtml(g, m, me) {
    var win = function (p) { return g.winner === 'xerife' ? (p.role === 'xerife' || p.role === 'ajudante') : g.winner === 'bandidos' ? p.role === 'bandido' : p.role === 'renegado'; };
    var row = function (p) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #00000018"><div><b>' + esc(p.name) + (p.seat === me ? ' (você)' : '') + '</b><br><span style="font-size:12px">' + esc(ROLE_NAME[p.role]) + ' · ' + esc(CHARS[p.char].nome) + '</span></div>' +
        '<div style="text-align:right;font-size:12px">' + (p.alive ? '❤️ ' + p.hp + ' vida' + (p.hp > 1 ? 's' : '') : '☠️ eliminado') + '<br>🎯 ' + ((g.kills && g.kills[p.seat]) || 0) + ' abate' + (((g.kills && g.kills[p.seat]) || 0) === 1 ? '' : 's') + '</div></div>';
    };
    var w = g.players.filter(win), l = g.players.filter(function (p) { return !win(p); });
    return '<div class="fwmodal"><div class="box" data-stop="1"><h3>🏆 ' + winnerText(g) + '</h3>' +
      '<div style="font-weight:800;margin-top:6px">Vencedores</div>' + w.map(row).join('') +
      '<div style="font-weight:800;margin-top:10px">Perdedores</div>' + l.map(row).join('') +
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn gold" data-action="mesa-back">Voltar às mesas</button><button class="btn ghost" data-action="fw-sum-close">Ver a mesa</button></div></div></div>';
  }
  function winnerText(g) { return g.winner === 'xerife' ? 'O Xerife e os Ajudantes venceram!' : g.winner === 'bandidos' ? 'Os Bandidos venceram!' : 'O Renegado venceu!'; }

  // ───────── tela do jogo ─────────
  function eqChips(p) {
    return p.equip.map(function (e) { return KINDNAME[e.kind] && FE.KINDS[e.kind].w ? '<span class="eqc">🔫 ' + FE.KINDS[e.kind].w + '</span>' : '<span class="eqc">' + (EQI[e.kind] || '•') + '</span>'; }).join('');
  }
  function oppTile(g, v, me, i) {
    var p = v.players[i], f = FW(), isTurn = g.turn.player === i && g.phase !== 'GAME_OVER', tgt = f.target && p.alive && i !== me;
    var ch = CHARS[p.char], must = FE.whoMustAct(g) === i && g.stack.length;
    var d = p.alive ? FE.distance(g, me, i) : null, rng = FE.range(g.players[me]);
    var inf = p.alive ? '<span>🃏' + p.handCount + '</span>' + eqChips(p) + '<span title="distância">📏' + d + (d <= rng ? '' : '✗') + '</span>' : '<span>eliminado</span>';
    return '<div class="fwopp' + (isTurn ? ' turn' : '') + (p.alive ? '' : ' dead') + (tgt ? ' tgt' : '') + '" data-action="fw-opp" data-id="' + i + '">' +
      (p.role ? '<span class="rl">' + ROLE_ICON[p.role] + '</span>' : '') +
      '<div class="nm">' + esc(p.name) + (must && !isTurn ? ' ⏳' : '') + '</div><div class="ch">' + esc(ch ? ch.nome : '') + '</div><div class="bl">' + bullets(Math.max(0, p.hp), p.maxHp) + '</div><div class="inf">' + inf + '</div></div>';
  }
  function handCardHtml(c, extra) {
    return '<div class="fwh ' + (extra || '') + '" data-action="fw-card" data-id="' + c.id + '">' + FA.cardSvg(c) + '</div>';
  }
  function validResponse(g, me) {
    var v = g.stack[g.stack.length - 1]; if (!v) return function () { return false; };
    var p = g.players[me];
    if (v.type === 'volley') { var want = v.kind === 'boiada' ? 'tiro' : 'errou'; return function (c) { return c.kind === want || (p.char === 'valeria' && (c.kind === 'tiro' || c.kind === 'errou')); }; }
    if (v.type === 'duel') return function (c) { return c.kind === 'tiro' || (p.char === 'valeria' && c.kind === 'errou'); };
    if (v.type === 'dying') return function (c) { return c.kind === 'tonico'; };
    return function () { return false; };
  }
  function promptAndBar(g, me, v) {
    var f = FW(), p = g.players[me], must = FE.whoMustAct(g), top = g.stack[g.stack.length - 1], sel = f.sel.length ? p.hand.filter(function (c) { return f.sel.indexOf(c.id) >= 0; }) : [];
    var prompt = '', bar = '';
    if (g.phase === 'GAME_OVER') return { prompt: winnerText(g), bar: '<button class="btn gold" data-action="mesa-back">Voltar às mesas</button>' };
    if (must !== me) {
      var w = g.players[must];
      return { prompt: 'Aguardando ' + (w ? esc(w.name) : '…'), bar: '<button class="btn ghost" data-action="fw-hist">Ver jogadas</button>' };
    }
    if (f.target) return { prompt: 'Escolha o alvo no topo da tela', bar: '<button class="btn ghost" data-action="fw-cancel">Cancelar</button>' };
    if (top) {
      var who = top.source != null ? nm(g, top.source) : '';
      if (top.type === 'volley') {
        prompt = top.kind === 'boiada' ? who + ' soltou a boiada! Descarte um Tiro ou perca 1 vida' : who + ' atirou! Use ' + (top.need > 1 ? top.need + ' Errou' : 'um Errou') + ' ou perca 1 vida';
        bar = '<button class="btn" data-action="fw-resp"' + (sel.length ? '' : ' disabled') + '>Usar carta</button><button class="btn ghost" data-action="fw-pass">Levar o dano</button>';
      } else if (top.type === 'duel') {
        prompt = 'Duelo! Descarte um Tiro ou perca 1 vida'; bar = '<button class="btn" data-action="fw-resp"' + (sel.length ? '' : ' disabled') + '>Descartar Tiro</button><button class="btn ghost" data-action="fw-pass">Desistir</button>';
      } else if (top.type === 'dying') {
        prompt = 'Você vai ser eliminado! Use um Tônico?'; bar = '<button class="btn" data-action="fw-resp"' + (sel.length ? '' : ' disabled') + '>Usar Tônico</button>' + (p.char === 'sid' ? '<button class="btn ghost" data-action="fw-sid"' + (f.sel.length === 2 ? '' : ' disabled') + '>2 cartas = 1 vida</button>' : '') + '<button class="btn ghost" data-action="fw-pass">Aceitar</button>';
      } else if (top.type === 'store') { prompt = 'Armazém: escolha uma carta'; bar = ''; }
      else if (top.type === 'pepe') { prompt = 'Escolha 2 das 3 cartas'; bar = ''; }
      return { prompt: prompt, bar: bar };
    }
    if (g.turn.stage === 'draw') {
      prompt = 'Sua vez! Compre cartas';
      bar = '<button class="btn gold" data-action="fw-draw">Comprar 2 cartas</button>';
      if (p.char === 'pedrao' && g.discard.length) bar += '<button class="btn ghost" data-action="fw-draw-disc">Pegar do descarte</button>';
      if (p.char === 'caca') bar += '<button class="btn ghost" data-action="fw-draw-hand">Da mão de alguém</button>';
      return { prompt: prompt, bar: bar };
    }
    // fase de jogar
    var over = p.hand.length - p.hp;
    prompt = over > 0 ? 'Descarte ' + over + ' carta' + (over > 1 ? 's' : '') + ' para encerrar' : 'Sua vez: jogue cartas ou encerre o turno';
    var c1 = sel[0];
    if (c1 && sel.length === 1) {
      prompt = KINDNAME[c1.kind] + ': ' + (DESC[c1.kind] || '');
      var k = c1.kind, blue = FE.KINDS[k].t === 'azul';
      var asTiro = (p.char === 'valeria' && k === 'errou');
      if (k === 'errou' && !asTiro) bar += '<button class="btn" disabled>Errou só defende</button>';
      else bar += '<button class="btn gold" data-action="fw-playsel">' + (asTiro ? 'Jogar como Tiro' : blue ? 'Equipar' : 'Jogar') + ' ' + (asTiro ? '' : KINDNAME[k]) + '</button>';
      bar += '<button class="btn ghost" data-action="fw-disc">Descartar</button>';
    } else if (f.sel.length === 2 && p.char === 'sid') bar += '<button class="btn gold" data-action="fw-sid">2 cartas = 1 vida</button><button class="btn ghost" data-action="fw-end"' + (over > 0 ? ' disabled' : '') + '>Encerrar turno</button>';
    else bar += '<button class="btn' + (over > 0 ? ' ghost' : ' gold') + '" data-action="fw-end"' + (over > 0 ? ' disabled' : '') + '>Encerrar turno</button>';
    return { prompt: prompt, bar: bar };
  }
  function modals(g, me) {
    var f = FW(), out = '', top = g.stack[g.stack.length - 1];
    if (top && top.type === 'store' && top.order[top.idx] === me) {
      out += '<div class="fwmodal"><div class="box"><h3>Armazém</h3><div class="muted">Escolha uma carta:</div><div class="fwcards">' + top.cards.map(function (c) { return '<div data-action="fw-store" data-id="' + c.id + '">' + FA.cardSvg(c) + '</div>'; }).join('') + '</div></div></div>';
    }
    if (top && top.type === 'pepe' && top.player === me) {
      out += '<div class="fwmodal"><div class="box"><h3>Escolha 2 cartas</h3><div class="fwcards">' + top.cards.map(function (c) { return '<div class="' + (f.pepe.indexOf(c.id) >= 0 ? 'on' : '') + '" data-action="fw-pepe" data-id="' + c.id + '">' + FA.cardSvg(c) + '</div>'; }).join('') + '</div><button class="btn gold" data-action="fw-pepe-ok"' + (f.pepe.length === 2 ? '' : ' disabled') + '>Ficar com essas</button></div></div>';
    }
    if (f.pick) {
      var t = g.players[f.pick.target];
      out += '<div class="fwmodal" data-action="fw-pickclose"><div class="box" data-stop="1"><h3>' + (f.pick.kind === 'assalto' ? 'Roubar de ' : 'Descartar de ') + esc(t.name) + '</h3><button class="btn ghost" data-action="fw-pickgo" data-id="">🃏 Uma carta da mão (aleatória)</button>' +
        t.equip.map(function (e) { return '<button class="btn ghost" data-action="fw-pickgo" data-id="' + e.id + '">' + (FE.KINDS[e.kind].w ? '🔫' : EQI[e.kind] || '') + ' ' + KINDNAME[e.kind] + '</button>'; }).join('') + '<button class="btn ghost" data-action="fw-pickclose">Cancelar</button></div></div>';
    }
    if (f.hist) {
      out += '<div class="fwmodal" data-action="fw-hist-close"><div class="box" data-stop="1"><h3>Últimas jogadas</h3>' + lastLines(g, 14).map(function (t) { return '<div style="padding:4px 0;border-bottom:1px solid #00000018">' + esc(t) + '</div>'; }).join('') + '<button class="btn ghost" data-action="fw-hist-close">Fechar</button></div></div>';
    }
    if (f.zoom != null) {
      var z = g.players[f.zoom], v = FE.viewFor(g, me), zp = v.players[f.zoom];
      out += '<div class="fwmodal" data-action="fw-zoom-close"><div class="box fwbig" data-stop="1"><h3>' + esc(z.name) + '</h3>' + FA.charSvg(z.char, CHARS[z.char].nome, z.maxHp) + '<div style="text-align:center;margin-top:8px">' + (zp.role ? FA.roleSvg(zp.role).replace('class="fwr"', 'class="fwr" width="70"') : '') +
        '<div style="margin-top:6px"><b>' + Math.max(0, z.hp) + '/' + z.maxHp + '</b> vidas · ' + (zp.handCount != null ? zp.handCount : z.hand.length) + ' cartas</div></div>' +
        (z.equip.length ? '<div class="fwcards">' + z.equip.map(function (c) { return '<div>' + FA.cardSvg(c) + '</div>'; }).join('') + '</div>' : '') + '<button class="btn ghost" data-action="fw-zoom-close">Fechar</button></div></div>';
    }
    if (g.phase === 'GAME_OVER' && !f.nosum) out += summaryHtml(g, S.lastMesa, me);
    if (f.rules) out += '<div class="fwmodal" data-action="fw-rules-close"><div class="box" data-stop="1">' + rulesHtml() + '<button class="btn ghost" data-action="fw-rules-close">Fechar</button></div></div>';
    return out;
  }

  function gameHtml(m, me) {
    var f = FW(), g = f.game; S._inGame = true;
    var v = FE.viewFor(g, me), p = g.players[me], ch = CHARS[p.char];
    var others = []; for (var k = 1; k < g.players.length; k++) others.push((me + k) % g.players.length);
    var pb = promptAndBar(g, me), must = FE.whoMustAct(g) === me, resp = (g.stack.length && must) ? validResponse(g, me) : null;
    var head = '<div class="fwtop"><button class="iconbtn" data-action="mesa-back" title="Sair da mesa">‹</button><div class="st">' + (g.phase === 'GAME_OVER' ? winnerText(g) : (g.turn.player === me ? 'Sua vez' : 'Vez de ' + esc(nm(g, g.turn.player)))) + '</div>' +
      '<button class="iconbtn" data-action="fw-hist" title="Jogadas">📜</button><button class="iconbtn" data-action="fw-rules" title="Regras">?</button></div>';
    var opps = '<div class="fwopps">' + others.map(function (i) { return oppTile(g, v, me, i); }).join('') + '</div>';
    var disc = g.discard.length ? FA.cardSvg(g.discard[g.discard.length - 1]) : '<div class="fwc" style="width:58px;height:81px;border:2px dashed #ffffff44;border-radius:8px"></div>';
    var mid = '<div class="fwmid"><div class="fwpile">' + FA.backSvg() + '<span>Monte ' + g.deck.length + '</span></div><div class="fwpile">' + disc + '<span>Descarte</span></div><div class="fwlog">' + lastLines(g, 3).map(function (t) { return '<div>' + esc(t) + '</div>'; }).join('') + '</div></div>';
    var meBox = '<div class="fwme" data-action="fw-zoom" data-id="' + me + '">' + (p.role ? FA.roleSvg(p.role) : '') + '<div style="flex:1;min-width:0"><div class="nm">' + esc(p.name) + ' · ' + esc(ch.nome) + '</div><div class="bl">' + bullets(Math.max(0, p.hp), p.maxHp) + '</div><div class="eq">' + (eqChips(p) || '<span style="opacity:.6">sem equipamentos</span>') + ' <span class="eqc">🔫 ' + FE.range(p) + '</span></div></div></div>';
    var n = p.hand.length, avail = 358, w = 62, ml = n > 1 && n * w > avail ? Math.max(-48, Math.floor((avail - w) / (n - 1)) - w) : 4;
    var hand = '<div class="fwhand">' + p.hand.map(function (c, i) {
      var cls = f.sel.indexOf(c.id) >= 0 ? 'sel' : ''; if (resp) cls += resp(c) ? ' can' : ' dim';
      return '<div style="margin-left:' + (i ? ml : 0) + 'px">' + handCardHtml(c, cls) + '</div>';
    }).join('') + '</div>';
    var prompt = '<div class="fwprompt">' + (pb.prompt || '') + (f.sending ? ' …' : '') + '</div>';
    var bar = '<div class="fwbar">' + pb.bar + '</div>';
    return '<div class="fwscreen">' + head + opps + mid + prompt + meBox + hand + bar + '</div>' + modals(g, me) + (S.toast ? '<div class="toast">' + esc(S.toast) + '</div>' : '');
  }

  // ───────── regras (resumo) ─────────
  function rulesHtml() {
    var D = function (t, b, o) { return '<details class="rg"' + (o ? ' open' : '') + '><summary>' + t + '</summary><div>' + b + '</div></details>'; };
    return '<h3 style="margin:0 0 8px">Regras do Faroeste</h3>' +
      D('Objetivo e papéis', '<p><b>Xerife</b> e <b>Ajudantes</b>: eliminar Bandidos e Renegado. <b>Bandidos</b>: eliminar o Xerife. <b>Renegado</b>: ser o último em pé. Só o Xerife aparece; o resto é secreto.</p>', 1) +
      D('Turno', '<p>1) Compre 2 cartas. 2) Jogue quantas quiser (só 1 Tiro por turno, 1 arma, sem repetir cartas em jogo). 3) Descarte até ter no máximo tantas cartas quanto suas vidas.</p>') +
      D('Distância e alcance', '<p>Conta-se o menor caminho entre vivos. Cavalo Veloz aumenta a distância até você; Luneta diminui a sua. A arma só define o alcance do Tiro (sem arma: 1).</p>') +
      D('Vida', '<p>Tiro tira 1 vida; o alvo pode jogar Errou. O Tônico cura 1 e, no instante em que você levaria o golpe fatal, pode salvar (não vale com 2 jogadores vivos). Quem chega a 0 é eliminado e mostra o papel.</p>') +
      D('Saque', '<p>Vira a carta do topo e descarta. Barril: copas conta como Errou. Cadeia: copas solta; senão perde a vez. Dinamite: ♠ de 2 a 9 explode (3 vidas); senão passa para o próximo.</p>') +
      D('Recompensas', '<p>Eliminar um Bandido: compra 3 cartas. Xerife que elimina um Ajudante perde todas as cartas.</p>') +
      D('Fim', '<p>Xerife eliminado: Bandidos vencem (ou o Renegado, se for o único vivo). Bandidos e Renegado eliminados: Xerife e Ajudantes vencem.</p>') +
      D('Cartas e o que fazem', cardsHelp());
  }

  // ───────── ações da interface ─────────
  function selectedCard() { var f = FW(), me = mySeat(S.lastMesa), p = f.game.players[me]; return p.hand.filter(function (c) { return f.sel.indexOf(c.id) >= 0; })[0]; }
  function handle(act0, id) {
    var f = FW(), m = S.lastMesa, g = f.game, me = m ? mySeat(m) : -1;
    switch (act0) {
      case 'fw-create': createMesa(); break;
      case 'fw-sit': sit(); break;
      case 'fw-stand': stand(); break;
      case 'fw-start': start(); break;
      case 'fw-del': del(); break;
      case 'fw-addbots': addBots(parseInt(id, 10)); break;
      case 'fw-rmbot': rmBot(parseInt(id, 10)); break;
    }
    if (!g || me < 0) return;
    var p = g.players[me];
    switch (act0) {
      case 'fw-card': {
        if (p.char === 'sid') { f.sel = f.sel.indexOf(id) >= 0 ? f.sel.filter(function (x) { return x !== id; }) : f.sel.concat([id]).slice(-2); }
        else f.sel = f.sel.indexOf(id) >= 0 ? f.sel.filter(function (x) { return x !== id; }) : [id];
        S._forceRender = true; render(); break;
      }
      case 'fw-draw': play('DRAW'); break;
      case 'fw-draw-disc': play('DRAW', { source: 'discard' }); break;
      case 'fw-draw-hand': f.target = { kind: 'draw' }; S._forceRender = true; render(); break;
      case 'fw-playsel': {
        var c = selectedCard(); if (!c) break;
        var asTiro = (p.char === 'valeria' && c.kind === 'errou'), kind = asTiro ? 'tiro' : c.kind;
        if (TARGETED[kind]) { f.target = { kind: 'play', cardId: c.id, as: asTiro ? 'tiro' : null, ckind: kind }; S._forceRender = true; render(); }
        else play('PLAY', { cardId: c.id });
        break;
      }
      case 'fw-opp': {
        var t = parseInt(id, 10);
        if (f.target) {
          if (t === me || !g.players[t].alive) { toast('Escolha outro jogador.'); break; }
          if (f.target.kind === 'draw') { play('DRAW', { source: 'hand', target: t }); break; }
          var ck = f.target.ckind, tp = g.players[t];
          if ((ck === 'assalto' || ck === 'confisco') && tp.equip.length) { f.pick = { kind: ck, target: t, cardId: f.target.cardId }; f.target = null; S._forceRender = true; render(); break; }
          var a = { cardId: f.target.cardId, target: t }; if (f.target.as) a.as = f.target.as; play('PLAY', a); break;
        }
        f.zoom = t; S._forceRender = true; render(); break;
      }
      case 'fw-pickgo': { var pk = f.pick; var a2 = { cardId: pk.cardId, target: pk.target }; if (id) a2.targetCardId = id; play('PLAY', a2); break; }
      case 'fw-pickclose': f.pick = null; S._forceRender = true; render(); break;
      case 'fw-cancel': f.target = null; S._forceRender = true; render(); break;
      case 'fw-disc': { var dc = selectedCard(); if (dc) play('DISCARD', { cardId: dc.id }); break; }
      case 'fw-end': play('END_TURN'); break;
      case 'fw-resp': { var rc = selectedCard(); if (rc) play('RESPOND', { cardId: rc.id }); break; }
      case 'fw-pass': play('RESPOND', { pass: true }); break;
      case 'fw-sid': play('HEAL_DISCARD', { cardIds: f.sel.slice(0, 2) }); break;
      case 'fw-store': play('RESPOND', { cardId: id }); break;
      case 'fw-pepe': f.pepe = f.pepe.indexOf(id) >= 0 ? f.pepe.filter(function (x) { return x !== id; }) : (f.pepe.length < 2 ? f.pepe.concat([id]) : f.pepe); S._forceRender = true; render(); break;
      case 'fw-pepe-ok': play('PICK', { cardIds: f.pepe.slice() }); break;
      case 'fw-hist': f.hist = true; S._forceRender = true; render(); break;
      case 'fw-hist-close': f.hist = false; S._forceRender = true; render(); break;
      case 'fw-rules': f.rules = true; S._forceRender = true; render(); break;
      case 'fw-sum-close': f.nosum = true; S._forceRender = true; render(); break;
      case 'fw-rules-close': f.rules = false; S._forceRender = true; render(); break;
      case 'fw-zoom': f.zoom = parseInt(id, 10); S._forceRender = true; render(); break;
      case 'fw-zoom-close': f.zoom = null; S._forceRender = true; render(); break;
    }
  }

  var botTimer = null;
  function botDrive() {
    var f = FW(), g = f.game, m = S.lastMesa;
    if (!g || !m || !S.user || !BOT || g.phase === 'GAME_OVER') return;
    var me = mySeat(m); if (me < 0) return;
    var bots = [], humans = [];
    m.seats.forEach(function (u, i) { if (isBot(u)) bots.push(i); else if (u) humans.push(i); });
    if (!bots.length) return;
    var a; try { a = BOT.pendingAction(g, bots); } catch (e) { a = null; }
    clearTimeout(botTimer); botTimer = null;
    if (!a) return;
    var rank = Math.max(0, humans.indexOf(me));
    botTimer = setTimeout(function () {
      botTimer = null;
      if (f.sending || f.game !== g) { f.botSeen = null; S._forceRender = true; render(); return; }
      var a2; try { a2 = BOT.pendingAction(f.game, bots); } catch (e) { a2 = null; }
      if (a2) act(a2, true);
    }, 2200 + rank * 3500);
  }
  function view(m) {
    var f = FW();
    if (m.status === 'aguardando') { if (gameFor) stop(); return lobbyHtml(m); }
    var me = mySeat(m);
    if (me < 0) return '<div class="wrap"><div class="panel" style="text-align:center"><h2 class="ph">Partida em andamento</h2><p class="muted" style="margin-top:8px">Você não está sentado nesta mesa.</p><button class="btn ghost" data-action="mesa-back">Voltar</button></div></div>';
    if (gameFor !== S.mesaId) listen(S.mesaId);
    if (!f.game) return '<div class="wrap">' + viewLoading() + '</div>';
    var html = gameHtml(m, me);
    if (f.botSeen !== f.game) { f.botSeen = f.game; setTimeout(botDrive, 0); }
    return html;
  }

  window.FaroesteUI = { view: view, handle: handle, stop: stop, rulesHtml: rulesHtml, createMesa: createMesa, MAXP: MAXP, act: act };
})();
