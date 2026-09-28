/* Parents: the public page of a category (secret link, read only), the parents' answers to a convocation,
   and the car sharing for away matches. The page for the parents is parents.html (js/parents-page.js).
   Only first names and the initial of the last name leave the club's data: never a birth date, a phone or an address. */
const Parents = (() => {
  const { esc, $, $$, toast, modal, fmtDate, today } = UI;
  const S = () => Store.state;
  const short = p => p ? (p.firstName || '') + (p.lastName ? ' ' + p.lastName[0].toUpperCase() + '.' : '') : '';
  const catKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '');
  const hh = x => String(x || '').replace(':', 'h');

  /* ---------- the link of a category (the category and its teams A / B share one page) ---------- */
  function family(teamId) {
    const t = Store.get('teams', teamId); if (!t) return null;
    const key = catKey(t.category || t.name), ids = S().teams.filter(x => catKey(x.category || x.name) === key).map(x => x.id);
    const base = S().teams.find(x => catKey(x.name) === key);
    return { key, ids: ids.length ? ids : [t.id], name: base ? base.name : (t.category || t.name) };
  }
  const pageUrl = token => `${location.origin}${location.pathname.replace(/index\.html$/, '')}parents.html#t=${encodeURIComponent(token)}`;
  async function linkOf(teamId, renew) {
    const f = family(teamId); if (!f) throw new Error('Choisis d\'abord une catégorie.');
    const links = S().ui.parentLinks = S().ui.parentLinks || {};
    if (!renew && links[f.key]) return pageUrl(links[f.key]);
    const token = await Cloud.parentLink(f.key, f.ids, f.name, renew);
    links[f.key] = token; Store.persistNow();
    return pageUrl(token);
  }
  // Explanation shown when the server has not been updated yet (3.8 functions missing)
  const needUpdate = e => e && e.code === 'MISE_A_JOUR'
    ? 'Le serveur du club doit d\'abord être mis à jour par le responsable : Réglages → Serveur du club → Mettre à jour le serveur.' : (e && e.message) || 'Erreur';
  async function shareDialog(teamId, renew) {
    if (!Cloud.ready()) return toast('Il faut être connecté au serveur du club', 'err');
    const f = family(teamId); let url;
    const b = UI.busy('Préparation du lien…');
    try { url = await linkOf(teamId, renew); } catch (e) { return toast(needUpdate(e), 'err'); } finally { b.done(); }
    const text = `${S().club.name} · ${f.name}\nToutes les infos de l'équipe pour les parents (matchs, horaires, lieux, convocations, covoiturage). Répondez présent ou absent pour votre enfant ici :\n${url}`;
    modal({ title: `Page des parents · ${f.name}`, noFocus: true,
      body: `<p>Envoie ce lien dans le groupe WhatsApp des parents. Ils y voient les matchs et séances de la catégorie, et répondent <b>présent</b> ou <b>absent</b> aux convocations, sans compte ni mot de passe.</p>
        <label class="fld"><span>Lien de la page des parents</span><input id="parLink" value="${esc(url)}" readonly></label>
        <p class="muted small">La page ne montre que le prénom et l'initiale du nom des enfants convoqués : ni date de naissance, ni téléphone. Ne publie pas ce lien en dehors des parents de l'équipe. « Nouveau lien » annule l'ancien (si le lien a circulé trop loin).</p>`,
      onOpen: r => { const i = $('#parLink', r); i.onclick = () => i.select(); },
      actions: [
        { label: 'Nouveau lien', onClick: () => { setTimeout(() => UI.confirmBox('Créer un nouveau lien ? L\'ancien ne marchera plus : il faudra renvoyer le nouveau aux parents.', 'Nouveau lien').then(ok => ok && shareDialog(teamId, true)), 60); } },
        { label: 'Ouvrir', icon: I.next, onClick: () => { window.open(url, '_blank'); return false; } },
        { label: 'Copier', icon: I.copy, onClick: () => { navigator.clipboard.writeText(url).then(() => toast('Lien copié')).catch(() => toast('Sélectionne le lien et copie-le')); return false; } },
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: () => { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return false; } }] });
  }
  /* ---------- the players' page (seniors, U17, U18…): its own secret link ---------- */
  const playersUrl = token => `${location.origin}${location.pathname.replace(/index\.html$/, '')}joueurs.html#t=${encodeURIComponent(token)}`;
  async function playerLinkOf(teamId, renew) {
    const f = family(teamId); if (!f) throw new Error('Choisis d\'abord une catégorie.');
    const links = S().ui.playerLinks = S().ui.playerLinks || {};
    if (!renew && links[f.key]) return playersUrl(links[f.key]);
    const token = await Cloud.playerLink(f.key, f.ids, f.name, renew);
    links[f.key] = token; Store.persistNow();
    return playersUrl(token);
  }
  async function sharePlayers(teamId, renew) {
    if (!Cloud.ready()) return toast('Il faut être connecté au serveur du club', 'err');
    const f = family(teamId); let url;
    const b = UI.busy('Préparation du lien…');
    try { url = await playerLinkOf(teamId, renew); } catch (e) { return toast(needUpdate(e), 'err'); } finally { b.done(); }
    const text = `${S().club.name} · ${f.name}\nL'espace des joueurs : matchs, convocations (réponds présent ou absent), la causerie du match, ton temps de jeu et tes stats de la saison.\n${url}`;
    modal({ title: `Page des joueurs · ${f.name}`, noFocus: true,
      body: `<p>Envoie ce lien dans le groupe WhatsApp des joueurs. Ils y voient les matchs, répondent <b>présent</b> ou <b>absent</b>, lisent la causerie du prochain match (objectif, 3 clés, vidéo) et suivent leur temps de jeu et leurs stats.</p>
        <label class="fld"><span>Lien de la page des joueurs</span><input id="plLink" value="${esc(url)}" readonly></label>
        <p class="muted small">Pour les grands (seniors, U17, U18). Seuls le prénom et l'initiale du nom apparaissent. « Nouveau lien » annule l'ancien.</p>`,
      onOpen: r => { const i = $('#plLink', r); i.onclick = () => i.select(); },
      actions: [
        { label: 'Nouveau lien', onClick: () => { setTimeout(() => UI.confirmBox('Créer un nouveau lien ? L\'ancien ne marchera plus : il faudra renvoyer le nouveau aux joueurs.', 'Nouveau lien').then(ok => ok && sharePlayers(teamId, true)), 60); } },
        { label: 'Ouvrir', icon: I.next, onClick: () => { window.open(url, '_blank'); return false; } },
        { label: 'Copier', icon: I.copy, onClick: () => { navigator.clipboard.writeText(url).then(() => toast('Lien copié')).catch(() => toast('Sélectionne le lien et copie-le')); return false; } },
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: () => { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return false; } }] });
  }
  // Card on a category page
  function teamCard(t) {
    return `<section class="card parents-card"><div class="row-head"><h2>${I.team}Page des parents</h2>
      <div class="chips"><button class="btn primary" data-parents="${t.id}">${I.share}<span>Lien pour les parents</span></button><button class="btn soft" data-players="${t.id}">${I.share}<span>Lien pour les joueurs</span></button></div></div>
      <p class="muted small">Parents : matchs, horaires, lieux, séances, covoiturage, et leurs réponses présent / absent. Joueurs (seniors, U17, U18) : en plus la causerie du match, leur temps de jeu et leurs stats de la saison.</p></section>`;
  }

  /* ---------- answers to a convocation (on the match page) ---------- */
  const cache = {}; // matchId → { at, rows: { playerId: row } }
  async function loadAnswers(m, force) {
    const c = cache[m.id];
    if (!force && c && Date.now() - c.at < 15000) return c;
    const rows = await Cloud.answers([m.id]) || [];
    return (cache[m.id] = { at: Date.now(), rows: Object.fromEntries(rows.map(r => [r.player_id, r])) });
  }
  const isOpen = m => !m.played && !m.exempt && m.date >= today();
  function drawAnswers(box, m, conv, err) {
    const c = cache[m.id], rows = (c && c.rows) || {};
    if (!conv.length || m.exempt || (!isOpen(m) && !Object.keys(rows).length)) { box.innerHTML = ''; return; }
    const yes = conv.filter(p => (rows[p.id] || {}).status === 'oui'), no = conv.filter(p => (rows[p.id] || {}).status === 'non');
    const mark = p => { const r = rows[p.id]; return r ? (r.status === 'oui' ? '<b class="ans ans-yes">✓</b>' : '<b class="ans ans-no">✗</b>') : '<b class="ans">?</b>'; };
    box.innerHTML = `<section class="card answers">
      <div class="row-head"><h3>Réponses des parents</h3><button class="btn soft" data-parents="${m.teamId}">${I.share}<span>Lien des parents</span></button></div>
      ${err ? `<p class="tip">${esc(err)}</p>` : !Cloud.ready() ? '<p class="muted small">Les réponses arrivent quand l\'appli est connectée au serveur du club.</p>' : `
      <p class="ans-sum"><span class="ans-yes">✓ ${yes.length} présent${yes.length > 1 ? 's' : ''}</span> · <span class="ans-no">✗ ${no.length} absent${no.length > 1 ? 's' : ''}</span> · <span>? ${conv.length - yes.length - no.length} sans réponse</span></p>
      <div class="chips ans-list">${conv.map(p => { const r = rows[p.id];
        return `<button class="chip ans-chip ${r ? 'ans-' + r.status : ''}" data-ans="${p.id}" ${isOpen(m) ? '' : 'disabled'} title="${r ? (r.by_coach ? 'Noté par un coach' : 'Réponse du parent') : 'Pas de réponse'}">${mark(p)}<span>${esc(Store.shortName(p))}</span>${r && r.seats && r.status === 'oui' && !m.home ? ` <i class="muted">🚗 ${r.seats}</i>` : ''}${r && r.note ? ` <i class="muted">« ${esc(r.note)} »</i>` : ''}</button>`; }).join('')}</div>
      ${isOpen(m) && conv.length - yes.length - no.length > 0 ? `<button class="btn soft" data-remind>${I.chat}<span>Relancer les ${conv.length - yes.length - no.length} sans réponse</span></button>` : ''}
      <p class="muted small">${isOpen(m) ? 'Un parent a répondu par téléphone ? Touche le prénom : présent → absent → pas de réponse.' : 'Match passé : les réponses sont fermées.'}</p>`}</section>`;
  }

  // A ready WhatsApp message for the parents who haven't answered yet
  async function remind(m, conv) {
    const rows = (cache[m.id] || {}).rows || {}, missing = conv.filter(p => !rows[p.id]);
    if (!missing.length) return toast('Tout le monde a répondu 👍');
    let url = ''; try { url = await linkOf(m.teamId); } catch (e) {}
    const t = Store.get('teams', m.teamId);
    const text = [`⚽ *${S().club.name}${t ? ' · ' + t.name : ''}* – match ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}, ${fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}`, '',
      `Nous attendons encore la réponse pour : ${missing.map(short).join(', ').replace(/\.?$/, '.')}`, url ? `Merci de répondre présent ou absent ici : ${url}` : 'Merci de répondre présent ou absent au coach.'].join('\n');
    modal({ title: `Relancer (${missing.length})`, noFocus: true, body: `<p class="muted small">Message prêt pour le groupe WhatsApp des parents.</p><textarea id="rmTxt" rows="8">${esc(text)}</textarea>`,
      actions: [{ label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#rmTxt', r).value).then(() => toast('Message copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } },
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#rmTxt', r).value), '_blank'); return false; } }] });
  }

  /* ---------- car sharing (away matches) ---------- */
  function carText(m) {
    const t = Store.get('teams', m.teamId), cars = m.carpool || [], kids = (m.convoked || []).map(id => Store.get('players', id)).filter(Boolean);
    const inCar = new Set(cars.flatMap(c => c.kids || []));
    const alone = kids.filter(p => !inCar.has(p.id));
    return [`🚗 *Covoiturage${t ? ' ' + t.name : ''}* – match à ${m.opponent || '?'}, ${fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}`, '',
      ...cars.map(c => `• *${c.driver || 'Voiture'}*${c.time ? ' – départ ' + hh(c.time) : ''}${c.from ? ' (' + c.from + ')' : ''} : ${(c.kids || []).map(id => short(Store.get('players', id))).filter(Boolean).join(', ') || 'places libres'} (${(c.kids || []).length}/${c.seats || '?'})`),
      ...(alone.length ? ['', `Sans voiture pour l'instant : ${alone.map(short).join(', ')}`] : []), '', 'Merci aux parents conducteurs ! 🙏'].join('\n');
  }
  function drawCarpool(box, m, conv) {
    const cars = m.carpool || [], c = cache[m.id], rows = (c && c.rows) || {};
    const inCar = new Set(cars.flatMap(x => x.kids || [])), alone = conv.filter(p => !inCar.has(p.id));
    const offers = conv.filter(p => rows[p.id] && rows[p.id].status === 'oui' && rows[p.id].seats > 0 && !cars.some(x => x.fromPlayer === p.id));
    box.innerHTML = `<h2 class="section">${I.car}Covoiturage</h2><section class="card carpool">
      ${offers.length ? `<p class="tip">Proposent de conduire : ${offers.map(p => `<button class="linkish" data-cpoffer="${p.id}">Parent de ${esc(short(p))} (${rows[p.id].seats} place${rows[p.id].seats > 1 ? 's' : ''})</button>`).join(' · ')}<br><span class="muted small">Touche un nom pour créer sa voiture.</span></p>` : ''}
      ${cars.length ? cars.map(car => { const n = (car.kids || []).length, full = car.seats && n >= car.seats;
        return `<div class="car" data-car="${car.id}"><div class="car-head">${I.car}<b>${esc(car.driver || 'Voiture')}</b><span class="muted">${n}/${esc(car.seats || '?')} place${car.seats > 1 ? 's' : ''}${car.time ? ' · départ ' + esc(hh(car.time)) : ''}${car.from ? ' · ' + esc(car.from) : ''}</span>
          <span class="grow"></span><button class="icon-btn" data-cpedit="${car.id}" aria-label="Modifier la voiture">${I.edit}</button><button class="icon-btn danger" data-cpdel="${car.id}" aria-label="Supprimer la voiture">${I.trash}</button></div>
          <div class="chips">${(car.kids || []).map(id => Store.get('players', id)).filter(Boolean).map(p => `<span class="chip on">${esc(Store.shortName(p))}<button class="x" data-cpout="${car.id}|${p.id}" aria-label="Sortir ${esc(Store.shortName(p))} de la voiture">${I.x}</button></span>`).join('')}
          ${!full && alone.length ? `<select class="add-select" data-cpin="${car.id}" aria-label="Ajouter un enfant"><option value="">+ Ajouter un enfant…</option>${alone.map(p => `<option value="${p.id}">${esc(Store.shortName(p))}</option>`).join('')}</select>` : ''}</div></div>`; }).join('')
        : '<p class="muted">Pas encore de voiture. Ajoute les parents qui conduisent, puis range les enfants dans les voitures.</p>'}
      ${cars.length && alone.length ? `<p class="muted small">Sans voiture : ${alone.map(p => esc(Store.shortName(p))).join(', ')}</p>` : ''}
      <div class="chips"><button class="btn" data-cpnew>${I.plus}<span>Ajouter une voiture</span></button>${cars.length ? `<button class="btn primary" data-cpshare>${I.share}<span>Envoyer sur WhatsApp</span></button>` : ''}</div>
      <p class="muted small">Les voitures s'affichent aussi sur la page des parents.</p></section>`;
    const save = () => { Store.upsert('matches', m); drawCarpool(box, m, conv); };
    box.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-cpnew')) return editCar(m, null, save);
      if (b.dataset.cpedit) return editCar(m, cars.find(x => x.id === b.dataset.cpedit), save);
      if (b.dataset.cpdel) return UI.confirmBox('Supprimer cette voiture ? Les enfants redeviennent sans voiture.', 'Supprimer').then(ok => { if (ok) { m.carpool = cars.filter(x => x.id !== b.dataset.cpdel); save(); } });
      if (b.dataset.cpout) { const [cid, pid] = b.dataset.cpout.split('|'), car = cars.find(x => x.id === cid); if (car) { car.kids = (car.kids || []).filter(x => x !== pid); save(); } return; }
      if (b.dataset.cpoffer) {
        const p = Store.get('players', b.dataset.cpoffer), r = rows[b.dataset.cpoffer];
        m.carpool = [...cars, { id: Store.uid(), driver: 'Parent de ' + short(p), seats: r.seats, from: S().club.fieldName || '', time: defTime(m), kids: [p.id], fromPlayer: p.id }];
        return save();
      }
      if (b.hasAttribute('data-cpshare')) {
        const text = carText(m);
        return modal({ title: 'Envoyer le covoiturage', noFocus: true, body: `<textarea id="cpTxt" rows="10">${esc(text)}</textarea>`,
          actions: [{ label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#cpTxt', r).value).then(() => toast('Copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } },
            { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open('https://wa.me/?text=' + encodeURIComponent($('#cpTxt', r).value), '_blank'); return false; } }] });
      }
    };
    box.onchange = e => {
      const s = e.target.closest('[data-cpin]'); if (!s || !s.value) return;
      const car = cars.find(x => x.id === s.dataset.cpin); if (!car) return;
      m.carpool.forEach(x => { x.kids = (x.kids || []).filter(id => id !== s.value); });
      car.kids = [...(car.kids || []), s.value]; save();
    };
  }
  // Departure: 45 minutes before the meeting time (or the kick-off)
  function defTime(m) {
    const t = m.rdv || m.time; if (!t) return '';
    const [h, mi] = t.split(':').map(Number), d = h * 60 + mi - 45;
    return d > 0 ? `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}` : t;
  }
  function editCar(m, car, done) {
    const isNew = !car;
    car = car || { id: Store.uid(), driver: '', seats: 3, from: S().club.fieldName || '', time: defTime(m), kids: [] };
    modal({ title: isNew ? 'Nouvelle voiture' : 'Voiture', body: `
      <label class="fld"><span>Conducteur (visible par les parents)</span><input id="cDriver" value="${esc(car.driver)}" placeholder="ex : Maman de Lucas" maxlength="40"></label>
      <div class="row3"><label class="fld"><span>Places pour les enfants</span><input id="cSeats" type="number" min="1" max="8" inputmode="numeric" value="${esc(car.seats)}"></label>
      <label class="fld"><span>Départ</span><input id="cTime" type="time" value="${esc(car.time || '')}"></label>
      <label class="fld"><span>Lieu de départ</span><input id="cFrom" value="${esc(car.from || '')}" placeholder="ex : parking du stade" maxlength="60"></label></div>
      <p class="muted small">N'écris pas de numéro de téléphone ici : cette information s'affiche sur la page des parents.</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
        const v = id => $('#' + id, r).value.trim();
        if (!v('cDriver')) { toast('Écris le nom du conducteur', 'err'); return false; }
        Object.assign(car, { driver: v('cDriver'), seats: Math.max(1, Math.min(8, +v('cSeats') || 1)), time: v('cTime'), from: v('cFrom') });
        if (isNew) m.carpool = [...(m.carpool || []), car];
        done();
      } }] });
  }

  /* ---------- photos of the match for the parents' page ---------- */
  const phCache = {}; // photo id → data URL (miniature)
  async function drawPhotos(box, m) {
    let list;
    try { list = await Cloud.photos(m.id) || []; }
    catch (e) { box.innerHTML = e.code === 'MISE_A_JOUR' ? '' : `<p class="muted small">${esc(e.message)}</p>`; return; }
    if (!box.isConnected) return;
    const noImg = (m.convoked || []).map(id => Store.get('players', id)).filter(p => p && ClubAdmin.noImage(p));
    box.innerHTML = `<section class="card"><div class="row-head"><h2>${I.image}Photos pour les parents (${list.length})</h2><button class="btn" data-phadd>${I.plus}<span>Choisir des photos</span></button></div>
      <p class="muted small">Ces photos apparaissent sur la page des parents de la catégorie. Elles sont effacées du serveur au bout de 90 jours.</p>
      ${noImg.length ? `<p class="tip">📵 Droit à l'image refusé : <b>${noImg.map(p => esc(Store.shortName(p))).join(', ')}</b>. Ne partage pas de photo où on les reconnaît.</p>` : ''}
      <div class="gallery">${list.map(x => `<button class="thumb-btn" data-phdel="${x.id}" aria-label="Retirer cette photo">${phCache[x.id] ? `<img alt="" src="${phCache[x.id]}">` : `<span class="no-thumb">${I.image}</span>`}<span class="play-badge">${I.x}</span></button>`).join('') || '<p class="muted">Aucune photo partagée.</p>'}</div></section>`;
    list.filter(x => !phCache[x.id]).forEach(async x => { try { phCache[x.id] = await Cloud.photoGet(x.id); const b = box.querySelector(`[data-phdel="${x.id}"]`); if (b && phCache[x.id]) b.firstElementChild.outerHTML = `<img alt="" src="${phCache[x.id]}">`; } catch (e) {} });
    box.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.phdel) { if (await UI.confirmBox('Retirer cette photo de la page des parents ?', 'Retirer')) { try { await Cloud.photoDel(b.dataset.phdel); drawPhotos(box, m); } catch (err) { toast(err.message, 'err'); } } return; }
      if (b.hasAttribute('data-phadd')) return pickPhotos(box, m, list);
    };
  }
  async function pickPhotos(box, m, shared) {
    const mine = (await Media.list('match:' + m.id)).filter(x => x.kind === 'image'), done = new Set(shared.map(x => x.src));
    if (!mine.length) return toast('Ajoute d\'abord des photos dans « Photos et vidéos du match » (plus haut)', 'err');
    const close = modal({ title: 'Photos pour les parents', noFocus: true,
      body: `<p class="muted small">Touche les photos à montrer aux parents, puis « Partager ».</p><div class="gallery pick-photos">${mine.map(x => `<button class="thumb-btn ${done.has(x.id) ? 'on' : ''}" data-ph="${x.id}" ${done.has(x.id) ? 'disabled' : ''}><img alt="" src="${x.thumb}">${done.has(x.id) ? '<span class="play-badge">✓</span>' : ''}</button>`).join('')}</div>
        <label class="switch"><input type="checkbox" id="phOk"><span>Les enfants reconnaissables ont l'accord de leurs parents (droit à l'image)</span></label>`,
      onOpen: r => r.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => b.classList.toggle('sel')),
      actions: [{ label: 'Annuler' }, { label: 'Partager', kind: 'primary', icon: I.share, onClick: (c, r) => {
        const ids = [...r.querySelectorAll('[data-ph].sel')].map(b => b.dataset.ph);
        if (!ids.length) { toast('Touche au moins une photo', 'err'); return false; }
        if (!r.querySelector('#phOk').checked) { toast('Coche la case sur le droit à l\'image', 'err'); return false; }
        (async () => {
          const bz = UI.busy('Envoi des photos…'); let n = 0;
          try {
            for (const id of ids) {
              const rec = await Media.get(id); if (!rec || !rec.blob) continue;
              const img = await Media.loadImage(URL.createObjectURL(rec.blob));
              let q = .72, data = Media.drawScaled(img, img.naturalWidth, img.naturalHeight, 1280).toDataURL('image/jpeg', q);
              while (data.length > 400000 && q > .35) { q -= .12; data = Media.drawScaled(img, img.naturalWidth, img.naturalHeight, 1024).toDataURL('image/jpeg', q); }
              await Cloud.photoAdd(m.id, id, data); n++;
            }
            toast(`${n} photo${n > 1 ? 's' : ''} partagée${n > 1 ? 's' : ''} avec les parents`);
          } catch (e) { toast(needUpdate(e), 'err'); } finally { bz.done(); close(); drawPhotos(box, m); }
        })();
        return false;
      } }] });
  }

  /* ---------- the match page ---------- */
  function mountMatch(root, m, conv) {
    const ab = $('#answersBox', root), cb = $('#carpoolBox', root), pb = $('#parentPhotos', root);
    if (cb) drawCarpool(cb, m, conv);
    if (pb) drawPhotos(pb, m);
    if (!ab) return;
    drawAnswers(ab, m, conv);
    ab.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.parents) return shareDialog(b.dataset.parents);
      if (b.dataset.players) return sharePlayers(b.dataset.players);
      if (b.hasAttribute('data-remind')) return remind(m, conv);
      if (b.dataset.ans) {
        const c = cache[m.id] = cache[m.id] || { at: 0, rows: {} }, cur = c.rows[b.dataset.ans], next = !cur ? 'oui' : cur.status === 'oui' ? 'non' : '';
        try {
          await Cloud.setAnswer(m.id, b.dataset.ans, next);
          if (next) c.rows[b.dataset.ans] = Object.assign({}, cur, { status: next, by_coach: true }); else delete c.rows[b.dataset.ans];
          drawAnswers(ab, m, conv);
        } catch (err) { toast(needUpdate(err), 'err'); }
      }
    };
    if (!Cloud.ready() || !conv.length || m.exempt) return;
    loadAnswers(m).then(() => {
      if (ab.isConnected) drawAnswers(ab, m, conv);
      if (cb && cb.isConnected) drawCarpool(cb, m, conv);
    }).catch(e => { if (ab.isConnected) drawAnswers(ab, m, conv, e.code === 'MISE_A_JOUR' ? needUpdate(e) : ''); });
  }

  return { shareDialog, sharePlayers, teamCard, linkOf, mountMatch, carText };
})();
