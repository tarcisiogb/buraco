/* Faroeste — arte própria em SVG (cartas, personagens, papéis, verso). UMD: window.FaroesteArt */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FaroesteArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const INK = '#2b1a10', PAP = '#f1e3bf', RED = '#b23a2e', BLU = '#2f5d8a', GOLD = '#c9962b', BRN = '#7a4a22', SKY = '#e9b45a';
  const SUITSYM = { S: '♠', H: '♥', D: '♦', C: '♣' };

  const star = (cx, cy, r, f) => {
    const p = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
    return '<polygon points="' + p.join(' ') + '" fill="' + (f || GOLD) + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
  };
  const sun = '<circle cx="100" cy="128" r="62" fill="' + SKY + '" opacity=".55"/>';
  const gun = (tr) => '<g transform="' + (tr || '') + '"><path d="M40 150h50l6-8h20v14h-12l-4 8h-14l-4 22H58l4-22H40z" fill="' + INK + '"/></g>';
  const rifleShape = (len) => '<path d="M' + (22) + ' 150h' + len + 'l22-6h14v10h-14l-22-4H90l-10 26H58l8-22H22z" fill="' + INK + '"/><rect x="112" y="152" width="62" height="6" fill="#555"/>';
  const rect = (x, y, w, h, f, extra) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '" stroke="' + INK + '" stroke-width="3" ' + (extra || '') + '/>';

  const ART = {
    tiro: sun + '<path d="M52 150h70l8-10h28v20h-18l-6 10h-18l-6 30h-24l6-30h-40z" fill="' + INK + '"/><rect x="58" y="140" width="64" height="12" fill="#444"/><path d="M158 150l26-14M160 160l30 4M158 146l22-26" stroke="' + RED + '" stroke-width="6" stroke-linecap="round"/>',
    errou: sun + '<path d="M46 150c0-30 26-52 54-52s54 22 54 52z" fill="' + BRN + '" stroke="' + INK + '" stroke-width="4"/><rect x="26" y="146" width="148" height="14" rx="7" fill="' + BRN + '" stroke="' + INK + '" stroke-width="4"/><circle cx="104" cy="118" r="9" fill="' + PAP + '" stroke="' + INK + '" stroke-width="3"/>',
    tonico: sun + '<path d="M84 90h32v22c14 10 22 22 22 44 0 20-12 34-38 34s-38-14-38-34c0-22 8-34 22-44z" fill="#6b9a52" stroke="' + INK + '" stroke-width="4"/><rect x="88" y="78" width="24" height="14" fill="' + BRN + '" stroke="' + INK + '" stroke-width="3"/><rect x="72" y="136" width="56" height="30" fill="' + PAP + '" stroke="' + INK + '" stroke-width="2"/><text x="100" y="158" text-anchor="middle" font-size="22" font-weight="700" fill="' + RED + '" font-family="Georgia,serif">+1</text>',
    taberna: '<rect x="22" y="58" width="156" height="150" fill="' + SKY + '" opacity=".6"/><path d="M40 98h120v14H40z" fill="' + BRN + '" stroke="' + INK + '" stroke-width="3"/><path d="M52 112h44l-8 80H52zM148 112h-44l8 80h36z" fill="#9b6a35" stroke="' + INK + '" stroke-width="4"/><path d="M62 124h26M62 140h26M112 124h26M112 140h26" stroke="' + INK + '" stroke-width="3"/><path d="M100 150v42" stroke="' + INK + '" stroke-width="3"/>',
    diligencia: sun + '<rect x="50" y="100" width="100" height="56" rx="6" fill="' + RED + '" stroke="' + INK + '" stroke-width="4"/><rect x="62" y="110" width="32" height="24" fill="' + PAP + '" stroke="' + INK + '" stroke-width="3"/><rect x="106" y="110" width="32" height="24" fill="' + PAP + '" stroke="' + INK + '" stroke-width="3"/><circle cx="72" cy="168" r="18" fill="#fff0" stroke="' + INK + '" stroke-width="6"/><circle cx="132" cy="168" r="18" fill="#fff0" stroke="' + INK + '" stroke-width="6"/><path d="M40 100h120" stroke="' + INK + '" stroke-width="6"/>',
    carroca: sun + '<path d="M44 110h112l-10 46H54z" fill="#c98a45" stroke="' + INK + '" stroke-width="4"/><path d="M50 110c0-34 100-34 100 0z" fill="' + PAP + '" stroke="' + INK + '" stroke-width="4"/><circle cx="72" cy="170" r="16" fill="#fff0" stroke="' + INK + '" stroke-width="6"/><circle cx="132" cy="170" r="16" fill="#fff0" stroke="' + INK + '" stroke-width="6"/><text x="100" y="144" text-anchor="middle" font-size="22" font-weight="700" fill="' + INK + '" font-family="Georgia,serif">CORREIO</text>',
    armazem: sun + '<rect x="40" y="96" width="120" height="86" fill="#c98a45" stroke="' + INK + '" stroke-width="4"/><path d="M34 96h132l-10-22H44z" fill="' + RED + '" stroke="' + INK + '" stroke-width="4"/><rect x="54" y="116" width="34" height="30" fill="' + PAP + '" stroke="' + INK + '" stroke-width="3"/><rect x="108" y="116" width="34" height="66" fill="' + BRN + '" stroke="' + INK + '" stroke-width="3"/><rect x="54" y="152" width="34" height="30" fill="#e9b45a" stroke="' + INK + '" stroke-width="3"/>',
    assalto: sun + '<path d="M70 176c-6-30-2-56 10-62l6 30 4-48 12 2-2 46 8-38 12 4-6 40 14-24 10 8c-8 24-14 38-22 52z" fill="#e0b48a" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><rect x="104" y="150" width="46" height="34" rx="6" fill="' + BRN + '" stroke="' + INK + '" stroke-width="4"/><text x="127" y="174" text-anchor="middle" font-size="20" font-weight="700" fill="' + GOLD + '" font-family="Georgia,serif">$</text>',
    confisco: sun + '<path d="M50 150h80l8-10h18v14h-14l-6 10h-14l-6 24H72l6-24H50z" fill="' + INK + '"/><circle cx="100" cy="132" r="48" fill="none" stroke="' + RED + '" stroke-width="10"/><path d="M66 166L134 98" stroke="' + RED + '" stroke-width="10"/>',
    rajada: sun + '<circle cx="60" cy="150" r="26" fill="#777" stroke="' + INK + '" stroke-width="4"/>' + [-14, -4, 6, 16].map((o) => '<rect x="60" y="' + (142 + o) + '" width="88" height="7" fill="' + INK + '"/>').join('') + '<path d="M152 140l26-12M154 152l30 0M152 164l26 12" stroke="' + RED + '" stroke-width="6" stroke-linecap="round"/><rect x="40" y="172" width="40" height="22" fill="' + BRN + '" stroke="' + INK + '" stroke-width="3"/>',
    boiada: sun + '<path d="M40 132c-4-22 12-34 28-26l10 22zM160 132c4-22-12-34-28-26l-10 22z" fill="#f0e8d0" stroke="' + INK + '" stroke-width="4"/><path d="M62 124h76c10 24 4 58-14 70H76c-18-12-24-46-14-70z" fill="#8b5a2b" stroke="' + INK + '" stroke-width="4"/><ellipse cx="100" cy="182" rx="22" ry="12" fill="#e0b48a" stroke="' + INK + '" stroke-width="3"/><circle cx="86" cy="146" r="5" fill="' + INK + '"/><circle cx="114" cy="146" r="5" fill="' + INK + '"/>',
    duelo: sun + '<g transform="rotate(-18 100 140)">' + gun() + '</g><g transform="rotate(18 100 140) translate(200 0) scale(-1 1)">' + gun() + '</g>' + '<path d="M96 100l8-14 8 14-8 6z" fill="' + RED + '"/>',
    cavalo: sun + '<path d="M60 170c-12-50 10-92 50-92 38 0 56 36 40 92h-22c8-34-4-56-24-56-18 0-26 28-18 56z" fill="none" stroke="' + INK + '" stroke-width="16" stroke-linecap="round"/><path d="M60 170c-12-50 10-92 50-92 38 0 56 36 40 92h-22c8-34-4-56-24-56-18 0-26 28-18 56z" fill="none" stroke="#b9b9b9" stroke-width="9" stroke-linecap="round"/>',
    luneta: sun + '<rect x="30" y="120" width="130" height="26" rx="6" fill="' + BRN + '" stroke="' + INK + '" stroke-width="4"/><rect x="150" y="112" width="26" height="42" rx="6" fill="#999" stroke="' + INK + '" stroke-width="4"/><rect x="60" y="116" width="10" height="34" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2"/><rect x="110" y="116" width="10" height="34" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2"/><circle cx="163" cy="133" r="7" fill="#9fd0e8" stroke="' + INK + '" stroke-width="2"/>',
    barril: sun + '<path d="M60 90h80c10 20 10 60 0 80H60c-10-20-10-60 0-80z" fill="#9b6a35" stroke="' + INK + '" stroke-width="4"/><path d="M62 112h76M60 150h80" stroke="' + INK + '" stroke-width="6"/><path d="M82 92v76M118 92v76" stroke="' + INK + '" stroke-width="2" opacity=".5"/>',
    cadeia: '<rect x="30" y="76" width="140" height="120" fill="#222" opacity=".85"/>' + [48, 70, 92, 114, 136, 158].map((x) => '<rect x="' + x + '" y="70" width="8" height="132" fill="#777" stroke="' + INK + '" stroke-width="2"/>').join('') + '<rect x="26" y="70" width="148" height="10" fill="#555"/><rect x="26" y="192" width="148" height="10" fill="#555"/>',
    dinamite: sun + [70, 100, 130].map((x, i) => '<rect x="' + x + '" y="100" width="24" height="86" rx="6" fill="' + RED + '" stroke="' + INK + '" stroke-width="3" transform="rotate(' + ((i - 1) * 6) + ' ' + (x + 12) + ' 143)"/>').join('') + '<path d="M100 98c0-16 14-18 20-34" stroke="' + INK + '" stroke-width="4" fill="none"/><path d="M122 56l6-10m-2 14l12-4m-18 0l-2-12" stroke="' + GOLD + '" stroke-width="4" stroke-linecap="round"/>',
    repetidor: sun + '<path d="M26 150h96l22-6h14v10h-14l-22-4H90l-10 26H58l8-22H26z" fill="' + INK + '"/><rect x="82" y="128" width="40" height="22" rx="4" fill="#666" stroke="' + INK + '" stroke-width="3"/><text x="100" y="196" text-anchor="middle" font-size="14" fill="' + INK + '" font-family="Georgia,serif" font-style="italic">tiros à vontade</text>',
    canocurto: sun + '<path d="M50 150h70l8-10h28v20h-18l-6 10h-18l-6 30h-24l6-30h-40z" fill="' + INK + '"/>',
    pistolalonga: sun + '<path d="M34 150h98l20-8h14v14h-14l-20-6H88l-8 26H58l8-20H34z" fill="' + INK + '"/>',
    carabina: sun + '<path d="M22 150h110l22-6h14v10h-14l-22-4H90l-10 26H58l8-22H22z" fill="' + INK + '"/><rect x="100" y="152" width="70" height="6" fill="#555"/>',
    rifle: sun + '<path d="M22 150h120l22-6h14v10h-14l-22-4H90l-10 26H58l8-22H22z" fill="' + INK + '"/><rect x="112" y="152" width="62" height="6" fill="#555"/>'
  };
  const TITLES = { tiro: 'TIRO', errou: 'ERROU!', tonico: 'TÔNICO', taberna: 'TABERNA', diligencia: 'DILIGÊNCIA', carroca: 'CARROÇA DO CORREIO', armazem: 'ARMAZÉM', assalto: 'ASSALTO', confisco: 'CONFISCO', rajada: 'RAJADA', boiada: 'ESTOURO DA BOIADA', duelo: 'DUELO', cavalo: 'CAVALO VELOZ', luneta: 'LUNETA', barril: 'BARRIL DE BLINDAGEM', cadeia: 'CADEIA', dinamite: 'DINAMITE', repetidor: 'REPETIDOR', canocurto: 'CANO CURTO', pistolalonga: 'PISTOLA LONGA', carabina: 'CARABINA', rifle: 'RIFLE' };
  const SUBS = { tiro: '1 vida do alvo', errou: 'cancela um Tiro', tonico: '+1 vida', taberna: 'todos +1 vida', diligencia: 'compre 2 cartas', carroca: 'compre 3 cartas', armazem: 'cada um escolhe 1', assalto: 'roube a distância 1', confisco: 'descarte 1 de alguém', rajada: 'Tiro em todos', boiada: 'Tiro ou perde vida', duelo: 'Tiro contra Tiro', cavalo: '+1 distância', luneta: '−1 distância', barril: 'copas = Errou', cadeia: 'preso: saque ♥', dinamite: '♠ 2-9: 3 vidas', repetidor: 'alcance 1', canocurto: 'alcance 2', pistolalonga: 'alcance 3', carabina: 'alcance 4', rifle: 'alcance 5' };
  const BLUE = { cavalo: 1, luneta: 1, barril: 1, cadeia: 1, dinamite: 1, repetidor: 1, canocurto: 1, pistolalonga: 1, carabina: 1, rifle: 1 };
  const VAL = (v) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[v] || String(v));

  /** Carta de jogo. card = {kind, suit, value}. */
  function cardSvg(card, opts) {
    opts = opts || {};
    const k = card.kind, c = BLUE[k] ? BLU : BRN, sym = SUITSYM[card.suit] || '', red = card.suit === 'H' || card.suit === 'D';
    const v = VAL(card.value), t = TITLES[k], fs = t.length > 18 ? 11 : t.length > 12 ? 13 : t.length > 9 ? 15 : 19;
    return '<svg class="fwc" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="194" height="274" rx="16" fill="' + PAP + '" stroke="' + c + '" stroke-width="6"/><rect x="12" y="12" width="176" height="256" rx="10" fill="none" stroke="' + c + '" stroke-width="2" opacity=".6"/>' +
      '<rect x="22" y="22" width="156" height="30" rx="4" fill="' + c + '"/><text x="100" y="42" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="' + fs + '" fill="' + PAP + '" letter-spacing="1">' + t + '</text>' +
      '<rect x="22" y="58" width="156" height="150" fill="#f7ebd0" stroke="' + INK + '" stroke-width="2"/><svg x="22" y="58" width="156" height="150" viewBox="22 58 156 150">' + ART[k] + '</svg>' +
      '<text x="100" y="232" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="14" fill="' + INK + '">' + SUBS[k] + '</text>' +
      '<text x="30" y="262" font-family="Georgia,serif" font-weight="700" font-size="20" fill="' + (red ? RED : INK) + '">' + v + sym + '</text><text x="170" y="262" text-anchor="end" font-family="Georgia,serif" font-weight="700" font-size="20" fill="' + (red ? RED : INK) + '">' + v + sym + '</text></svg>';
  }

  function backSvg() {
    return '<svg class="fwc" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="194" height="274" rx="16" fill="#8d2f2a" stroke="' + PAP + '" stroke-width="6"/><rect x="14" y="14" width="172" height="252" rx="8" fill="none" stroke="' + GOLD + '" stroke-width="3"/>' +
      Array.from({ length: 9 }, (_, i) => '<path d="M14 ' + (14 + i * 30) + 'L186 ' + (44 + i * 30) + '" stroke="#6d201c" stroke-width="10" opacity=".5"/>').join('') +
      '<circle cx="100" cy="140" r="52" fill="#6d201c" stroke="' + GOLD + '" stroke-width="4"/>' + star(100, 140, 40) + '<circle cx="100" cy="140" r="8" fill="' + PAP + '" stroke="' + INK + '" stroke-width="2"/></svg>';
  }

  // ───────── Personagens: chapéu, pele, roupa, detalhe ─────────
  const stache = (c) => '<path d="M78 138c10 8 34 8 44 0" stroke="' + c + '" stroke-width="5" fill="none"/>';
  const CH = {
    tiao: { hat: '#5a3a1a', skin: '#e0b48a', body: '#7a3b2e', ex: '<path d="M80 134h40l-6 12h-28z" fill="#444" opacity=".35"/>', dica: 'perde vida? compra carta' },
    valeria: { hat: '#2f5d8a', skin: '#efc9a3', body: '#b23a2e', ex: '<path d="M68 112c0-26 64-26 64 0" stroke="#4a2a14" stroke-width="9" fill="none"/>', dica: 'Tiro vale Errou e vice-versa' },
    zegringo: { hat: '#6b4a2a', skin: '#c99a72', body: '#3f6b4a', ex: stache('#2b1a10') + '<path d="M70 128c10 20 50 20 60 0" stroke="#2b1a10" stroke-width="3" fill="none"/>', dica: 'rouba de quem o fere' },
    caca: { hat: '#8b6b2a', skin: '#e0b48a', body: '#555', ex: '<circle cx="100" cy="138" r="3" fill="#2b1a10"/>', dica: 'compra da mão de outro' },
    berenice: { hat: '#8b2f4a', skin: '#efc9a3', body: '#2f5d8a', ex: '<path d="M70 118c0-20 60-20 60 0" stroke="#5a2a14" stroke-width="10" fill="none"/>', dica: 'Barril embutido' },
    pepe: { hat: '#e9e0c8', skin: '#e0b48a', body: '#7a6a3a', ex: '<rect x="82" y="116" width="36" height="10" rx="5" fill="#9fd0e8" stroke="#2b1a10" stroke-width="3"/>', dica: 'vê 3 cartas, fica com 2' },
    duque: { hat: '#2b2b2b', skin: '#e0b48a', body: '#8b2f4a', ex: '<path d="M86 136l8 4 8-4 8 4 8-4" stroke="#2b1a10" stroke-width="3" fill="none"/>', dica: 'saque: escolhe a melhor' },
    paco: { hat: '#7a4a22', skin: '#d9b08a', body: '#c98a45', ex: stache('#2b1a10'), dica: 'cavalo embutido (+1)' },
    rosinha: { hat: '#b23a2e', skin: '#efc9a3', body: '#e0b48a', ex: '<path d="M66 112c0-24 68-24 68 0" stroke="#7a3b14" stroke-width="9" fill="none"/>', dica: 'luneta embutida (−1)' },
    pedrao: { hat: '#4a4a4a', skin: '#d9b08a', body: '#2f5d8a', ex: '<ellipse cx="100" cy="142" rx="14" ry="6" fill="#2b1a10"/>', dica: 'compra do descarte' },
    sid: { hat: '#e9e0c8', skin: '#e0b48a', body: '#c0c0c0', ex: '<path d="M86 124h8M106 124h8" stroke="#2b1a10" stroke-width="5"/><path d="M92 140h16" stroke="#2b1a10" stroke-width="3"/>', dica: '2 cartas = 1 vida' },
    nando: { hat: '#1f1f1f', skin: '#c99a72', body: '#7a1f2b', ex: '<path d="M74 118l50 8" stroke="#2b1a10" stroke-width="5"/>' + stache('#2b1a10'), dica: 'precisa de 2 Errou' },
    suzana: { hat: '#c9962b', skin: '#efc9a3', body: '#3f6b4a', ex: '<path d="M68 112c0-26 64-26 64 0" stroke="#d9a548" stroke-width="9" fill="none"/>', dica: 'mão vazia? compra' },
    abutre: { hat: '#2b2b2b', skin: '#d9b08a', body: '#555', ex: stache('#2b1a10'), dica: 'leva o espólio' },
    joca: { hat: '#9b6a35', skin: '#e0b48a', body: '#b23a2e', ex: '<circle cx="100" cy="140" r="4" fill="#fff" stroke="#2b1a10" stroke-width="2"/>', dica: 'Tiros sem limite' },
    blackjack: { hat: '#1f1f1f', skin: '#e0b48a', body: '#222', ex: '<path d="M80 112l40 0" stroke="#fff" stroke-width="3"/><text x="100" y="152" text-anchor="middle" font-size="16" fill="#b23a2e" font-family="Georgia,serif">♥♦</text>', dica: '2ª carta ♥/♦: +1' }
  };

  function charSvg(id, nome, hp, opts) {
    const d = CH[id] || CH.tiao; opts = opts || {};
    const fs = nome.length > 14 ? 13 : 16;
    return '<svg class="fwc" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="194" height="274" rx="16" fill="' + PAP + '" stroke="' + GOLD + '" stroke-width="6"/><rect x="22" y="22" width="156" height="30" rx="4" fill="' + BRN + '"/><text x="100" y="43" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="' + fs + '" fill="' + PAP + '">' + nome.toUpperCase() + '</text>' +
      '<rect x="22" y="58" width="156" height="150" fill="' + SKY + '" stroke="' + INK + '" stroke-width="2"/><rect x="23" y="150" width="154" height="57" fill="#c98a45"/>' +
      '<path d="M60 208c0-34 18-48 40-48s40 14 40 48z" fill="' + d.body + '" stroke="' + INK + '" stroke-width="3"/><circle cx="100" cy="120" r="34" fill="' + d.skin + '" stroke="' + INK + '" stroke-width="3"/>' + d.ex +
      '<path d="M56 108c0-8 6-12 12-12 4-22 60-22 64 0 6 0 12 4 12 12z" fill="' + d.hat + '" stroke="' + INK + '" stroke-width="3"/><rect x="40" y="104" width="120" height="10" rx="5" fill="' + d.hat + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="88" cy="124" r="3" fill="' + INK + '"/><circle cx="112" cy="124" r="3" fill="' + INK + '"/>' + (id === 'sid' || id === 'nando' ? '' : '<path d="M90 140q10 6 20 0" stroke="' + INK + '" stroke-width="3" fill="none"/>') +
      '<text x="100" y="230" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="12.5" fill="' + INK + '">' + d.dica + '</text>' +
      Array.from({ length: hp }, (_, i) => '<ellipse cx="' + (100 + (i - (hp - 1) / 2) * 20) + '" cy="255" rx="5" ry="9" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2"/>').join('') + '</svg>';
  }

  function roleSvg(role) {
    const R = {
      xerife: ['XERIFE', GOLD, star(60, 66, 40)],
      ajudante: ['AJUDANTE', BLU, '<circle cx="60" cy="66" r="34" fill="#d6dbe0" stroke="' + INK + '" stroke-width="3"/>' + star(60, 66, 22, '#8aa4bf')],
      bandido: ['BANDIDO', RED, '<circle cx="60" cy="62" r="30" fill="#e0b48a" stroke="' + INK + '" stroke-width="3"/><rect x="30" y="64" width="60" height="22" fill="' + RED + '" stroke="' + INK + '" stroke-width="3"/><path d="M34 52c8-14 44-14 52 0" fill="' + INK + '"/>'],
      renegado: ['RENEGADO', '#5a5a5a', '<circle cx="60" cy="66" r="34" fill="#444" stroke="' + INK + '" stroke-width="3"/><text x="60" y="84" text-anchor="middle" font-size="52" fill="' + GOLD + '" font-family="Georgia,serif" font-weight="700">?</text>']
    }[role] || ['?', '#555', ''];
    return '<svg class="fwr" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="114" height="144" rx="12" fill="' + PAP + '" stroke="' + R[1] + '" stroke-width="5"/>' + R[2] + '<text x="60" y="136" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="14" fill="' + INK + '">' + R[0] + '</text></svg>';
  }
  const bulletSvg = (on) => '<svg class="fwb" viewBox="0 0 20 34" xmlns="http://www.w3.org/2000/svg"><ellipse cx="10" cy="20" rx="7" ry="13" fill="' + (on ? GOLD : '#00000022') + '" stroke="' + INK + '" stroke-width="2"/></svg>';

  return { cardSvg, backSvg, charSvg, roleSvg, bulletSvg, TITLES, SUBS, COLORS: { INK, PAP, RED, BLU, GOLD, BRN } };
});
