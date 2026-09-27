/* Editor: the interactive tactical board (place players, draw arrows and zones, build steps, play the animation). */
const Editor = (() => {
  const { esc } = UI;
  let E = null;
  const TOOLS = [
    ['move', 'Bouger', 'hand'], ['home', 'Joueur', 'player'], ['away', 'Adversaire', 'player'], ['gk', 'Gardien', 'player'],
    ['ball', 'Ballon', 'ball'], ['cone', 'Plot', 'cone'], ['goal', 'But', 'goal'], ['arrow', 'Flèche', 'arrow'], ['zone', 'Zone', 'zone'], ['erase', 'Gomme', 'eraser'],
  ];
  const HINTS = {
    move: 'Touche un joueur, une flèche ou une zone pour le bouger ou le modifier.',
    home: 'Touche le terrain pour ajouter un joueur de ton équipe.',
    away: 'Touche le terrain pour ajouter un adversaire.',
    gk: 'Touche le terrain pour ajouter un gardien.',
    ball: 'Touche le terrain pour poser un ballon.',
    cone: 'Touche le terrain pour poser un plot.',
    goal: 'Touche le terrain pour poser un but.',
    arrow: 'Glisse ton doigt sur le terrain pour tracer une flèche.',
    zone: 'Glisse ton doigt sur le terrain pour dessiner une zone.',
    erase: 'Touche ce que tu veux effacer.',
  };
  const DURS = [[3, 'Lent'], [2, 'Normal'], [1.3, 'Rapide']];
  const club = () => Store.state.club;
  const cur = () => E.sc.steps[E.k];
  const findArrow = id => (cur().arrows || []).find(a => a.id === id);
  const findZone = id => (E.sc.zones || []).find(z => z.id === id);
  const findObj = id => E.sc.objects.find(o => o.id === id);

  /* ---------- lifecycle ---------- */
  function open(root, sc, opts = {}) {
    close();
    sc.overlays = sc.overlays || {}; sc.zones = sc.zones || [];
    sc.steps.forEach(st => { st.arrows = st.arrows || []; st.moves = st.moves || {}; });
    E = { sc, k: 0, tool: 'move', arrowType: 'course', zoneColor: 'jaune', coneColor: 'orange', sel: null, playing: false, hist: [], fut: [], drag: null, root, back: opts.back, dpr: 1 };
    root.innerHTML = `<div class="ed">
      <header class="ed-top">
        <button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button>
        <input class="ed-title" id="edTitle" value="${esc(sc.name)}" aria-label="Nom du schéma" maxlength="80">
        <span class="grow"></span>
        <button class="icon-btn" data-act="help" aria-label="Aide">${I.help}</button>
        <button class="icon-btn opt-btn" data-act="panel" aria-label="Options du terrain">${I.layers}</button>
        <button class="icon-btn" data-act="undo" aria-label="Annuler">${I.undo}</button>
        <button class="icon-btn" data-act="redo" aria-label="Rétablir">${I.redo}</button>
        <button class="btn primary" data-act="export">${I.share}<span>Exporter</span></button>
      </header>
      <nav class="ed-tools" id="edTools" aria-label="Outils"></nav>
      <div class="ed-stage"><canvas aria-label="Terrain"></canvas><div class="ed-hint" id="edHint"></div></div>
      <aside class="ed-side" id="edSide"></aside>
      <footer class="ed-steps" id="edSteps"></footer>
    </div>`;
    E.canvas = root.querySelector('canvas'); E.ctx = E.canvas.getContext('2d');
    bind(); renderTools(); renderSteps(); renderPanel();
    E.ro = new ResizeObserver(resize); E.ro.observe(root.querySelector('.ed-stage'));
    resize();
    Board.ensureBg(sc).then(() => { if (E && E.sc === sc) draw(); });
  }
  function close() {
    if (!E) return;
    E.playing = false; cancelAnimationFrame(E.raf); E.ro && E.ro.disconnect(); E = null;
  }
  function resize() {
    if (!E) return;
    const st = E.root.querySelector('.ed-stage'), dpr = Math.min(2, window.devicePixelRatio || 1);
    E.dpr = dpr; E.canvas.width = Math.max(10, st.clientWidth * dpr); E.canvas.height = Math.max(10, st.clientHeight * dpr);
    draw();
  }

  /* ---------- model changes ---------- */
  function snapshot() { E.hist.push(JSON.stringify(E.sc)); if (E.hist.length > 60) E.hist.shift(); E.fut = []; }
  function restore(json) {
    const obj = JSON.parse(json), sc = E.sc;
    Object.keys(sc).forEach(k => delete sc[k]); Object.assign(sc, obj);
    E.k = Math.min(E.k, sc.steps.length - 1); E.sel = null;
    commit(); renderSteps(); renderPanel();
  }
  function undo() { if (!E.hist.length) return UI.toast('Rien à annuler'); E.fut.push(JSON.stringify(E.sc)); restore(E.hist.pop()); }
  function redo() { if (!E.fut.length) return; E.hist.push(JSON.stringify(E.sc)); restore(E.fut.pop()); }
  function commit() { Store.upsert('schemas', E.sc); draw(); }

  function clampW(w) {
    const e = Board.extents(E.sc.field), r = Board.tokenR(E.sc.field);
    return [Board.clamp(w[0], e.x0 - r, e.x1 + r), Board.clamp(w[1], e.y0 - r, e.y1 + r)];
  }
  function nextLabel(color) {
    const used = new Set(E.sc.objects.filter(o => o.type === 'player' && o.color === color).map(o => String(o.label)));
    for (let n = 1; n < 99; n++) if (!used.has(String(n))) return String(n);
    return '';
  }
  function makeObj(tool, w) {
    const c = club(), f = E.sc.field;
    if (tool === 'home') return { type: 'player', color: c.homeBib, label: nextLabel(c.homeBib) };
    if (tool === 'away') return { type: 'player', color: c.awayBib, label: nextLabel(c.awayBib) };
    if (tool === 'gk') return { type: 'player', color: 'jaune', gk: true, label: 'G' };
    if (tool === 'ball') return { type: 'ball' };
    if (tool === 'cone') return { type: 'cone', color: E.coneColor };
    if (tool === 'goal') return { type: 'goal', size: f.format === 'zone' ? 'mini' : 'big', w: f.format === '11' ? 7.32 : 6, rot: w[0] > Board.dims(f).L / 2 ? 0 : 180 };
  }
  function addObject(o, p) {
    o.id = Store.uid(); E.sc.objects.push(o);
    E.sc.steps.forEach(st => st.pos[o.id] = p.slice());
    return o;
  }
  function removeThing(h) {
    const sc = E.sc;
    if (h.kind === 'obj') { sc.objects = sc.objects.filter(o => o.id !== h.id); sc.steps.forEach(st => { delete st.pos[h.id]; delete st.moves[h.id]; }); }
    if (h.kind === 'arrow') cur().arrows = cur().arrows.filter(a => a.id !== h.id);
    if (h.kind === 'zone') sc.zones = sc.zones.filter(z => z.id !== h.id);
  }
  function select(h) { E.sel = h; renderPanel(); draw(); }

  /* ---------- pointer ---------- */
  function wpos(e) { const r = E.canvas.getBoundingClientRect(); return E.cam.toW((e.clientX - r.left) * E.dpr, (e.clientY - r.top) * E.dpr); }
  function onDown(e) {
    if (!E || !E.cam || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (E.playing) stopPlay();
    E.canvas.setPointerCapture(e.pointerId);
    const w = wpos(e), st = cur(), r = E.cam.r, t = E.tool;
    if (t === 'move') {
      if (E.sel && E.sel.kind === 'arrow') {
        const a = findArrow(E.sel.id);
        if (a && Board.dist(w, a.a) < r * .9) return (E.drag = { kind: 'arrowEnd', end: 'a', id: a.id });
        if (a && Board.dist(w, a.b) < r * .9) return (E.drag = { kind: 'arrowEnd', end: 'b', id: a.id });
      }
      if (E.sel && E.sel.kind === 'zone') {
        const z = findZone(E.sel.id);
        if (z && Board.dist(w, [z.x + z.w, z.y + z.h]) < r * 1.1) return (E.drag = { kind: 'zoneResize', id: z.id });
      }
      const h = Board.hit(E.sc, E.k, E.cam, w);
      if (!h) return select(null);
      select(h);
      if (h.kind === 'obj') {
        const p = st.pos[h.id];
        const follow = E.sc.steps.map((s, j) => j > E.k && s.pos[h.id] && Board.dist(s.pos[h.id], p) < .01 ? j : -1).filter(j => j >= 0);
        E.drag = { kind: 'obj', id: h.id, off: [w[0] - p[0], w[1] - p[1]], follow };
      } else if (h.kind === 'zone') { const z = findZone(h.id); E.drag = { kind: 'zone', id: h.id, off: [w[0] - z.x, w[1] - z.y] }; }
      else if (h.kind === 'arrow') { const a = findArrow(h.id); E.drag = { kind: 'arrow', id: h.id, start: w, a0: a.a.slice(), b0: a.b.slice() }; }
      return;
    }
    if (['home', 'away', 'gk', 'ball', 'cone', 'goal'].includes(t)) {
      snapshot();
      const o = addObject(makeObj(t, w), clampW(w));
      E.sel = { kind: 'obj', id: o.id }; commit(); renderPanel();
      E.drag = { kind: 'obj', id: o.id, off: [0, 0], follow: E.sc.steps.map((s, j) => j > E.k ? j : -1).filter(j => j >= 0), placed: true };
      return;
    }
    if (t === 'arrow') return (E.drag = { kind: 'newArrow', a: w, b: w });
    if (t === 'zone') return (E.drag = { kind: 'newZone', a: w, b: w });
    if (t === 'erase') {
      const h = Board.hit(E.sc, E.k, E.cam, w);
      if (h) { snapshot(); removeThing(h); E.sel = null; commit(); renderPanel(); }
    }
  }
  function onMove(e) {
    if (!E || !E.drag) return;
    const d = E.drag, w = wpos(e), r = E.cam.r;
    if (!d.moved && !d.placed && ['obj', 'zone', 'arrow', 'arrowEnd', 'zoneResize'].includes(d.kind)) snapshot();
    d.moved = true;
    if (d.kind === 'obj') {
      const p = clampW([w[0] - d.off[0], w[1] - d.off[1]]);
      cur().pos[d.id] = p; d.follow.forEach(j => E.sc.steps[j].pos[d.id] = p.slice());
    } else if (d.kind === 'zone') { const z = findZone(d.id); z.x = w[0] - d.off[0]; z.y = w[1] - d.off[1]; }
    else if (d.kind === 'zoneResize') { const z = findZone(d.id); z.w = Math.max(r * 1.5, w[0] - z.x); z.h = Math.max(r * 1.5, w[1] - z.y); }
    else if (d.kind === 'arrow') { const a = findArrow(d.id), dx = w[0] - d.start[0], dy = w[1] - d.start[1]; a.a = [d.a0[0] + dx, d.a0[1] + dy]; a.b = [d.b0[0] + dx, d.b0[1] + dy]; }
    else if (d.kind === 'arrowEnd') { findArrow(d.id)[d.end] = w; }
    else if (d.kind === 'newArrow' || d.kind === 'newZone') d.b = w;
    draw();
  }
  function onUp() {
    if (!E || !E.drag) return;
    const d = E.drag, r = E.cam.r; E.drag = null;
    if (d.kind === 'newArrow') {
      if (Board.dist(d.a, d.b) > r * 1.2) {
        snapshot();
        const a = { id: Store.uid(), type: E.arrowType, a: d.a, b: d.b, c: 0 };
        cur().arrows.push(a); E.sel = { kind: 'arrow', id: a.id }; commit(); renderPanel();
      } else draw();
      return;
    }
    if (d.kind === 'newZone') {
      const x = Math.min(d.a[0], d.b[0]), y = Math.min(d.a[1], d.b[1]), w = Math.abs(d.b[0] - d.a[0]), h = Math.abs(d.b[1] - d.a[1]);
      if (w > r * 1.5 && h > r * 1.5) {
        snapshot();
        const z = { id: Store.uid(), x, y, w, h, color: E.zoneColor, label: '' };
        E.sc.zones.push(z); E.sel = { kind: 'zone', id: z.id }; commit(); renderPanel();
        const inp = E.root.querySelector('#zLabel'); if (inp) inp.focus();
      } else draw();
      return;
    }
    if (d.moved || d.placed) { commit(); if (E.sel) renderPanel(); }
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!E) return;
    const { ctx, canvas } = E, W = canvas.width, H = canvas.height;
    const k = E.playing ? E.pk : E.k, u = E.playing ? E.pu : 0;
    E.cam = Board.drawFrame(ctx, W, H, E.sc, k, u, { homeBib: club().homeBib, names: E.sc.overlays.names, vertical: H > W * 1.15, editor: E.playing ? null : { sel: E.sel } });
    const d = E.drag;
    if (d && d.kind === 'newArrow') Board.drawArrow(ctx, E.cam, d.a, d.b, 0, E.arrowType, 0, 0, .8);
    if (d && d.kind === 'newZone') {
      const [x1, y1] = E.cam.toS(d.a), [x2, y2] = E.cam.toS(d.b);
      ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = Board.ZONE_COLORS[E.zoneColor];
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); ctx.restore();
    }
  }

  /* ---------- playback ---------- */
  function play() {
    if (E.sc.steps.length < 2) return UI.toast('Ajoute une 2e étape pour voir le mouvement');
    E.playing = true; E.sel = null; renderPanel();
    const segs = [], n = E.sc.steps.length;
    for (let k = 0; k < n; k++) { segs.push({ k, move: false, d: .6 }); if (k < n - 1) segs.push({ k, move: true, d: Board.stepDur(E.sc, k) }); }
    segs.push({ k: n - 1, move: false, d: 1 });
    const total = segs.reduce((a, s) => a + s.d, 0);
    let t0 = performance.now();
    const tick = now => {
      if (!E || !E.playing) return;
      let t = (now - t0) / 1000;
      if (t > total) { t0 = now; t = 0; }
      let acc = 0, seg = segs[segs.length - 1];
      for (const s of segs) { if (t < acc + s.d) { seg = s; break; } acc += s.d; }
      E.pk = seg.k; E.pu = seg.move ? (t - acc) / seg.d : 0;
      E.root.querySelectorAll('.step-chip').forEach((c, i) => c.classList.toggle('playing', i === E.pk));
      draw(); E.raf = requestAnimationFrame(tick);
    };
    renderSteps(); E.raf = requestAnimationFrame(tick);
  }
  function stopPlay() {
    if (!E) return;
    E.playing = false; cancelAnimationFrame(E.raf); renderSteps(); draw();
  }

  /* ---------- toolbar, steps, side panel ---------- */
  function renderTools() {
    const c = club();
    E.root.querySelector('#edTools').innerHTML = TOOLS.map(([id, lab, ic]) => {
      const col = id === 'home' ? Board.BIBS[c.homeBib] : id === 'away' ? Board.BIBS[c.awayBib] : id === 'gk' ? Board.BIBS.jaune : null;
      const style = col ? ` style="color:${col[0]};--tool-ink:${col[1]}"` : '';
      return `<button class="tool ${E.tool === id ? 'on' : ''}" data-tool="${id}" aria-pressed="${E.tool === id}"><span class="ti"${style}>${I[ic]}</span><span>${lab}</span></button>`;
    }).join('');
    const hint = E.root.querySelector('#edHint');
    hint.textContent = HINTS[E.tool]; hint.classList.remove('gone');
    clearTimeout(E.hintT); E.hintT = setTimeout(() => hint.classList.add('gone'), 4000);
  }
  function renderSteps() {
    const n = E.sc.steps.length, st = cur();
    E.root.querySelector('#edSteps').innerHTML = `
      <button class="btn play ${E.playing ? 'on' : ''}" data-act="play">${E.playing ? I.pause : I.play}<span>${E.playing ? 'Pause' : 'Jouer'}</span></button>
      <div class="step-list" role="tablist" aria-label="Étapes">
        ${E.sc.steps.map((s, i) => `<button class="step-chip ${i === E.k ? 'on' : ''}" data-step="${i}" aria-label="Étape ${i + 1}">${i + 1}</button>`).join('')}
        <button class="btn soft" data-act="addStep" title="Ajoute une étape : copie la position actuelle, puis bouge les joueurs">${I.plus}<span>Étape</span></button>
      </div>
      <input class="step-note" id="stepNote" maxlength="140" placeholder="Explique l'étape ${E.k + 1} (ex : le 6 descend entre les centraux)" value="${esc(st.note || '')}">
      <label class="step-dur" title="Vitesse du mouvement vers l'étape suivante">
        <span>Vitesse</span>
        <select id="stepDur" ${E.k >= n - 1 ? 'disabled' : ''}>${DURS.map(([v, l]) => `<option value="${v}" ${Math.abs((st.dur || 2) - v) < .01 ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <button class="icon-btn" data-act="delStep" aria-label="Supprimer l'étape ${E.k + 1}" ${n < 2 ? 'disabled' : ''}>${I.trash}</button>`;
  }
  const chipRow = (items, attr, active) => `<div class="chips">${items.map(([v, l, sw]) => `<button class="chip ${v === active ? 'on' : ''}" data-${attr}="${v}">${sw || ''}${l}</button>`).join('')}</div>`;
  const swatch = c => `<i class="sw" style="background:${c}"></i>`;
  const arrowSw = t => { const a = Board.ARROWS[t]; return `<i class="asw" style="--c:${a.color};--d:${a.dash ? 'dashed' : a.wave ? 'dotted' : 'solid'}"></i>`; };
  const ARROW_ITEMS = () => Object.entries(Board.ARROWS).map(([k, a]) => [k, a.label, arrowSw(k)]);
  const CURVES = () => `<div class="chips"><button class="chip" data-curve="-0.25">↶ Courbe</button><button class="chip" data-curve="0">Droite</button><button class="chip" data-curve="0.25">Courbe ↷</button></div>`;

  function renderPanel() {
    const side = E.root.querySelector('#edSide'), sc = E.sc, sel = E.sel;
    let h = '';
    if (sel && sel.kind === 'obj') {
      const o = findObj(sel.id); if (!o) { E.sel = null; return renderPanel(); }
      const titles = { player: o.gk ? 'Gardien' : 'Joueur', ball: 'Ballon', cone: 'Plot', goal: 'But' };
      h += `<div class="panel-head"><h3>${titles[o.type]}</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer">${I.trash}</button></div>`;
      if (o.type === 'player') {
        const roster = sc.teamId ? Store.playersOf(sc.teamId) : [];
        h += `${roster.length ? `<label class="fld"><span>Joueur de l'effectif</span><select id="pWho"><option value="">Choisir un joueur…</option>${roster.map(p => `<option value="${p.id}" ${p.id === o.playerId ? 'selected' : ''}>${esc(Store.fullName(p))}${p.number ? ' (' + esc(p.number) + ')' : ''}</option>`).join('')}</select></label>` : ''}
          <label class="fld"><span>Numéro ou lettre</span><input id="pLabel" maxlength="3" value="${esc(o.label || '')}"></label>
          <label class="fld"><span>Nom affiché</span><input id="pName" maxlength="24" value="${esc(o.name || '')}" placeholder="Prénom"></label>
          <div class="lbl">Couleur du maillot</div>
          ${chipRow(Object.entries(Board.BIBS).map(([k, v]) => [k, '', swatch(v[0])]), 'bib', o.color)}
          <label class="switch"><input type="checkbox" id="pGk" ${o.gk ? 'checked' : ''}><span>C'est un gardien</span></label>`;
      }
      if (o.type === 'cone') h += `<div class="lbl">Couleur</div>${chipRow([['orange', 'Orange'], ['jaune', 'Jaune'], ['bleu', 'Bleu'], ['rouge', 'Rouge']], 'cone', o.color)}`;
      if (o.type === 'goal') h += `<div class="lbl">Taille</div>${chipRow([['big', 'Grand but'], ['mini', 'Mini-but']], 'gsize', o.size === 'mini' ? 'mini' : 'big')}
        <button class="btn soft" data-act="rotGoal">${I.rotate}<span>Tourner le but</span></button>`;
      if (o.type === 'player' || o.type === 'ball') {
        if (E.k > 0) {
          const A = sc.steps[E.k - 1].pos[o.id], B = cur().pos[o.id];
          if (A && B && Board.dist(A, B) > Board.tokenR(sc.field) * .6) {
            const ty = Board.moveType(sc, E.k - 1, o.id);
            h += `<div class="lbl">Flèche pour arriver ici (depuis l'étape ${E.k})</div>
              ${chipRow(ARROW_ITEMS().concat([['none', 'Pas de flèche', '']]), 'mt', ty)}${CURVES()}`;
          } else h += `<p class="tip">Pour faire bouger ${o.type === 'ball' ? 'le ballon' : 'ce joueur'} : ajoute une étape, puis déplace-le. La flèche se dessine toute seule.</p>`;
        } else h += `<p class="tip">Pour montrer un mouvement : touche « + Étape » en bas, puis déplace ${o.type === 'ball' ? 'le ballon' : 'le joueur'}.</p>`;
      }
    } else if (sel && sel.kind === 'arrow') {
      const a = findArrow(sel.id); if (!a) { E.sel = null; return renderPanel(); }
      h += `<div class="panel-head"><h3>Flèche</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer">${I.trash}</button></div>
        <div class="lbl">Type</div>${chipRow(ARROW_ITEMS(), 'at', a.type)}<div class="lbl">Forme</div>${CURVES()}
        <p class="tip">Tire sur les ronds blancs pour déplacer le début ou la fin.</p>`;
    } else if (sel && sel.kind === 'zone') {
      const z = findZone(sel.id); if (!z) { E.sel = null; return renderPanel(); }
      h += `<div class="panel-head"><h3>Zone</h3><button class="icon-btn danger" data-act="delSel" aria-label="Supprimer">${I.trash}</button></div>
        <label class="fld"><span>Nom de la zone</span><input id="zLabel" maxlength="30" value="${esc(z.label || '')}" placeholder="ex : zone de finition"></label>
        <div class="lbl">Couleur</div>${chipRow(Object.entries(Board.ZONE_COLORS).map(([k, v]) => [k, '', swatch(v)]), 'zc', z.color)}
        <p class="tip">Tire sur le rond blanc en bas à droite pour changer la taille.</p>`;
    } else {
      if (E.tool === 'arrow') h += `<div class="lbl">Type de flèche</div>${chipRow(ARROW_ITEMS(), 'tat', E.arrowType)}`;
      if (E.tool === 'zone') h += `<div class="lbl">Couleur de la zone</div>${chipRow(Object.entries(Board.ZONE_COLORS).map(([k, v]) => [k, '', swatch(v)]), 'tzc', E.zoneColor)}`;
      if (E.tool === 'cone') h += `<div class="lbl">Couleur du plot</div>${chipRow([['orange', 'Orange'], ['jaune', 'Jaune'], ['bleu', 'Bleu'], ['rouge', 'Rouge']], 'tcone', E.coneColor)}`;
      const ov = sc.overlays, f = sc.field;
      const tg = (id, lab) => `<label class="switch"><input type="checkbox" data-ov="${id}" ${ov[id] ? 'checked' : ''}><span>${lab}</span></label>`;
      h += `<h3>Afficher</h3>
        ${tg('lanes', 'Couloirs et demi-espaces')}${tg('phases', 'Zones de jeu : conservation, progression, déséquilibre, finition')}${tg('bloc', 'Bloc adverse')}${tg('names', 'Prénoms des joueurs')}
        <h3>Terrain</h3>
        ${f.format === 'bg' ? '<p class="tip">Le fond est une image importée (photo, page de PDF ou image de vidéo). Dessine dessus avec les outils : joueurs, flèches, zones et étapes.</p>' : chipRow([['11', 'Foot à 11'], ['8', 'Foot à 8'], ['5', 'Foot à 5'], ['zone', 'Zone libre']], 'fmt', f.format)}
        ${f.format === 'bg' ? '' : f.format === 'zone' ? `<div class="row2"><label class="fld"><span>Longueur (m)</span><input type="number" id="fW" min="5" max="110" value="${f.w || 30}"></label><label class="fld"><span>Largeur (m)</span><input type="number" id="fH" min="5" max="75" value="${f.h || 20}"></label></div>`
          : chipRow([['full', 'Terrain entier'], ['half', 'Demi-terrain']], 'view', f.view || 'full')}
        <h3>Équipe</h3>
        <label class="fld"><span>Catégorie</span><select id="scTeam"><option value="">Aucune</option>${Auth.teams().map(t => `<option value="${t.id}" ${t.id === sc.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        ${sc.teamId ? (() => { const onField = new Set(sc.objects.map(o => o.playerId).filter(Boolean)), free = Store.playersOf(sc.teamId).filter(p => !onField.has(p.id));
          return `<label class="fld"><span>Mettre un joueur sur le terrain</span><select id="addWho"><option value="">${free.length ? 'Choisir un joueur…' : 'Tout l\'effectif est sur le terrain'}</option>${free.map(p => `<option value="${p.id}">${esc(Store.fullName(p))}${p.number ? ' (' + esc(p.number) + ')' : ''}${p.pos ? ' · ' + esc(p.pos) : ''}</option>`).join('')}</select></label>`; })() : '<p class="tip">Choisis une catégorie pour placer tes joueurs avec un menu.</p>'}
        <button class="btn soft wide" data-act="formation" ${f.format === 'zone' || f.format === 'bg' ? 'disabled' : ''}>${I.formation}<span>Placer une formation</span></button>
        <h3>Les flèches</h3>
        <ul class="legend">${Object.entries(Board.ARROWS).map(([k, a]) => `<li>${arrowSw(k)}<span>${a.label}</span></li>`).join('')}</ul>`;
    }
    side.innerHTML = `<div class="side-grip"><b>${sel ? 'Modifier' : 'Options'}</b><button class="icon-btn" data-act="closePanel" aria-label="Fermer">${I.x}</button></div>` + h;
    E.root.querySelector('.opt-btn').classList.toggle('dot', !!sel);
  }

  // Put a roster player on the field, on the first free spot along our touchline
  function placePlayer(p) {
    snapshot();
    const sc = E.sc, { L, W } = Board.dims(sc.field), r = Board.tokenR(sc.field), st = cur();
    const used = Object.values(st.pos);
    let spot = [L * .25, W * .5];
    outer: for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
      const c = [r * 2 + i * r * 2.6, W - r * 1.4 - row * r * 2.6];
      if (c[0] > L - r) break;
      if (used.every(u => Board.dist(u, c) > r * 2.2)) { spot = c; break outer; }
    }
    const gk = p.pos === 'GB';
    const o = addObject({ type: 'player', color: gk ? 'jaune' : club().homeBib, gk, label: p.number ? String(p.number) : (gk ? 'G' : ''), name: Store.shortName(p), playerId: p.id }, spot);
    sc.overlays.names = true; E.sel = { kind: 'obj', id: o.id }; commit(); renderPanel();
    UI.toast(`${Store.shortName(p)} est sur le terrain : fais-le glisser à son poste`);
  }

  /* ---------- formation ---------- */
  function formationModal() {
    const f = E.sc.field, list = Object.keys(Formations[f.format] || {});
    const teams = Auth.teams().filter(t => t.format === f.format);
    UI.modal({
      title: 'Placer une formation',
      body: `<label class="fld"><span>Mon équipe</span><select id="fmTeam"><option value="">Sans prénoms</option>${teams.map(t => `<option value="${t.id}" ${t.id === E.sc.teamId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        <label class="fld"><span>Notre système</span><select id="fmHome">${list.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
        <label class="fld"><span>Adversaires</span><select id="fmAway"><option value="">Pas d'adversaires</option>${list.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" id="fmReplace" checked><span>Enlever les joueurs déjà placés</span></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Placer', kind: 'primary', onClick: (close, root) => {
        const team = Store.get('teams', root.querySelector('#fmTeam').value), home = root.querySelector('#fmHome').value, away = root.querySelector('#fmAway').value;
        placeFormation(team, home, away, root.querySelector('#fmReplace').checked);
      } }],
    });
  }
  function placeFormation(team, home, away, replace) {
    snapshot();
    const sc = E.sc, { L, W } = Board.dims(sc.field), c = club();
    if (replace) sc.objects.filter(o => o.type === 'player').map(o => o.id).forEach(id => removeThing({ kind: 'obj', id }));
    const roster = team ? Store.playersOf(team.id) : [];
    const gks = roster.filter(p => p.pos === 'GB'), field = roster.filter(p => p.pos !== 'GB');
    const k = away ? .88 : 1; // with two teams, each one stays in its own half so the strikers don't overlap
    Formations[sc.field.format][home].forEach(([lab, x, y, gk]) => {
      const who = gk ? gks.shift() : field.shift();
      addObject({ type: 'player', color: gk ? 'jaune' : c.homeBib, gk: !!gk, label: who && who.number ? String(who.number) : lab, name: who ? Store.shortName(who) : '', playerId: who ? who.id : undefined }, [x * k * L, y * W]);
    });
    if (away) Formations[sc.field.format][away].forEach(([lab, x, y, gk]) => addObject({ type: 'player', color: gk ? 'orange' : c.awayBib, gk: !!gk, label: gk ? 'G' : lab }, [(1 - x * k) * L, (1 - y) * W]));
    if (team) { sc.teamId = team.id; if (roster.length) sc.overlays.names = true; }
    E.sel = null; commit(); renderPanel();
  }

  /* ---------- export ---------- */
  function exportSheet() {
    const sc = E.sc, o = { homeBib: club().homeBib, names: sc.overlays.names };
    const run = async (label, fn) => {
      const b = UI.busy(label);
      try { const r = await fn(b.progress); if (r === 'downloaded') UI.toast('Fichier enregistré dans Téléchargements'); }
      catch (err) { UI.toast(err.message || 'Export impossible', 'err'); }
      finally { b.done(); }
    };
    UI.modal({
      title: 'Exporter', noFocus: true,
      body: `<div class="big-actions">
        <button class="big-act" data-x="png">${I.image}<b>Image</b><span>L'étape ${E.k + 1} en photo (PNG)</span></button>
        <button class="big-act" data-x="video" ${sc.steps.length < 2 ? 'disabled' : ''}>${I.video}<b>Vidéo</b><span>${sc.steps.length < 2 ? 'Il faut au moins 2 étapes' : "L'animation complète"}</span></button>
        <button class="big-act" data-x="pdf">${I.pdf}<b>PDF à imprimer</b><span>Toutes les étapes, 2 par page</span></button>
        <button class="big-act" data-x="json">${I.share}<b>Envoyer à un éducateur</b><span>Il pourra l'ouvrir dans son appli</span></button>
      </div>`,
      onOpen: (root, close) => root.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
        close(); const x = b.dataset.x;
        if (x === 'png') run('Création de l\'image…', () => Exporter.png(sc, E.k, o));
        if (x === 'video') run('Enregistrement de la vidéo… garde l\'appli ouverte', p => Exporter.video(sc, o, p));
        if (x === 'pdf') run('Création du PDF…', () => Exporter.pdfSchema(sc, club(), o));
        if (x === 'json') run('Préparation du fichier…', async () => Exporter.json(await Library.withBackgrounds(Store.exportSchema(sc)), sc.name));
      }),
    });
  }

  /* ---------- events ---------- */
  function bind() {
    const r = E.root;
    E.canvas.addEventListener('pointerdown', onDown);
    E.canvas.addEventListener('pointermove', onMove);
    E.canvas.addEventListener('pointerup', onUp);
    E.canvas.addEventListener('pointercancel', onUp);
    r.querySelector('#edTitle').addEventListener('change', e => { E.sc.name = e.target.value.trim() || 'Sans nom'; commit(); });
    r.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !E) return;
      const d = b.dataset;
      if (d.tool) { E.tool = d.tool; E.sel = null; renderTools(); renderPanel(); draw(); return; }
      if (d.step) { stopPlay(); E.k = +d.step; E.sel = null; renderSteps(); renderPanel(); draw(); return; }
      const sc = E.sc, sel = E.sel;
      const setSel = fn => { snapshot(); fn(); commit(); renderPanel(); };
      if (d.bib) return setSel(() => findObj(sel.id).color = d.bib);
      if (d.cone && sel) return setSel(() => findObj(sel.id).color = d.cone);
      if (d.gsize) return setSel(() => findObj(sel.id).size = d.gsize);
      if (d.mt) return setSel(() => { const m = cur().moves[sel.id] = cur().moves[sel.id] || {}; m.type = d.mt; });
      if (d.curve !== undefined) {
        if (sel && sel.kind === 'arrow') return setSel(() => findArrow(sel.id).c = +d.curve);
        if (sel && sel.kind === 'obj' && E.k > 0) return setSel(() => { const m = cur().moves[sel.id] = cur().moves[sel.id] || {}; m.c = +d.curve; });
        return;
      }
      if (d.at) return setSel(() => findArrow(sel.id).type = d.at);
      if (d.zc) return setSel(() => findZone(sel.id).color = d.zc);
      if (d.tat) { E.arrowType = d.tat; return renderPanel(); }
      if (d.tzc) { E.zoneColor = d.tzc; return renderPanel(); }
      if (d.tcone) { E.coneColor = d.tcone; return renderPanel(); }
      if (d.fmt) return setSel(() => { sc.field.format = d.fmt; if (d.fmt === 'zone') { sc.field.w = sc.field.w || 30; sc.field.h = sc.field.h || 20; } });
      if (d.view) return setSel(() => sc.field.view = d.view);
      switch (d.act) {
        case 'back': stopPlay(); close(); return history.length > 1 ? history.back() : (location.hash = '#/schemas');
        case 'help': return Help.open('schema');
        case 'panel': return E.root.querySelector('.ed').classList.toggle('panel-open');
        case 'closePanel': return E.root.querySelector('.ed').classList.remove('panel-open');
        case 'undo': return undo();
        case 'redo': return redo();
        case 'export': stopPlay(); return exportSheet();
        case 'play': return E.playing ? stopPlay() : play();
        case 'addStep': {
          stopPlay(); snapshot();
          const st = cur(), nst = { pos: JSON.parse(JSON.stringify(st.pos)), arrows: [], moves: {}, note: '', dur: 2 };
          sc.steps.splice(E.k + 1, 0, nst); E.k++; E.sel = null; E.tool = 'move';
          commit(); renderTools(); renderSteps(); renderPanel();
          return UI.toast(`Étape ${E.k + 1} : déplace les joueurs et le ballon`);
        }
        case 'delStep': {
          if (sc.steps.length < 2) return;
          UI.confirmBox(`Supprimer l'étape ${E.k + 1} ?`).then(ok => { if (!ok || !E) return; snapshot(); sc.steps.splice(E.k, 1); E.k = Math.max(0, E.k - 1); E.sel = null; commit(); renderSteps(); renderPanel(); });
          return;
        }
        case 'delSel': snapshot(); removeThing(sel); E.sel = null; commit(); return renderPanel();
        case 'rotGoal': return setSel(() => { const o = findObj(sel.id); o.rot = ((o.rot || 0) + 90) % 360; });
        case 'formation': return formationModal();
      }
    });
    r.addEventListener('input', e => {
      if (!E) return;
      const t = e.target, sel = E.sel;
      if (t.id === 'pLabel') { findObj(sel.id).label = t.value.trim(); draw(); }
      if (t.id === 'pName') { findObj(sel.id).name = t.value.trim(); draw(); }
      if (t.id === 'zLabel') { findZone(sel.id).label = t.value; draw(); }
      if (t.id === 'stepNote') { cur().note = t.value; }
    });
    r.addEventListener('change', e => {
      if (!E) return;
      const t = e.target, sc = E.sc;
      if (['pLabel', 'pName', 'zLabel', 'stepNote'].includes(t.id)) { commit(); return; }
      if (t.id === 'pGk') { snapshot(); const o = findObj(E.sel.id); o.gk = t.checked; if (t.checked) { o.color = 'jaune'; o.label = o.label || 'G'; } commit(); return renderPanel(); }
      if (t.dataset.ov) { sc.overlays[t.dataset.ov] = t.checked; return commit(); }
      if (t.id === 'fW' || t.id === 'fH') { snapshot(); sc.field.w = Board.clamp(+document.getElementById('fW').value || 30, 5, 110); sc.field.h = Board.clamp(+document.getElementById('fH').value || 20, 5, 75); return commit(); }
      if (t.id === 'scTeam') { sc.teamId = t.value || null; commit(); return renderPanel(); }
      if (t.id === 'addWho' && t.value) { placePlayer(Store.get('players', t.value)); return; }
      if (t.id === 'pWho') {
        snapshot(); const o = findObj(E.sel.id), p = Store.get('players', t.value);
        if (p) { o.playerId = p.id; o.name = Store.shortName(p); if (p.number) o.label = String(p.number); if (p.pos === 'GB') { o.gk = true; o.color = 'jaune'; } sc.overlays.names = true; }
        else { delete o.playerId; }
        commit(); return renderPanel();
      }
      if (t.id === 'stepDur') { snapshot(); cur().dur = +t.value; return commit(); }
    });
  }

  return { open, close };
})();
