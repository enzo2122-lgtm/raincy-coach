/* Analyse: match video analysis and video briefings.
   A video of the library (or of a match's photos and videos) gets tagged sequences (goal, chance, ball lost…) with a note
   and the players involved; sequences from one or several videos make a briefing, shown full screen or exported as one video.
   Videos stay on the device (IndexedDB, js/media.js): the sequences are kept with the video, the briefings on this device. */
const Analyse = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const TAGS = [['but', '⚽', 'But marqué', '#15803d'], ['encaisse', '🥅', 'But encaissé', '#be123c'], ['occasion', '🎯', 'Occasion', '#0891b2'],
    ['recup', '🔄', 'Récupération', '#2563eb'], ['perte', '❌', 'Perte de balle', '#dc2626'], ['pressing', '🔥', 'Pressing', '#ea580c'],
    ['cpa', '🚩', 'Coup de pied arrêté', '#7c3aed'], ['defense', '🛡️', 'Bien défendu', '#0d9488'], ['erreur', '⚠️', 'Erreur', '#a16207'], ['autre', '✏️', 'Autre', '#475569']];
  const tagOf = k => TAGS.find(t => t[0] === k) || TAGS[TAGS.length - 1];
  const mmss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const BRIEF = 'raincy-briefings';
  const briefings = () => { try { return JSON.parse(localStorage.getItem(BRIEF)) || []; } catch (e) { return []; } };
  const saveBriefings = l => { try { localStorage.setItem(BRIEF, JSON.stringify(l)); } catch (e) { toast('Impossible d\'enregistrer le briefing sur cet appareil', 'err'); } };
  const pref = () => Object.assign({ before: 8, after: 4 }, S().ui.clipPref || {});
  let urlNow = null;
  const freeUrl = () => { if (urlNow) { URL.revokeObjectURL(urlNow); urlNow = null; } };

  /* ---------- analysis page (#/analyse/mediaId) ---------- */
  async function page(root, id) {
    freeUrl();
    const rec = id && await Media.get(id);
    if (!rec || rec.kind !== 'video') { root.innerHTML = `<div class="empty"><p>Vidéo introuvable sur cet appareil : les vidéos restent sur l'appareil qui les a importées.</p><a class="btn" href="#/bibliotheque">${I.back}<span>Bibliothèque</span></a></div>`; return; }
    rec.clips = rec.clips || [];
    if (!rec.matchId && String(rec.ref || '').startsWith('match:')) rec.matchId = rec.ref.slice(6);
    const match = () => rec.matchId && Store.get('matches', rec.matchId);
    const players = () => { const m = match(); return m ? (m.convoked || []).map(pid => Store.get('players', pid)).filter(Boolean).sort(Store.byName) : []; };
    urlNow = URL.createObjectURL(rec.blob);
    const ms = S().matches.filter(m => Auth.sees(m.teamId) && !m.exempt).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 60);
    root.innerHTML = `<header class="page-head an-head"><div><h1>🎬 Analyse vidéo</h1><p class="sub">${esc(rec.name || 'Vidéo')}</p></div>
      <div class="head-actions"><button class="btn" data-a="back">${I.back}<span>Retour</span></button><button class="btn primary" data-a="briefings">${I.video}<span>Briefings</span></button></div></header>
      <label class="fld an-match"><span>Match analysé (pour choisir les joueurs)</span><select id="anMatch"><option value="">Aucun</option>${ms.map(m => `<option value="${m.id}" ${m.id === rec.matchId ? 'selected' : ''}>${esc(UI.fmtDate(m.date))} · ${esc((Store.get('teams', m.teamId) || {}).name || '')} ${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</option>`).join('')}</select></label>
      <div class="an-player"><video id="anVideo" src="${urlNow}" playsinline preload="auto"></video><div class="an-time" id="anTime">0:00</div></div>
      <div class="an-bar" id="anBar" role="slider" aria-label="Position dans la vidéo"><i class="an-pos" id="anPos"></i></div>
      <div class="an-ctrl">
        <button class="icon-btn" data-a="-5" aria-label="Reculer de 5 secondes">−5</button><button class="icon-btn" data-a="-f" aria-label="Image précédente">◀︎|</button>
        <button class="btn primary an-play" data-a="play" id="anPlay">${I.play}<span>Lecture</span></button>
        <button class="icon-btn" data-a="+f" aria-label="Image suivante">|▶︎</button><button class="icon-btn" data-a="+5" aria-label="Avancer de 5 secondes">+5</button>
        <span class="an-speed">${[.25, .5, 1, 2].map(r => `<button class="chip ${r === 1 ? 'on' : ''}" data-rate="${r}">×${String(r).replace('.', ',')}</button>`).join('')}</span></div>
      <section class="card"><div class="row-head"><h2>Marquer une action</h2><button class="linkish" data-a="pref">Séquence : ${pref().before} s avant, ${pref().after} s après</button></div>
        <div class="an-tags">${TAGS.map(([k, ic, l, c]) => `<button class="an-tag" data-tag="${k}" style="--c:${c}"><b>${ic}</b><span>${esc(l)}</span></button>`).join('')}</div></section>
      <div id="anStats"></div>
      <h2 class="section">Séquences</h2><div id="anClips"></div>`;
    const v = $('#anVideo', root), bar = $('#anBar', root);
    const save = async () => { await Media.put(rec); };
    const drawBar = () => {
      const d = isFinite(v.duration) ? v.duration : 0;
      bar.innerHTML = `<i class="an-pos" id="anPos" style="left:${d ? v.currentTime / d * 100 : 0}%"></i>` + (d ? rec.clips.map(c => `<button class="an-mark" data-seek="${c.start}" style="left:${c.start / d * 100}%;width:${Math.max(.6, (c.end - c.start) / d * 100)}%;--c:${tagOf(c.tag)[3]}" title="${esc(tagOf(c.tag)[2])} ${mmss(c.start)}"></button>`).join('') : '');
    };
    const drawStats = () => {
      const n = {}; rec.clips.forEach(c => { n[c.tag] = (n[c.tag] || 0) + 1; });
      $('#anStats', root).innerHTML = rec.clips.length ? `<div class="an-stats">${TAGS.filter(t => n[t[0]]).map(([k, ic, l, c]) => `<span style="--c:${c}">${ic} ${esc(l)} <b>${n[k]}</b></span>`).join('')}</div>` : '';
    };
    const clipRow = (c, i) => { const t = tagOf(c.tag), ps = players();
      return `<article class="card an-clip" data-clip="${c.id}" style="--c:${t[3]}">
        <div class="an-clip-head"><b>${t[1]} ${esc(t[2])}</b><span class="muted">${mmss(c.start)} → ${mmss(c.end)} · ${Math.round(c.end - c.start)} s</span><span class="grow"></span>
          <button class="btn soft" data-play="${c.id}">${I.play}<span>Voir</span></button></div>
        <div class="chips an-edit"><button class="chip" data-in="${c.id}">⇤ Début ici</button><button class="chip" data-out="${c.id}">Fin ici ⇥</button>
          <select class="add-select" data-retag="${c.id}" aria-label="Type d'action">${TAGS.map(([k, ic, l]) => `<option value="${k}" ${k === c.tag ? 'selected' : ''}>${ic} ${esc(l)}</option>`).join('')}</select></div>
        <label class="fld"><span>Commentaire (s'affiche dans le briefing)</span><input data-note="${c.id}" value="${esc(c.note || '')}" maxlength="120" placeholder="ex : on laisse l'intervalle ouvert entre le 4 et le 5"></label>
        ${ps.length ? `<div class="chips an-players">${ps.map(p => `<button class="chip ${(c.players || []).includes(p.id) ? 'on' : ''}" data-pl="${c.id}|${p.id}">${esc(Store.shortName(p))}</button>`).join('')}</div>` : ''}
        <div class="chips"><button class="btn soft" data-draw="${c.id}">${I.board}<span>Dessiner sur l'image</span></button><button class="btn soft" data-brief="${c.id}">${I.video}<span>Ajouter à un briefing</span></button>
          <button class="btn soft" data-share="${c.id}">${I.share}<span>Exporter</span></button><button class="icon-btn danger" data-del="${c.id}" aria-label="Supprimer la séquence">${I.trash}</button></div></article>`; };
    const drawClips = () => {
      rec.clips.sort((a, b) => a.start - b.start);
      $('#anClips', root).innerHTML = rec.clips.length ? rec.clips.map(clipRow).join('') : '<p class="muted">Lance la vidéo et touche une action (But, Occasion, Perte de balle…) au moment où elle arrive : la séquence est créée toute seule.</p>';
      drawBar(); drawStats();
    };
    drawClips();
    let stopAt = null;
    // a video recorded in a browser may not know its length until the end has been read once
    v.onloadedmetadata = () => { if (v.duration === Infinity) { v.currentTime = 1e7; v.ondurationchange = () => { if (isFinite(v.duration)) { v.ondurationchange = null; v.currentTime = 0; drawBar(); } }; } drawBar(); };
    v.ontimeupdate = () => {
      $('#anTime', root).textContent = mmss(v.currentTime) + (isFinite(v.duration) ? ' / ' + mmss(v.duration) : '');
      const p = $('#anPos', root); if (p && isFinite(v.duration) && v.duration) p.style.left = v.currentTime / v.duration * 100 + '%';
      if (stopAt !== null && v.currentTime >= stopAt) { v.pause(); stopAt = null; }
    };
    v.onplay = v.onpause = () => { $('#anPlay', root).innerHTML = v.paused ? `${I.play}<span>Lecture</span>` : `${I.pause}<span>Pause</span>`; };
    bar.onclick = e => { const m = e.target.closest('[data-seek]'); if (m) { v.currentTime = +m.dataset.seek; return; } const r = bar.getBoundingClientRect(); if (isFinite(v.duration) && v.duration) v.currentTime = (e.clientX - r.left) / r.width * v.duration; };
    $('#anMatch', root).onchange = async e => { rec.matchId = e.target.value || null; await save(); drawClips(); };
    root.oninput = e => { const n = e.target.dataset.note; if (n) { const c = rec.clips.find(x => x.id === n); c.note = e.target.value; clearTimeout(page.t); page.t = setTimeout(save, 500); } };
    root.onchange = async e => { const t = e.target.dataset.retag; if (t) { rec.clips.find(x => x.id === t).tag = e.target.value; await save(); drawClips(); } };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'back') { v.pause(); return history.length > 1 ? history.back() : (location.hash = '#/bibliotheque'); }
      if (a === 'briefings') { v.pause(); return briefingsDialog(); }
      if (a === 'play') { stopAt = null; return v.paused ? v.play().catch(() => {}) : v.pause(); }
      if (a === '-5' || a === '+5') { v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (a === '-5' ? -5 : 5))); return; }
      if (a === '-f' || a === '+f') { v.pause(); v.currentTime = Math.max(0, v.currentTime + (a === '-f' ? -1 : 1) / 25); return; }
      if (a === 'pref') return prefDialog(() => page(root, id));
      if (b.dataset.rate) { v.playbackRate = +b.dataset.rate; $$('[data-rate]', root).forEach(x => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.tag) {
        const t = v.currentTime, p = pref(), c = { id: Store.uid(), tag: b.dataset.tag, start: Math.max(0, t - p.before), end: Math.min(isFinite(v.duration) && v.duration ? v.duration : t + p.after, t + p.after), at: t, note: '', players: [] };
        rec.clips.push(c); await save(); drawClips();
        return toast(`${tagOf(c.tag)[1]} ${tagOf(c.tag)[2]} à ${mmss(t)} : séquence ${mmss(c.start)} → ${mmss(c.end)}`);
      }
      const clip = x => rec.clips.find(c => c.id === x);
      if (b.dataset.play) { const c = clip(b.dataset.play); v.currentTime = c.start; stopAt = c.end; v.play().catch(() => {}); v.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (b.dataset.in) { const c = clip(b.dataset.in); if (v.currentTime >= c.end) return toast('Le début doit être avant la fin', 'err'); c.start = v.currentTime; await save(); return drawClips(); }
      if (b.dataset.out) { const c = clip(b.dataset.out); if (v.currentTime <= c.start) return toast('La fin doit être après le début', 'err'); c.end = v.currentTime; await save(); return drawClips(); }
      if (b.dataset.pl) { const [cid, pid] = b.dataset.pl.split('|'), c = clip(cid); c.players = (c.players || []).includes(pid) ? c.players.filter(x => x !== pid) : [...(c.players || []), pid]; b.classList.toggle('on'); return save(); }
      if (b.dataset.del) { if (await confirmBox('Supprimer cette séquence ?', 'Supprimer')) { rec.clips = rec.clips.filter(c => c.id !== b.dataset.del); await save(); drawClips(); } return; }
      if (b.dataset.brief) return addToBriefing([{ mediaId: rec.id, clipId: b.dataset.brief }]);
      if (b.dataset.share) return exportVideo([{ rec, clip: clip(b.dataset.share) }], `${tagOf(clip(b.dataset.share).tag)[2]} · ${rec.name || 'match'}`);
      if (b.dataset.draw) {
        // the frame on screen if it is inside the sequence, otherwise the moment of the action
        const c = clip(b.dataset.draw); v.pause();
        if (v.currentTime < c.start || v.currentTime > c.end) { v.currentTime = c.at != null ? c.at : c.start; await new Promise(r => { v.onseeked = () => { v.onseeked = null; r(); }; setTimeout(r, 1500); }); }
        const cv = Media.drawScaled(v, v.videoWidth, v.videoHeight, 1600), blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .88));
        const sc = await Library.drawOnFrame(blob, cv.width, cv.height, `${tagOf(c.tag)[2]} · ${mmss(v.currentTime)} · ${rec.name || 'vidéo'}`);
        location.hash = '#/schema/' + sc.id; return;
      }
    };
  }
  function prefDialog(done) {
    const p = pref();
    modal({ title: 'Longueur des séquences', body: `<p class="muted small">Quand tu touches une action, la séquence commence un peu avant (pour voir comment l'action se construit) et finit un peu après.</p>
      <div class="row2"><label class="fld"><span>Secondes avant</span><input id="pB" type="number" min="0" max="60" value="${p.before}"></label><label class="fld"><span>Secondes après</span><input id="pA" type="number" min="0" max="60" value="${p.after}"></label></div>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { S().ui.clipPref = { before: Math.max(0, Math.min(60, +$('#pB', r).value || 0)), after: Math.max(0, Math.min(60, +$('#pA', r).value || 0)) }; Store.persistNow(); done && done(); } }] });
  }

  /* ---------- briefings (this device) ---------- */
  function addToBriefing(items) {
    const list = briefings();
    modal({ title: 'Ajouter à un briefing', body: `${list.length ? `<label class="fld"><span>Briefing</span><select id="bSel">${list.map(b => `<option value="${b.id}">${esc(b.name)} (${b.items.length})</option>`).join('')}<option value="">+ Nouveau briefing…</option></select></label>` : ''}
      <label class="fld" id="bNewBox" ${list.length ? 'hidden' : ''}><span>Nom du nouveau briefing</span><input id="bNew" maxlength="60" placeholder="ex : Seniors · causerie samedi"></label>`,
      onOpen: r => { const s = $('#bSel', r); if (s) s.onchange = () => { $('#bNewBox', r).hidden = !!s.value; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const all = briefings(), sel = $('#bSel', r) ? $('#bSel', r).value : '';
        let b = sel && all.find(x => x.id === sel);
        if (!b) { const name = $('#bNew', r).value.trim(); if (!name) { toast('Donne un nom au briefing', 'err'); return false; } b = { id: Store.uid(), name, items: [], at: Date.now() }; all.unshift(b); }
        items.forEach(it => { if (!b.items.some(x => x.clipId === it.clipId)) b.items.push(it); });
        saveBriefings(all); toast(`Ajouté au briefing « ${b.name} » (${b.items.length} séquence${b.items.length > 1 ? 's' : ''})`);
      } }] });
  }
  // the clips of a briefing, with their video (a video removed from the device is skipped)
  async function resolve(b) {
    const out = [], cache = {};
    for (const it of b.items) {
      const rec = cache[it.mediaId] || (cache[it.mediaId] = await Media.get(it.mediaId));
      const clip = rec && (rec.clips || []).find(c => c.id === it.clipId);
      if (clip) out.push({ rec, clip });
    }
    return out;
  }
  function briefingsDialog() {
    const list = briefings();
    const close = modal({ title: 'Briefings vidéo', noFocus: true, body: list.length ? `<div class="list">${list.map(b => `<div class="list-item bf-item"><span class="li-main"><b>${esc(b.name)}</b><span class="muted">${b.items.length} séquence${b.items.length > 1 ? 's' : ''}</span></span>
        <button class="btn primary" data-bopen="${b.id}">${I.play}<span>Ouvrir</span></button></div>`).join('')}</div>` : '<p class="muted">Pas encore de briefing. Dans une analyse, touche « Ajouter à un briefing » sous une séquence.</p>',
      onOpen: r => $$('[data-bopen]', r).forEach(x => x.onclick = () => { close(); location.hash = '#/briefing/' + x.dataset.bopen; }) });
  }
  async function briefingPage(root, id) {
    freeUrl();
    const all = briefings(), b = all.find(x => x.id === id);
    if (!b) { root.innerHTML = `<div class="empty"><p>Briefing introuvable sur cet appareil.</p><a class="btn" href="#/bibliotheque">${I.back}<span>Bibliothèque</span></a></div>`; return; }
    const items = await resolve(b);
    root.innerHTML = `<header class="page-head"><div><h1>🎬 ${esc(b.name)}</h1><p class="sub">Briefing vidéo · ${items.length} séquence${items.length > 1 ? 's' : ''} · ${mmss(items.reduce((a, x) => a + x.clip.end - x.clip.start, 0))}</p></div>
      <div class="head-actions"><button class="btn" data-b="back">${I.back}<span>Retour</span></button><button class="btn" data-b="export" ${items.length ? '' : 'disabled'}>${I.download}<span>Exporter en vidéo</span></button><button class="btn primary" data-b="present" ${items.length ? '' : 'disabled'}>${I.play}<span>Présenter</span></button></div></header>
      <label class="fld"><span>Nom</span><input id="bfName" value="${esc(b.name)}" maxlength="60"></label>
      <div class="list">${items.map(({ rec, clip }, i) => { const t = tagOf(clip.tag), ps = (clip.players || []).map(pid => Store.get('players', pid)).filter(Boolean);
        return `<div class="list-item bf-row" style="--c:${t[3]}"><span class="bf-n">${i + 1}</span><span class="li-main"><b>${t[1]} ${esc(t[2])}${clip.note ? ' · ' + esc(clip.note) : ''}</b>
          <span class="muted">${esc(rec.name || 'vidéo')} · ${mmss(clip.start)} → ${mmss(clip.end)}${ps.length ? ' · ' + ps.map(p => esc(Store.shortName(p))).join(', ') : ''}</span></span>
          <button class="icon-btn" data-mv="${i}|-1" ${i ? '' : 'disabled'} aria-label="Monter">${I.up}</button><button class="icon-btn" data-mv="${i}|1" ${i < items.length - 1 ? '' : 'disabled'} aria-label="Descendre">${I.down}</button>
          <button class="icon-btn danger" data-rm="${i}" aria-label="Retirer">${I.x}</button></div>`; }).join('') || '<p class="muted">Aucune séquence (les vidéos ont peut-être été supprimées de cet appareil).</p>'}</div>
      <div class="danger-zone"><button class="btn danger" data-b="delete">${I.trash}<span>Supprimer le briefing</span></button></div>`;
    const persist = () => { const l = briefings(), i = l.findIndex(x => x.id === b.id); if (i >= 0) l[i] = b; saveBriefings(l); };
    $('#bfName', root).onchange = e => { b.name = e.target.value.trim() || b.name; persist(); };
    root.onclick = async e => {
      const x = e.target.closest('button'); if (!x) return;
      if (x.dataset.b === 'back') return history.length > 1 ? history.back() : (location.hash = '#/bibliotheque');
      if (x.dataset.b === 'present') return present(items, b.name);
      if (x.dataset.b === 'export') return exportVideo(items, b.name);
      if (x.dataset.b === 'delete') { if (await confirmBox(`Supprimer le briefing « ${b.name} » ? Les séquences restent dans leurs vidéos.`)) { saveBriefings(briefings().filter(y => y.id !== b.id)); location.hash = '#/bibliotheque'; } return; }
      if (x.dataset.mv) { const [i, d] = x.dataset.mv.split('|').map(Number); [b.items[i], b.items[i + d]] = [b.items[i + d], b.items[i]]; persist(); return briefingPage(root, id); }
      if (x.dataset.rm) { b.items.splice(+x.dataset.rm, 1); persist(); return briefingPage(root, id); }
    };
  }

  /* ---------- full-screen presentation ---------- */
  function present(items, name) {
    const ov = document.createElement('div'); ov.className = 'an-show'; document.body.appendChild(ov);
    const urls = {}; let i = 0, v = null, stop = false, timer = null;
    const urlOf = rec => urls[rec.id] || (urls[rec.id] = URL.createObjectURL(rec.blob));
    const end = () => { stop = true; clearTimeout(timer); if (v) v.pause(); Object.values(urls).forEach(u => URL.revokeObjectURL(u)); ov.remove(); document.removeEventListener('keydown', key); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} };
    const key = e => { if (e.key === 'Escape') end(); if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); if (e.key === ' ') { e.preventDefault(); if (v) v.paused ? v.play() : v.pause(); } };
    document.addEventListener('keydown', key);
    try { const d = document.documentElement, p = (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    function go(n) {
      if (stop) return; clearTimeout(timer);
      if (n < 0) n = 0;
      if (n >= items.length) { ov.innerHTML = `<div class="an-card"><p>Fin du briefing</p><h2>${esc(name)}</h2><button class="btn primary" data-x="again">${I.rotate}<span>Revoir</span></button><button class="btn" data-x="close">Fermer</button></div>`; return; }
      i = n; const { rec, clip } = items[i], t = tagOf(clip.tag), ps = (clip.players || []).map(pid => Store.get('players', pid)).filter(Boolean);
      const caption = `<b>${t[1]} ${esc(t[2])}</b>${clip.note ? ' · ' + esc(clip.note) : ''}${ps.length ? `<span>${ps.map(p => esc(Store.shortName(p))).join(', ')}</span>` : ''}`;
      // a title card, then the sequence
      ov.innerHTML = `<div class="an-card" style="--c:${t[3]}"><p>${i + 1} / ${items.length}</p><h2>${t[1]} ${esc(t[2])}</h2>${clip.note ? `<p class="an-note">${esc(clip.note)}</p>` : ''}</div>`;
      timer = setTimeout(() => {
        if (stop) return;
        ov.innerHTML = `<video playsinline></video><div class="an-cap">${caption}</div>
          <div class="an-show-ctrl"><button class="icon-btn" data-x="prev" aria-label="Précédente">${I.back}</button><button class="icon-btn" data-x="pause" aria-label="Pause">${I.pause}</button>
          <span>${i + 1} / ${items.length}</span><button class="icon-btn" data-x="next" aria-label="Suivante">${I.next}</button><button class="icon-btn" data-x="close" aria-label="Fermer">${I.x}</button></div>`;
        v = $('video', ov); v.src = urlOf(rec);
        // with the sound when the browser allows it, otherwise muted
        v.onloadedmetadata = () => { v.currentTime = clip.start; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); };
        v.ontimeupdate = () => { if (v.currentTime >= clip.end) { v.ontimeupdate = v.onended = null; v.pause(); go(i + 1); } };
        v.onended = () => { v.ontimeupdate = v.onended = null; go(i + 1); };
      }, 1800);
    }
    ov.onclick = e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x;
      if (x === 'close') return end();
      if (x === 'again') return go(0);
      if (x === 'next') return go(i + 1);
      if (x === 'prev') return go(i - 1);
      if (x === 'pause' && v) { if (v.paused) { v.play(); b.innerHTML = I.pause; } else { v.pause(); b.innerHTML = I.play; } }
    };
    go(0);
  }

  /* ---------- one video file (share on WhatsApp): title cards + the sequences, with their caption ---------- */
  function pickMime() {
    const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (!window.MediaRecorder) return null;
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  }
  async function exportVideo(items, name) {
    if (!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream)) return toast('Cet appareil ne sait pas créer de vidéo depuis l\'appli : utilise « Présenter » avec l\'enregistrement d\'écran.', 'err');
    const total = items.reduce((a, x) => a + (x.clip.end - x.clip.start) + 1.8, 2.2);
    if (!(await confirmBox(`Créer la vidéo « ${name} » (${mmss(total)}) ? Garde l'appli ouverte pendant l'enregistrement, qui dure le temps de la vidéo.`, 'Créer la vidéo'))) return;
    const bz = UI.busy('Création de la vidéo… garde l\'appli ouverte');
    const W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), mime = pickMime(), stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 5e6 }, mime ? { mimeType: mime } : {}));
    const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    // the video plays in the page (hidden) so every browser decodes its images
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.style.cssText = 'position:fixed;left:-10px;top:0;width:2px;height:2px;opacity:0';
    document.body.appendChild(v);
    const urls = [];
    const wrap = (text, maxW, font) => { ctx.font = font; const words = String(text).split(/\s+/), lines = []; let l = ''; words.forEach(w => { const t = l ? l + ' ' + w : w; if (ctx.measureText(t).width > maxW && l) { lines.push(l); l = w; } else l = t; }); if (l) lines.push(l); return lines; };
    const card = async (color, top, title, sub, ms) => {
      const t0 = performance.now();
      await new Promise(res => { const tick = () => {
        ctx.fillStyle = '#0e1d45'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = color || '#8c1024'; ctx.fillRect(0, H - 14, W, 14);
        ctx.fillStyle = '#e2c27d'; ctx.font = '600 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(top, W / 2, H / 2 - 80);
        ctx.fillStyle = '#fff'; wrap(title, W - 160, '800 58px system-ui, sans-serif').slice(0, 2).forEach((l, k) => ctx.fillText(l, W / 2, H / 2 + k * 66));
        if (sub) { ctx.fillStyle = '#cbd5e1'; wrap(sub, W - 200, '500 32px system-ui, sans-serif').slice(0, 3).forEach((l, k) => ctx.fillText(l, W / 2, H / 2 + 110 + k * 42)); }
        if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(); }; tick(); });
    };
    try {
      rec.start(250);
      await card('#8c1024', `${S().club.name || 'Raincy Coach'} · Briefing vidéo`, name, `${items.length} séquence${items.length > 1 ? 's' : ''}`, 2200);
      for (let k = 0; k < items.length; k++) {
        const { rec: m, clip } = items[k], t = tagOf(clip.tag), ps = (clip.players || []).map(pid => Store.get('players', pid)).filter(Boolean);
        bz.progress(k / items.length);
        await card(t[3], `${k + 1} / ${items.length}`, `${t[1]} ${t[2]}`, clip.note || '', 1800);
        const u = URL.createObjectURL(m.blob); urls.push(u); v.src = u;
        await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 5000); });
        v.currentTime = clip.start; await new Promise(r => { v.onseeked = r; setTimeout(r, 3000); });
        await v.play().catch(() => {});
        await new Promise(res => { const tick = () => {
          const vw = v.videoWidth || 16, vh = v.videoHeight || 9, s = Math.min(W / vw, H / vh), dw = vw * s, dh = vh * s;
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); try { ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) {}
          // caption bar at the bottom
          const cap = `${t[1]} ${t[2]}${clip.note ? ' · ' + clip.note : ''}${ps.length ? ' · ' + ps.map(p => Store.shortName(p)).join(', ') : ''}`;
          ctx.fillStyle = 'rgba(14,29,69,.82)'; ctx.fillRect(0, H - 70, W, 70); ctx.fillStyle = t[3]; ctx.fillRect(0, H - 70, 10, 70);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '700 28px system-ui, sans-serif'; ctx.fillText(wrap(cap, W - 60, '700 28px system-ui, sans-serif')[0] || '', 28, H - 26);
          if (v.currentTime >= clip.end || v.ended) { v.pause(); return res(); }
          requestAnimationFrame(tick); }; tick(); });
      }
      await card('#8c1024', S().club.name || 'Raincy Coach', 'Fin du briefing', '', 1200);
      rec.stop(); await stopped;
      const type = (rec.mimeType || mime || 'video/webm').split(';')[0], blob = new Blob(chunks, { type });
      bz.done();
      const r = await Exporter.deliver(blob, `${name.replace(/[^\wÀ-ÿ -]+/g, ' ').replace(/\s+/g, ' ').trim() || 'briefing'}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
      if (r === 'downloaded') toast('Vidéo enregistrée dans Téléchargements');
    } catch (e) { bz.done(); try { rec.state !== 'inactive' && rec.stop(); } catch (e2) {} toast('La vidéo n\'a pas pu être créée : ' + (e.message || e), 'err'); }
    finally { v.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }
  }

  // Library page: the briefings of this device
  function libraryCard() {
    const list = briefings();
    return `<section class="card"><div class="row-head"><h2>${I.video}Briefings vidéo</h2><button class="btn soft" data-anbrief>${I.layers}<span>Mes briefings (${list.length})</span></button></div>
      <p class="muted small">Ouvre une vidéo de match puis « Analyser » : marque les actions (but, occasion, perte de balle…), puis rassemble les séquences dans un briefing à présenter ou à envoyer en vidéo.</p></section>`;
  }
  return { page, briefingPage, briefingsDialog, libraryCard, TAGS, leave: freeUrl };
})();
