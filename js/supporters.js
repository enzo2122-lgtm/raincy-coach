/* Supporters: the club's slogan, the crest turning like a coin (the slogan on its back), and the flag with the crest and the slogan,
   waving above supporters of all ages (a child, a teenager, a mum, a dad and a grandfather). Drawn in SVG, animated in app.css. */
const Supporters = (() => {
  const SLOGAN = 'Plus d\'un siècle de passion, d\'effort et de victoires : Notre Club, Notre Histoire, Notre Fierté.';
  let n = 0;

  // The back of the coin: the first part of the slogan around the ring, « Notre Club, Notre Histoire, Notre Fierté » in the middle
  function back() {
    const id = 'coinArc' + (++n);
    return `<svg class="coin-svg" viewBox="0 0 100 100" aria-hidden="true">
      <defs><path id="${id}" d="M50,50 m-40.5,0 a40.5,40.5 0 1,1 81,0 a40.5,40.5 0 1,1 -81,0"/></defs>
      <circle cx="50" cy="50" r="49" fill="#7a0a16"/><circle cx="50" cy="50" r="46.6" fill="none" stroke="#faf8f8" stroke-width="1.4"/>
      <circle cx="50" cy="50" r="33.5" fill="#0e1d45" stroke="#c9a45c" stroke-width="1.2"/>
      <text font-family="system-ui,sans-serif" font-weight="800" font-size="6.2" letter-spacing=".25" fill="#f3e2b5"><textPath href="#${id}" startOffset="1%">PLUS D'UN SIÈCLE DE PASSION, D'EFFORT ET DE VICTOIRES ⚜</textPath></text>
      <text x="50" y="27" text-anchor="middle" font-size="8" fill="#c9a45c">⚜</text>
      <g font-family="system-ui,sans-serif" font-weight="800" text-anchor="middle" fill="#fff">
        <text x="50" y="41" font-size="7.4">NOTRE CLUB</text><text x="50" y="51.5" font-size="7.4">NOTRE HISTOIRE</text><text x="50" y="62" font-size="7.4" fill="#e2c27d">NOTRE FIERTÉ</text></g>
      <text x="50" y="74" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="6" fill="#c9a45c" letter-spacing="1">1914</text>
    </svg>`;
  }
  // The crest as a coin: the crest in front, the slogan behind; cls = the class of the picture (hero-crest, lock-crest…)
  const coin = (cls = '') => `<span class="crest-live coin ${cls}-coin" role="img" aria-label="Blason du club · ${UI.esc(SLOGAN)}" title="${UI.esc(SLOGAN)}">
      <span class="coin-in"><span class="coin-face coin-front"><img src="icons/crest.png" alt="" class="${cls}"></span><span class="coin-face coin-back">${back()}</span></span></span>`;

  /* ---------- the flag held by the supporters ---------- */
  const W = 240, FX = 41, FY = 8, FW = 158, FH = 54, SLICES = 16;
  function flag() {
    const id = 'flagC' + (++n), sw = FW / SLICES;
    const content = `<g id="${id}">
        <defs><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#8c1024"/><stop offset=".55" stop-color="#6d0d1f"/><stop offset="1" stop-color="#0e1d45"/></linearGradient></defs>
        <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" fill="url(#${id}g)"/>
        <rect x="${FX + 2}" y="${FY + 2}" width="${FW - 4}" height="${FH - 4}" fill="none" stroke="#c9a45c" stroke-width=".9"/>
        <image href="icons/crest.png" x="${FX + 5}" y="${FY + 5}" width="44" height="44"/>
        <g font-family="system-ui,sans-serif" font-weight="800">
          <text x="${FX + 54}" y="${FY + 12}" font-size="5.2" fill="#f3e2b5">PLUS D'UN SIÈCLE DE PASSION,</text>
          <text x="${FX + 54}" y="${FY + 18.5}" font-size="5.2" fill="#f3e2b5">D'EFFORT ET DE VICTOIRES :</text>
          <text x="${FX + 54}" y="${FY + 29}" font-size="8" fill="#fff">Notre Club,</text>
          <text x="${FX + 54}" y="${FY + 39}" font-size="8" fill="#fff">Notre Histoire,</text>
          <text x="${FX + 54}" y="${FY + 49}" font-size="8" fill="#e2c27d">Notre Fierté.</text></g></g>`;
    // the flag cut in vertical strips that rise and fall one after the other: the wave runs from one pole to the other
    const strips = Array.from({ length: SLICES }, (_, i) => {
      const x = FX + i * sw, a = (3.2 * Math.sin(Math.PI * (i + .5) / SLICES)).toFixed(2);
      return `<g class="fl-s" style="--a:${a};animation-delay:${(-i * .11).toFixed(2)}s"><svg x="${x.toFixed(2)}" y="0" width="${(sw + .7).toFixed(2)}" height="80" viewBox="${x.toFixed(2)} 0 ${(sw + .7).toFixed(2)} 80"><use href="#${id}"/>
        <rect class="fl-sh" x="${x.toFixed(2)}" y="${FY}" width="${(sw + .7).toFixed(2)}" height="${FH}" style="animation-delay:${(-i * .11).toFixed(2)}s"/></svg></g>`;
    }).join('');
    const skin = ['#f1c9a5', '#c68642', '#8d5524', '#e0ac69', '#f5d0b5'];
    const pole = x => `<line x1="${x}" y1="4" x2="${x}" y2="118" stroke="#d9c08a" stroke-width="2.2" stroke-linecap="round"/><circle cx="${x}" cy="4" r="2.4" fill="#e2c27d"/>`;
    // body parts: a jersey, legs, a head; the arms go up
    const person = ({ x, top, h, shirt, legs, skin: sk, hair, arms, extra = '', cls }) => {
      const head = top + h * .13, sh = top + h * .27, hip = top + h * .62, w = h * .2;
      return `<g class="sp ${cls}">
        <rect x="${x - w * .42}" y="${hip - 1}" width="${w * .36}" height="${top + h - hip + 1}" rx="${w * .12}" fill="${legs}"/><rect x="${x + w * .06}" y="${hip - 1}" width="${w * .36}" height="${top + h - hip + 1}" rx="${w * .12}" fill="${legs}"/>
        <rect x="${x - w / 2}" y="${sh - 2}" width="${w}" height="${hip - sh + 3}" rx="${w * .3}" fill="${shirt}"/>
        ${arms}
        <circle cx="${x}" cy="${head}" r="${h * .1}" fill="${sk}"/>
        <circle cx="${x - h * .035}" cy="${head + h * .005}" r="${h * .011}" fill="#1a1a1a"/><circle cx="${x + h * .035}" cy="${head + h * .005}" r="${h * .011}" fill="#1a1a1a"/>
        <path d="M${x - h * .035},${head + h * .04} q${h * .035},${h * .03} ${h * .07},0" stroke="#1a1a1a" stroke-width="${h * .012}" fill="none" stroke-linecap="round"/>${hair}${extra}</g>`;
    };
    const arm = (x1, y1, x2, y2, c, wdt = 3) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${wdt}" stroke-linecap="round"/>`;
    const people = [
      // the dad holds the left pole with both hands
      person({ x: 32, top: 64, h: 62, shirt: '#8c1024', legs: '#1e2a4f', skin: skin[0], cls: 'sp-dad',
        hair: `<path d="M26,70 q6,-8 12,0 q-1,-4 -6,-5 q-5,1 -6,5z" fill="#3b2a1f"/>`,
        arms: arm(38, 82, 40.5, 70, skin[0], 3.2) + arm(27, 82, 40, 84, skin[0], 3.2),
        extra: `<path d="M26,79 l12,0 l-2,5 l-8,0z" fill="#e2c27d"/>` }),
      // the mum, a ponytail, one arm up
      person({ x: 70, top: 72, h: 54, shirt: '#0e1d45', legs: '#8c1024', skin: skin[1], cls: 'sp-mum',
        hair: `<path d="M64.6,78 q5.4,-8 10.8,0 q-1,-5 -5.4,-5.6 q-4.4,.6 -5.4,5.6z" fill="#2a1a12"/><path d="M75,76 q5,2 3,9" stroke="#2a1a12" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
        arms: arm(75, 88, 80, 74, skin[1]) + arm(65, 88, 60, 98, skin[1]) }),
      // the child jumps, both arms up
      person({ x: 102, top: 92, h: 34, shirt: '#8c1024', legs: '#0e1d45', skin: skin[4], cls: 'sp-kid',
        hair: `<path d="M98.6,95 q3.4,-5 6.8,0 q-1,-3 -3.4,-3.4 q-2.4,.4 -3.4,3.4z" fill="#c68a2b"/>`,
        arms: arm(105, 102, 109, 93, skin[4], 2.4) + arm(99, 102, 95, 93, skin[4], 2.4) }),
      // the teenager holds a scarf above the head
      person({ x: 146, top: 70, h: 56, shirt: '#0e1d45', legs: '#1e2a4f', skin: skin[2], cls: 'sp-teen',
        hair: `<path d="M140.4,76 q5.6,-9 11.2,0 q-1,-5 -5.6,-6 q-4.6,1 -5.6,6z" fill="#111"/>`,
        arms: arm(151, 86, 158, 70, skin[2]) + arm(141, 86, 134, 70, skin[2]),
        extra: `<g class="sp-scarf"><rect x="131" y="64" width="30" height="6" rx="1" fill="#8c1024"/><rect x="137" y="64" width="4" height="6" fill="#e2c27d"/><rect x="146" y="64" width="4" height="6" fill="#e2c27d"/><rect x="155" y="64" width="4" height="6" fill="#e2c27d"/></g>` }),
      // the grandfather holds the right pole, a cap and grey hair
      person({ x: 208, top: 68, h: 58, shirt: '#3b4a6b', legs: '#2b2f3a', skin: skin[3], cls: 'sp-granddad',
        hair: `<path d="M201.6,74 q6.4,-9 12.8,0 z" fill="#cfd2d6"/><path d="M201,73.4 q7,-8 14,0 l3,.8 l-17,0z" fill="#8c1024"/>`,
        arms: arm(203, 86, 200.5, 74, skin[3], 3.2) + arm(213, 86, 201, 88, skin[3], 3.2) }),
    ].join('');
    return `<svg class="flag-scene" viewBox="0 0 ${W} 130" role="img" aria-label="Des supporters du club de tous âges tiennent un drapeau : ${UI.esc(SLOGAN)}">
      <defs>${content}</defs>
      ${pole(FX - 1)}${pole(FX + FW + 1)}
      <g class="fl">${strips}</g>
      ${people}
    </svg>`;
  }
  // the crest of the menu (written in index.html) gets its back too
  const bb = document.getElementById('brandBack'); if (bb) bb.innerHTML = back();
  return { SLOGAN, coin, flag };
})();
