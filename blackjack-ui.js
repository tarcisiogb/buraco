/* Blackjack — tela, lobby e sincronização (usa os globais do index.html: S, db, esc, toast, cardHtml, etc.) */
(function () {
  'use strict';
  var BJ = window.BlackjackEngine, BOT = window.BlackjackBot;
  var MAXP = BJ.RULES.maxPlayers, MINP = BJ.RULES.minPlayers;
  var unsub = null, gameFor = null;
  var ST = function () { return (S.bj = S.bj || { game: null, v: 0, sending: false, bet: 0, side: 0, round: 0, rules: false, nosum: false, botSeen: null }); };

  var css = document.createElement('style');
  css.textContent = [
    '.bjscreen{position:fixed;inset:0;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 0%,#1f6b46,#0c2b1c);color:#eaf5ec;padding:calc(env(safe-area-inset-top,0px) + 10px) 10px calc(env(safe-area-inset-bottom,0px) + 10px);gap:6px;overflow:hidden;font-family:inherit}',
    '.bjtop{display:flex;align-items:center;gap:8px;flex:none}.bjtop .iconbtn{background:#eaf5ec;color:#0c2b1c}',
    '.bjtop .st{flex:1;font-weight:700;font-size:14px;line-height:1.15;min-width:0}',
    '.bjdealer{flex:none;background:#00000030;border-radius:14px;padding:8px;text-align:center}',
    '.bjdealer .lb{font-size:11px;opacity:.85;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase}',
    '.bjcards{display:flex;justify-content:center;gap:4px;flex-wrap:wrap;min-height:20px}',
    '.bjsc{display:inline-block;background:#eaf5ec;color:#0c2b1c;border-radius:10px;padding:0 8px;font-weight:800;font-size:12px;margin-top:4px}',
    '.bjseats{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px;align-content:start}.bjseat:not(.me) .bjnote{font-size:11px}',
    '.bjseat{background:#00000030;border:2px solid #ffffff22;border-radius:12px;padding:6px;position:relative}',
    '.bjseat.me{grid-column:1/-1;border-color:#9ad9b0}.bjseat.turn{border-color:#e6c15a;box-shadow:0 0 0 2px #e6c15a66}.bjseat.out{opacity:.55}',
    '.bjseat .hd{display:flex;justify-content:space-between;gap:6px;font-size:12px;margin-bottom:4px}.bjseat .nm{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.bjseat .fch{white-space:nowrap;font-weight:700}',
    '.bjhands{display:flex;gap:8px;flex-wrap:wrap}.bjhand{padding:3px 4px;border-radius:10px;border:2px solid transparent}.bjhand.act{border-color:#e6c15a;background:#e6c15a22}',
    '.bjhand .meta{font-size:11px;margin-top:3px;display:flex;gap:4px;flex-wrap:wrap;align-items:center}',
    '.bjbet{background:#e6c15a;color:#2b1a10;border-radius:10px;padding:0 6px;font-weight:800}',
    '.bjres{border-radius:10px;padding:0 6px;font-weight:800;color:#0c2b1c;background:#eaf5ec}.bjres.w{background:#7fe0a0}.bjres.l{background:#f08a7e}.bjres.p{background:#d8d8d8}.bjres.b{background:#ffd96b}',
    '.bjnote{font-size:11px;opacity:.9;margin-top:3px}',
    '.bjprompt{background:#e6c15a;color:#2b1a10;border-radius:12px;padding:6px 10px;font-weight:700;font-size:13px;flex:none;text-align:center}',
    '.bjbar{display:flex;gap:6px;flex:none;flex-wrap:wrap}.bjbar .btn{margin:0;flex:1;min-width:84px;padding:10px 6px;font-size:14px}',
    '.bjchips{display:flex;gap:8px;justify-content:center;flex:none}',
    '.bjchip{width:52px;height:52px;border-radius:50%;border:4px dashed #ffffffcc;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;box-shadow:0 3px 6px #0007;cursor:pointer;user-select:none}',
    '.bjchip.c10{background:#2f6fb5}.bjchip.c50{background:#c0392b}.bjchip.c100{background:#222}.bjchip.c500{background:#7d3c98}.bjchip.off{opacity:.35}',
    '.bjmodal{position:fixed;inset:0;background:#000a;display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}.bjmodal .box{background:#f3f8f2;color:#10261a;border-radius:16px;padding:14px;max-width:440px;width:100%;max-height:86vh;overflow:auto}',
    '.bjmodal h3{margin:0 0 8px}.bjrank{width:100%;border-collapse:collapse;font-size:13px}.bjrank td,.bjrank th{padding:5px 3px;border-bottom:1px solid #00000018;text-align:right}.bjrank td:first-child,.bjrank th:first-child{text-align:left}',
    '.bjlob .row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}'
  ].join('');
  document.head.appendChild(css);

  var RES = { blackjack: ['Blackjack!', 'w'], win: ['Ganhou', 'w'], push: ['Empate', 'p'], lose: ['Perdeu', 'l'], bust: ['Estourou', 'l'], surrender: ['Desistiu', 'b'] };
  var fmt = function (n) { return (n < 0 ? '−' : '') + Math.abs(n); };
  var sgn = function (n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); };

  // ───────── criação / lobby ─────────
  function createMesa() {
    var nome = val('mesa_nome').trim() || ('Blackjack de ' + (S.me.apelido || primeiro(S.me.nome)));
    var seats = [S.user.uid]; for (var i = 1; i < MAXP; i++) seats.push(null);
    mesasCol().add({ nome: nome, criadoPor: S.user.uid, status: 'aguardando', jogo: 'blackjack', seats: seats, criadoEm: firebase.firestore.FieldValue.serverTimestamp() })
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
  function stand() { var uid = S.user.uid; seatTx('stand', function (c) { var i = c.indexOf(uid); if (i < 0) return false; c[i] = null; }); }
  function addBots(k) {
    seatTx('bots', function (c) {
      var used = c.filter(isBot), free = shuffleArr([0, 1, 2, 3, 4, 5, 6, 7].filter(function (x) { return used.indexOf('bot:' + x) < 0; })), put = 0;
      for (var i = 0; i < c.length && put < k; i++) if (!c[i]) { c[i] = 'bot:' + free[put++]; }
      if (!put) return false;
    });
  }
  function rmBot(idx) { seatTx('rmbot' + idx, function (c) { if (!isBot(c[idx])) return false; c[idx] = null; }); }
  function nameOf(u) { var p = playerByUid(u); return p ? (p.apelido || primeiro(p.nome)) : '?'; }
  function start() {
    var ref = mesasCol().doc(S.mesaId);
    db.runTransaction(function (tx) { return tx.get(ref).then(function (d) {
      if (!d.exists) throw { message: 'Essa mesa não existe mais.' };
      var m = d.data(); if (m.status !== 'aguardando') throw { message: 'A partida já começou.' };
      var seats = m.seats.filter(function (x) { return x; });
      if (!seats.some(function (x) { return !isBot(x); })) throw { message: 'Precisa de pelo menos um humano.' };
      if (seats.length < MINP) throw { message: 'Sente pelo menos ' + MINP + ' jogador.' };
      var players = seats.map(function (u) { return { id: u, name: nameOf(u) }; });
      var st = BJ.createGame({ players: players, seed: Math.floor(Math.random() * 4294967296) }); st.lastAt = Date.now();
      tx.set(estadoRef(S.mesaId), { json: JSON.stringify(st), v: 1 });
      tx.update(ref, { status: 'jogando', seats: seats, jogadores: seats, iniciadaEm: firebase.firestore.FieldValue.serverTimestamp() });
    }); }).catch(toastErr);
  }
  function del() {
    var id = S.mesaId; if (!confirm('Excluir esta mesa?')) return;
    estadoRef(id).delete().catch(function () {}).then(function () { return mesasCol().doc(id).delete(); }).then(function () { closeMesa(); }).catch(toastErr);
  }
  /** Um humano assume o lugar de um bot, a qualquer momento (inclusive no meio da rodada). */
  function takeover(idx) {
    var uid = S.user.uid, mref = mesasCol().doc(S.mesaId), eref = estadoRef(S.mesaId), nome = S.me.apelido || primeiro(S.me.nome);
    db.runTransaction(function (tx) { return Promise.all([tx.get(mref), tx.get(eref)]).then(function (r) {
      if (!r[0].exists || !r[1].exists) throw { message: 'Essa mesa não existe mais.' };
      var m = r[0].data(), seats = m.seats.slice();
      if (seats.indexOf(uid) >= 0) throw { message: 'Você já está na mesa.' };
      if (!isBot(seats[idx])) throw { message: 'Esse lugar não é mais de um bot.' };
      var st = JSON.parse(r[1].data().json), res = BJ.applyAction(st, { type: 'TAKEOVER', player: idx, id: uid, name: nome });
      if (!res.ok) throw { message: res.error };
      seats[idx] = uid;
      tx.update(mref, { seats: seats, jogadores: seats });
      tx.set(eref, { json: JSON.stringify(res.state), v: (r[1].data().v || 0) + 1 });
    }); }).then(function () { toast('Você entrou na mesa!'); refreshMesa(); }).catch(function (e) { toastErr(e); refreshMesa(); });
  }

  function lobbyHtml(m) {
    var me = mySeat(m), n = m.seats.filter(function (x) { return x; }).length, adm = m.criadoPor === S.user.uid || isMaster();
    var h = ['<div class="wrap bjlob"><div class="gtop"><button class="btn ghost mini" data-action="mesa-back">‹ Mesas</button><span class="muted">' + esc(m.nome || 'Mesa') + '</span></div>'];
    h.push('<div class="panel"><div class="eyebrow">Blackjack · até ' + MAXP + ' jogadores contra a banca</div><h2 class="ph">Quem vai jogar?</h2><p class="muted" style="margin-top:6px">Cada um começa com ' + BJ.RULES.start + ' fichas. Dá para jogar sozinho contra a banca. Quem chegar depois pode entrar no lugar de um bot.</p>');
    m.seats.forEach(function (u, i) {
      var p = u ? playerByUid(u) : null;
      h.push('<div class="row">' + (p ? avatarMini(p) : '<div class="av empty">·</div>') + '<div class="grow"><div class="t">' + (p ? esc(p.apelido || primeiro(p.nome)) : 'Vaga ' + (i + 1)) + '</div></div>' + (p && p.bot && adm ? '<button class="btn ghost mini" data-action="bj-rmbot" data-id="' + i + '">Tirar</button>' : '') + '</div>');
    });
    h.push('<div class="muted" style="margin:10px 0;text-align:center">' + n + '/' + MAXP + ' lugares</div>');
    if (me < 0) h.push('<button class="btn gold" data-action="bj-sit"' + (n >= MAXP ? ' disabled' : '') + '>Sentar na mesa</button>');
    else h.push('<button class="btn ghost" data-action="bj-getup">Levantar</button>');
    if (adm) {
      if (n < MAXP) h.push('<div class="randrow"><span>🤖 Colocar bots:</span>' + [1, 2, 3, 4, 5].map(function (k) { return '<button class="btn ghost mini" data-action="bj-addbots" data-id="' + k + '"' + (k <= MAXP - n ? '' : ' disabled') + '>' + k + '</button>'; }).join('') + '</div>');
      h.push('<button class="btn" data-action="bj-start"' + (n >= MINP ? '' : ' disabled') + '>Abrir a mesa (' + n + ' jogador' + (n > 1 ? 'es' : '') + ')</button>');
      h.push('<button class="btn ghost" data-action="bj-del">Excluir mesa</button>');
    } else h.push('<p class="muted" style="margin-top:12px;text-align:center">Quem criou a mesa abre o jogo.</p>');
    h.push('</div></div>');
    return h.join('') + (S.toast ? '<div class="toast">' + esc(S.toast) + '</div>' : '');
  }

  // ───────── sincronização ─────────
  function listen(mid) { stop(); gameFor = mid; unsub = estadoRef(mid).onSnapshot(function (d) { accept(d); }, function () {}); }
  function accept(d) {
    if (!d || !d.exists) return;
    var f = ST(), data = d.data(), v = data.v || 0;
    if (f.sending && v < f.v) return;
    if (!f.sending && f.game && v === f.v) return;
    if (v < f.v && !f.sending && f.game) return;
    var g; try { g = JSON.parse(data.json); } catch (e) { return; }
    var prev = f.game; f.game = g; f.v = v; sync(prev);
    render();
  }
  function resync() { if (!S.mesaId) return Promise.resolve(); return estadoRef(S.mesaId).get({ source: 'server' }).then(accept).catch(function () {}); }
  setInterval(function () { var f = S.bj; if (f && f.game && S.mesaId && !f.sending && !document.hidden && gameFor === S.mesaId) resync(); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.bj && S.bj.game && gameFor === S.mesaId) resync(); });
  // jogador parado além do limite vira "ausente" e a mesa joga por ele
  setInterval(function () {
    var f = S.bj, g = f && f.game, m = S.lastMesa;
    if (!g || !m || !S.user || f.sending || document.hidden || gameFor !== S.mesaId || mySeat(m) < 0) return;
    var lim = BJ.RULES.idleMs[g.phase]; if (!lim || typeof g.lastAt !== 'number' || Date.now() - g.lastAt < lim) return;
    var pend = BJ.pending(g), hit = null;
    pend.forEach(function (i) { if (!hit && !g.players[i].absent && m.seats[i] && !isBot(m.seats[i])) hit = i; });
    if (hit !== null) act({ type: 'ABSENT', player: hit }, true);
  }, 2000);
  function stop() {
    if (unsub) { unsub(); unsub = null; } gameFor = null;
    if (S.bj) { S.bj.game = null; S.bj.v = 0; S.bj.sending = false; S.bj.bet = 0; S.bj.side = 0; S.bj.round = 0; S.bj.rules = false; S.bj.nosum = false; S.bj.botSeen = null; }
  }
  /** nova rodada → repete a última aposta como sugestão; toca som na sua vez */
  function sync(prev) {
    var f = ST(), g = f.game, m = S.lastMesa, me = m ? mySeat(m) : -1;
    if (g.round !== f.round) {
      f.round = g.round; f.editing = false;
      var p = me >= 0 ? g.players[me] : null, last = prev && prev.players[me] ? prev.players[me] : null;
      f.bet = 0; f.side = 0; // cada rodada começa com as fichas zeradas: é preciso escolher de novo
    }
    if (me >= 0 && prev && typeof sfx === 'function') {
      var now = BJ.pending(g).indexOf(me) >= 0 && g.phase === 'PLAYING', was = BJ.pending(prev).indexOf(me) >= 0 && prev.phase === 'PLAYING';
      if (now && !was) { try { sfx('turn'); } catch (e) {} }
    }
  }

  function act(a, quiet) {
    var f = ST();
    if (f.sending) { if (!quiet) toast('Enviando a jogada anterior…'); return; }
    var g = f.game; a.at = Date.now(); var r = BJ.applyAction(g, a);
    if (!r.ok) { if (!quiet) toast(r.error); return; }
    f.game = r.state; f.v = (f.v || 0) + 1; f.sending = true; S._forceRender = true; render();
    var ref = estadoRef(S.mesaId);
    withTimeout(db.runTransaction(function (tx) { return tx.get(ref).then(function (d) {
      var st = JSON.parse(d.data().json), v = (d.data().v || 0) + 1, rr = BJ.applyAction(st, a);
      if (!rr.ok) return { ok: false, error: rr.error };
      tx.set(ref, { json: JSON.stringify(rr.state), v: v }); return { ok: true, state: rr.state, v: v };
    }); }), 12000).then(function (res) {
      f.sending = false;
      if (!res.ok) { if (!quiet) toast('A jogada não foi aceita: ' + res.error); resync(); }
      else {
        f.game = res.state; f.v = res.v;
        if (res.state.phase === 'ENDED') { mesasCol().doc(S.mesaId).update({ status: 'encerrada' }).catch(function () {}); register(res.state, S.lastMesa); }
      }
      S._forceRender = true; render();
    }).catch(function () { f.sending = false; toast('Sem conexão: jogada não enviada. Tentando sincronizar…'); f.v = 0; resync(); S._forceRender = true; render(); });
  }
  function register(g, m) {
    try {
      var s = BJ.standings(g), by = {}; s.forEach(function (x) { by[x.seat] = x; });
      var arr = function (k) { return g.players.map(function (p, i) { return by[i][k]; }); };
      db.collection('partidasBlackjack').doc(S.mesaId).set({
        jogadores: g.players.map(function (p) { return p.id; }), nome: m.nome || '', rodadas: g.round,
        finais: arr('chips'), saldos: arr('net'), maiores: arr('biggest'), maosGanhas: arr('handsWon'), maosPerdidas: arr('handsLost'), blackjacks: arr('blackjacks'), recompras: arr('rebuys'), jogadasRodadas: arr('rounds'),
        fim: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    } catch (e) {}
  }
  function play(type, extra) { var m = S.lastMesa, a = { type: type, player: mySeat(m) }; for (var k in (extra || {})) a[k] = extra[k]; act(a); }

  // ───────── desenho ─────────
  function cardsHtml(cards, cw, hideSecond) {
    return '<div class="bjcards" style="--cw:' + cw + 'px">' + cards.map(function (c, i) { return (hideSecond && i === 1) ? '<div class="pc back"></div>' : cardHtml(c, '', ''); }).join('') + '</div>';
  }
  function handNet(h) { return h.result ? h.payout - h.bet : 0; }
  function handHtml(g, p, h, i, cw, active) {
    var sc = BJ.score(h.cards), res = h.result ? RES[h.result] : null, net = handNet(h), meta = '';
    if (h.bet) meta += '<span class="bjbet">🪙 ' + h.bet + '</span>';
    meta += '<span class="bjsc" style="margin:0">' + (h.cards.length ? (sc.total > 21 ? 'Estourou ' + sc.total : sc.total + (sc.soft && sc.total < 21 ? ' (soft)' : '')) : '') + '</span>';
    if (res) meta += '<span class="bjres ' + res[1] + '">' + res[0] + (h.result !== 'push' ? ' ' + sgn(net) : '') + '</span>';
    return '<div class="bjhand' + (active ? ' act' : '') + '">' + cardsHtml(h.cards, cw) + '<div class="meta">' + meta + '</div></div>';
  }
  function seatHtml(g, p, me, cwBig) {
    var isMe = p.seat === me, cw = isMe ? cwBig : 26;
    var turn = g.phase === 'PLAYING' && g.turn && g.turn.seat === p.seat;
    var out = p.hands.length === 0 && g.phase !== 'BETTING';
    var head = '<div class="hd"><span class="nm">' + esc(p.name) + (isMe ? ' (você)' : '') + (p.absent ? ' 💤' : '') + (turn ? ' ▶' : '') + '</span><span class="fch">🪙 ' + p.chips + '</span></div>';
    var body = '';
    if (p.hands.length) body = '<div class="bjhands">' + p.hands.map(function (h, i) { return handHtml(g, p, h, i, cw, turn && g.turn.hand === i); }).join('') + '</div>';
    else if (g.phase === 'BETTING') body = '<div class="bjnote">' + (p.ready ? (p.bet > 0 ? '✅ Apostou ' + p.bet : '⏭ Passou a rodada') : '… escolhendo a aposta') + '</div>';
    else body = '<div class="bjnote">Fora desta rodada</div>';
    var notes = '';
    if (p.absent) notes += '<div class="bjnote">💤 Ausente — a mesa joga por ele</div>';
    if (p.sideResult) notes += '<div class="bjnote">🎯 Par Perfeito: ' + (p.sideResult === 'perdeu' ? 'não saiu (−' + p.side + ')' : p.sideResult + ' +' + (p.sidePay - p.side)) + '</div>';
    if (p.insured) notes += '<div class="bjnote">🛡 Seguro ' + p.insured + (g.phase === 'ROUND_OVER' ? (g.dealer.cards.length === 2 && BJ.isBJ(g.dealer.cards) ? ' (pagou 2:1)' : ' (perdido)') : '') + '</div>';
    if (g.phase === 'ROUND_OVER' && p.bet > 0) notes += '<div class="bjnote"><b>Rodada: ' + sgn(p.roundNet) + '</b></div>';
    return '<div class="bjseat' + (isMe ? ' me' : '') + (turn ? ' turn' : '') + (out ? ' out' : '') + '">' + head + body + notes + '</div>';
  }
  function dealerHtml(g) {
    var d = g.dealer, up = d.cards.length ? BJ.pval(d.cards[0]) : 0, sc = d.cards.length ? BJ.score(d.cards) : null;
    var shown = d.reveal ? (sc.total > 21 ? 'Estourou ' + sc.total : String(sc.total)) : (d.cards.length ? (up === 11 ? 'Ás' : String(up)) + ' + ?' : '');
    return '<div class="bjdealer"><div class="lb">Banca</div>' + cardsHtml(d.cards, 44, !d.reveal) + (shown ? '<span class="bjsc">' + shown + '</span>' : '') + '</div>';
  }
  function barHtml(g, m, me) {
    var f = ST(), p = g.players[me], bar = '', prompt = '', o = BJ.options(g, me);
    if (p.absent && g.phase !== 'ENDED') return { prompt: '💤 Você ficou ausente: a mesa está jogando por você.', bar: '<button class="btn gold" data-action="bj-back">Voltei!</button>' };
    var humans = m.seats.some(function (u) { return u && !isBot(u); });
    if (g.phase === 'ENDED') return { prompt: 'Mesa encerrada', bar: '<button class="btn gold" data-action="mesa-back">Voltar às mesas</button>' };
    if (g.phase === 'BETTING') {
      if (p.ready && !f.editing) {
        var waiting = g.players.filter(function (q) { return !q.ready; }).map(function (q) { return q.name; });
        prompt = 'Aposta feita. Aguardando ' + (waiting.length ? waiting.join(', ') : 'a mesa') + '…';
        bar = '<button class="btn ghost" data-action="bj-rebet">Mudar aposta</button>';
      } else {
        var max = Math.min(BJ.RULES.maxBet, p.chips), avail = p.chips - f.side;
        var chip = function (v) { var off = f.bet + v > Math.min(BJ.RULES.maxBet, p.chips - f.side); return '<div class="bjchip c' + v + (off ? ' off' : '') + '" data-action="bj-chip" data-id="' + v + '">' + v + '</div>'; };
        prompt = 'Faça sua aposta (' + BJ.RULES.minBet + ' a ' + BJ.RULES.maxBet + '). Saldo: ' + p.chips;
        var chipsRow = '<div class="bjchips">' + chip(10) + chip(50) + chip(100) + chip(500) + '</div>';
        var sideTxt = f.side ? 'Par Perfeito: ' + f.side : 'Par Perfeito: não';
        bar = chipsRow.replace('<div class="bjchips">', '<div class="bjchips" style="width:100%;margin-bottom:2px">') +
          '<button class="btn ghost" data-action="bj-clear">Limpar</button><button class="btn ghost" data-action="bj-side">🎯 ' + sideTxt + '</button>' +
          '<button class="btn gold" data-action="bj-bet"' + (f.bet >= BJ.RULES.minBet ? '' : ' disabled') + '>Apostar ' + f.bet + '</button><button class="btn ghost" data-action="bj-skip">Passar</button>';
        if (g.reshuffled && g.round > 1) prompt = '🔀 Baralhos embaralhados. ' + prompt;
      }
      return { prompt: prompt, bar: bar + (humans ? '' : '') + (g.round > 1 && !g.players.some(function (q) { return q.ready && q.bet > 0; }) ? '<button class="btn ghost" data-action="bj-end">Encerrar mesa</button>' : '') };
    }
    if (g.phase === 'INSURANCE') {
      if (p.bet > 0 && !p.insDecided) {
        var amt = p.bet / 2;
        return { prompt: 'A banca mostra um Ás. Seguro? Custa ' + amt + ' e paga 2:1 se a banca tiver Blackjack.', bar: '<button class="btn gold" data-action="bj-insure" data-id="1"' + (amt <= p.chips ? '' : ' disabled') + '>Fazer seguro (' + amt + ')</button><button class="btn ghost" data-action="bj-insure" data-id="0">Sem seguro</button>' };
      }
      return { prompt: 'A banca mostra um Ás. Aguardando as decisões de seguro…', bar: '' };
    }
    if (g.phase === 'PLAYING') {
      if (g.turn && g.turn.seat === me) {
        var btn = function (a, label, on, gold) { return '<button class="btn ' + (gold ? 'gold' : 'ghost') + '" data-action="bj-' + a + '"' + (on ? '' : ' disabled') + '>' + label + '</button>'; };
        return { prompt: 'Sua vez' + (p.hands.length > 1 ? ' (mão ' + (g.turn.hand + 1) + ' de ' + p.hands.length + ')' : '') + (f.sending ? ' …' : ''),
          bar: btn('hit', 'Pedir', o.hit, 1) + btn('stand', 'Parar', o.stand, 1) + btn('double', 'Dobrar', o.double) + btn('split', 'Separar', o.split) + btn('surrender', 'Desistir', o.surrender) };
      }
      return { prompt: 'Vez de ' + (g.turn ? g.players[g.turn.seat].name : 'a banca') + '…', bar: '' };
    }
    // ROUND_OVER
    var mine = p.bet > 0 ? ' Você: ' + sgn(p.roundNet) + ' fichas.' : '';
    return { prompt: 'Fim da rodada ' + g.round + '.' + mine, bar: '<button class="btn gold" data-action="bj-next">Próxima rodada</button><button class="btn ghost" data-action="bj-end">Encerrar mesa</button>' };
  }
  function standingsHtml(g, me) {
    var s = BJ.standings(g);
    var rows = s.map(function (x, i) {
      return '<tr' + (x.seat === me ? ' style="font-weight:800"' : '') + '><td>' + (i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : (i + 1) + 'º ') + esc(x.name) + '</td><td>' + x.chips + '</td><td>' + sgn(x.net) + '</td><td>' + x.blackjacks + '</td><td>' + sgn(x.biggest) + '</td></tr>';
    }).join('');
    return '<table class="bjrank"><tr><th>Jogador</th><th>Fichas</th><th>Saldo</th><th>BJ</th><th>Maior</th></tr>' + rows + '</table><p style="font-size:11px;opacity:.75;margin-top:6px">Saldo = fichas finais − fichas iniciais' + (s.some(function (x) { return x.rebuys; }) ? ' − recompras' : '') + '. BJ = Blackjacks. Maior = maior ganho em uma rodada.</p>';
  }
  function summaryHtml(g, me) {
    var s = BJ.standings(g), win = s.filter(function (x) { return x.net > 0; }), lose = s.filter(function (x) { return x.net <= 0; });
    var row = function (x) { return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #00000018"><div><b>' + esc(x.name) + (x.seat === me ? ' (você)' : '') + '</b><br><span style="font-size:12px">' + x.rounds + (x.rounds === 1 ? ' rodada · ' : ' rodadas · ') + x.blackjacks + ' Blackjack' + (x.blackjacks === 1 ? '' : 's') + (x.rebuys ? ' · ' + x.rebuys + ' recompra' + (x.rebuys > 1 ? 's' : '') : '') + '</span></div><div style="text-align:right"><b>' + sgn(x.net) + '</b><br><span style="font-size:12px">🪙 ' + x.chips + '</span></div></div>'; };
    return '<div class="bjmodal"><div class="box" data-stop="1"><h3>🏆 Fim da mesa · ' + g.round + (g.round === 1 ? ' rodada' : ' rodadas') + '</h3>' +
      '<div style="font-weight:800;margin-top:6px">No lucro</div>' + (win.length ? win.map(row).join('') : '<p style="font-size:13px">Ninguém saiu no lucro.</p>') +
      '<div style="font-weight:800;margin-top:10px">No prejuízo / empate</div>' + (lose.length ? lose.map(row).join('') : '<p style="font-size:13px">Todos no lucro!</p>') +
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn gold" data-action="mesa-back">Voltar às mesas</button><button class="btn ghost" data-action="bj-sum-close">Ver a mesa</button></div></div></div>';
  }
  function modals(g, me) {
    var f = ST(), out = '';
    if (g.phase === 'ENDED' && !f.nosum) out += summaryHtml(g, me);
    if (f.rules) out += '<div class="bjmodal" data-action="bj-rules-close"><div class="box" data-stop="1">' + rulesHtml() + '<button class="btn ghost" style="margin-top:10px" data-action="bj-rules-close">Fechar</button></div></div>';
    if (f.table) out += '<div class="bjmodal" data-action="bj-table-close"><div class="box" data-stop="1"><h3>Placar da mesa</h3>' + standingsHtml(g, me) + '<button class="btn ghost" style="margin-top:10px" data-action="bj-table-close">Fechar</button></div></div>';
    return out;
  }
  function gameHtml(m, me) {
    var f = ST(), g = f.game, p = g.players[me];
    var head = '<div class="bjtop"><button class="iconbtn" data-action="mesa-back" aria-label="Voltar">‹</button><div class="st">Blackjack · rodada ' + g.round + '<br><span style="font-weight:400;font-size:12px">🪙 ' + p.chips + ' fichas · ' + BJ.RULES.decks + ' baralhos</span></div>' +
      '<button class="iconbtn" data-action="bj-table" aria-label="Placar">🏆</button><button class="iconbtn" data-action="bj-rules" aria-label="Regras">?</button></div>';
    var seats = g.players.filter(function (q) { return q.seat !== me; }).map(function (q) { return seatHtml(g, q, me, 42); }).join('') + seatHtml(g, p, me, 38);
    var b = barHtml(g, m, me);
    return '<div class="bjscreen">' + head + dealerHtml(g) + '<div class="bjseats">' + seats + '</div><div class="bjprompt">' + b.prompt + '</div><div class="bjbar">' + b.bar + '</div></div>' + modals(g, me) + (S.toast ? '<div class="toast">' + esc(S.toast) + '</div>' : '');
  }
  function joinHtml(m) {
    var g = ST().game, bots = [];
    m.seats.forEach(function (u, i) { if (isBot(u)) bots.push(i); });
    var h = '<div class="wrap"><div class="gtop"><button class="btn ghost mini" data-action="mesa-back">‹ Mesas</button><span class="muted">' + esc(m.nome || 'Mesa') + '</span></div><div class="panel"><div class="eyebrow">Blackjack · em andamento</div><h2 class="ph">Entrar na mesa</h2>';
    if (!bots.length) return h + '<p class="muted" style="margin-top:8px">Todos os lugares são de pessoas. Quando houver um bot na mesa, você poderá assumir o lugar dele.</p></div></div>';
    h += '<p class="muted" style="margin:6px 0 10px">Escolha um bot para substituir. Você assume o lugar dele agora, mesmo no meio da rodada; o seu saldo conta a partir da entrada.</p>';
    bots.forEach(function (i) {
      var u = m.seats[i], p = playerByUid(u), pl = g && g.players[i];
      h += '<div class="row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">' + avatarMini(p) + '<div style="flex:1"><div style="font-weight:700">' + esc(p.apelido) + '</div><div class="muted" style="font-size:12px">' + (pl ? '🪙 ' + pl.chips + ' fichas' : '') + '</div></div><button class="btn gold mini" data-action="bj-takeover" data-id="' + i + '">Assumir</button></div>';
    });
    return h + '</div></div>';
  }

  // ───────── regras ─────────
  function rulesHtml() {
    var D = function (t, b, o) { return '<details class="rg"' + (o ? ' open' : '') + '><summary>' + t + '</summary><div>' + b + '</div></details>'; };
    return '<h3 style="margin:0 0 8px">Regras do Blackjack</h3>' +
      D('Objetivo', '<p>Fazer mais pontos que a banca sem passar de <b>21</b>. Cartas de 2 a 10 valem o número; J, Q e K valem 10; o Ás vale 11 ou 1 (o que for melhor). Passou de 21, estourou e perde na hora.</p>', 1) +
      D('A rodada', '<p>1) Todos apostam ao mesmo tempo (de ' + BJ.RULES.minBet + ' a ' + BJ.RULES.maxBet + ' fichas; "Passar" para assistir). 2) Cada jogador recebe 2 cartas e a banca recebe 2, uma virada. 3) Cada um joga na sua vez. 4) A banca revela a carta e compra até ter 17 ou mais (para em qualquer 17). 5) Quem ficou mais perto de 21 que a banca ganha 1:1.</p><p>Cada um começa com ' + BJ.RULES.start + ' fichas. Se as fichas acabam (menos que ' + BJ.RULES.minBet + '), você recebe ' + BJ.RULES.start + ' novas e a recompra é descontada do seu saldo final.</p>') +
      D('Blackjack', '<p>Ás + carta de valor 10 nas duas primeiras cartas é Blackjack e paga <b>3:2</b> (aposta de 100 → ganha 150), a menos que a banca também tenha (empate). 21 depois de separar não é Blackjack: paga 1:1.</p>') +
      D('Jogadas', '<p><b>Pedir</b>: mais uma carta. <b>Parar</b>: fica com o que tem. <b>Dobrar</b>: dobra a aposta, recebe uma só carta e para (vale com 2 cartas, inclusive depois de separar). <b>Separar</b>: duas cartas iguais (mesmo número ou letra) viram duas mãos com uma aposta igual em cada; até 4 mãos. Ases separados recebem só uma carta cada e não separam de novo. <b>Desistir</b>: só como primeira jogada; devolve metade da aposta.</p>') +
      D('Seguro', '<p>Se a banca mostra um <b>Ás</b>, você pode fazer um seguro de até metade da aposta. Se a banca tiver Blackjack, o seguro paga 2:1 (empatando a rodada); se não, perde o seguro e o jogo continua. Com 10 ou Ás aparente, a banca confere o Blackjack antes de você jogar.</p>') +
      D('Par Perfeito (aposta lateral)', '<p>Aposta opcional (10 a ' + BJ.RULES.maxSide + ') feita junto com a principal: ganha se suas duas primeiras cartas forem iguais (mesmo número ou letra). A banca paga: <b>Misto</b> (cores diferentes, ex. 8♠ e 8♥) 6:1 · <b>Colorido</b> (mesma cor, naipes diferentes, ex. 8♥ e 8♦) 12:1 · <b>Perfeito</b> (mesmo naipe) 25:1. Não depende do resultado da mão.</p>') +
      D('Ausência', '<p>Se você demorar mais de 40 s para apostar ou jogar (30 s no seguro), fica <b>ausente</b> 💤: a mesa joga por você pela estratégia básica e você não aposta nas próximas rodadas. Para voltar, toque em <b>Voltei</b> ou faça qualquer jogada.</p>') +
      D('Mesa e bots', '<p>Até ' + MAXP + ' jogadores contra a banca. Bots jogam pela estratégia básica e você pode assumir o lugar de um bot a qualquer momento. O baralho é de ' + BJ.RULES.decks + ' baralhos e é reembaralhado quando restam poucas cartas. Ao encerrar a mesa, o resultado entra no Ranking.</p>');
  }

  // ───────── ações da interface ─────────
  function handle(act0, id) {
    var f = ST(), m = S.lastMesa, g = f.game, me = m ? mySeat(m) : -1;
    switch (act0) {
      case 'bj-create': createMesa(); break;
      case 'bj-sit': sit(); break;
      case 'bj-getup': stand(); break;
      case 'bj-start': start(); break;
      case 'bj-del': del(); break;
      case 'bj-addbots': addBots(parseInt(id, 10)); break;
      case 'bj-rmbot': rmBot(parseInt(id, 10)); break;
      case 'bj-takeover': takeover(parseInt(id, 10)); break;
    }
    if (!g) return;
    if (act0 === 'bj-rules') { f.rules = true; S._forceRender = true; render(); return; }
    if (act0 === 'bj-rules-close') { f.rules = false; S._forceRender = true; render(); return; }
    if (act0 === 'bj-table') { f.table = true; S._forceRender = true; render(); return; }
    if (act0 === 'bj-table-close') { f.table = false; S._forceRender = true; render(); return; }
    if (act0 === 'bj-sum-close') { f.nosum = true; S._forceRender = true; render(); return; }
    if (me < 0) return;
    var p = g.players[me];
    switch (act0) {
      case 'bj-chip': { var v = parseInt(id, 10), cap = Math.min(BJ.RULES.maxBet, p.chips - f.side); if (f.bet + v <= cap) f.bet += v; else toast('Limite da aposta.'); S._forceRender = true; render(); break; }
      case 'bj-clear': f.bet = 0; S._forceRender = true; render(); break;
      case 'bj-side': { var opts = [0, 10, 20, 50, 100], i = opts.indexOf(f.side), n = opts[(i + 1) % opts.length]; if (f.bet + n > p.chips) n = 0; f.side = n; S._forceRender = true; render(); break; }
      case 'bj-bet': f.editing = false; play('BET', { bet: f.bet, side: f.side }); break;
      case 'bj-skip': f.editing = false; play('BET', { bet: 0, side: 0 }); break;
      case 'bj-rebet': f.editing = true; f.bet = p.bet; f.side = p.side; S._forceRender = true; render(); break;
      case 'bj-insure': play('INSURE', { take: id === '1' }); break;
      case 'bj-back': play('RETURN'); break;
      case 'bj-hit': play('HIT'); break;
      case 'bj-stand': play('STAND'); break;
      case 'bj-double': play('DOUBLE'); break;
      case 'bj-split': play('SPLIT'); break;
      case 'bj-surrender': play('SURRENDER'); break;
      case 'bj-next': play('NEXT_ROUND'); break;
      case 'bj-end': if (confirm('Encerrar a mesa e registrar o resultado no ranking?')) play('END_GAME'); break;
    }
  }

  var botTimer = null;
  function botDrive() {
    var f = ST(), g = f.game, m = S.lastMesa;
    if (!g || !m || !S.user || !BOT || g.phase === 'ENDED') return;
    var me = mySeat(m); if (me < 0) return;
    var bots = [], humans = [];
    m.seats.forEach(function (u, i) { if (isBot(u) || (g.players[i] && g.players[i].absent)) bots.push(i); if (!isBot(u) && u) humans.push(i); });
    if (!bots.length) return;
    var a; try { a = BOT.pendingAction(g, bots); } catch (e) { a = null; }
    clearTimeout(botTimer); botTimer = null;
    if (!a) return;
    var rank = Math.max(0, humans.indexOf(me)), base = g.phase === 'BETTING' ? 700 : 1500;
    botTimer = setTimeout(function () {
      botTimer = null;
      if (f.sending || f.game !== g) { f.botSeen = null; S._forceRender = true; render(); return; }
      var a2; try { a2 = BOT.pendingAction(f.game, bots); } catch (e) { a2 = null; }
      if (a2) { a2.auto = true; act(a2, true); }
    }, base + rank * 2500);
  }
  function view(m) {
    var f = ST();
    if (m.status === 'aguardando') { if (gameFor) stop(); return lobbyHtml(m); }
    if (gameFor !== S.mesaId) listen(S.mesaId);
    var me = mySeat(m);
    if (!f.game) return '<div class="wrap">' + viewLoading() + '</div>';
    if (me < 0) return joinHtml(m);
    S._inGame = true;
    var html = gameHtml(m, me);
    if (f.botSeen !== f.game) { f.botSeen = f.game; setTimeout(botDrive, 0); }
    return html;
  }

  window.BlackjackUI = { view: view, handle: handle, stop: stop, rulesHtml: rulesHtml, createMesa: createMesa, MAXP: MAXP, act: act };
})();
