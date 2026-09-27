/* Views: every screen of the app except the board editor. */
const Views = (() => {
  const { esc, $, $$, toast, modal, confirmBox, fmtDate, today } = UI;
  const S = () => Store.state;
  const teamOf = id => Store.get('teams', id);
  const fmtLabel = f => ({ '8': 'Foot à 8', '5': 'Foot à 5', zone: 'Zone libre' }[f] || 'Foot à 11');
  const FORMATS = [['11', 'Foot à 11'], ['8', 'Foot à 8'], ['5', 'Foot à 5']];
  const pName = Store.fullName;
  const pLabel = p => `${p.number ? p.number + ' · ' : ''}${pName(p)}`;
  const POS = [['GB', 'Gardien'], ['DEF', 'Défenseur'], ['MIL', 'Milieu'], ['ATT', 'Attaquant']];
  const COMPS = ['Championnat', 'Coupe', 'Amical', 'Plateau', 'Tournoi'];
  const activeTeam = () => S().ui.teamId && teamOf(S().ui.teamId) ? S().ui.teamId : '';
  const byTeam = list => { const t = activeTeam(); return t ? list.filter(x => x.teamId === t) : list; };
  const result = m => !m.played ? null : m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';
  const resPill = m => { const r = result(m); return r ? `<span class="res-smiley" aria-hidden="true">${Ratings.smiley(m)}</span><span class="res res-${r}">${r === 'V' ? 'Gagné' : r === 'D' ? 'Perdu' : 'Nul'}</span>` : ''; };
  const scoreTxt = m => m.home ? `${m.gf} – ${m.ga}` : `${m.ga} – ${m.gf}`;
  const matchTitle = m => m.exempt ? `${esc(S().club.name)} <i>exempt · pas de match</i>` : m.home ? `${esc(S().club.name)} <i>contre</i> ${esc(m.opponent || '?')}` : `${esc(m.opponent || '?')} <i>contre</i> ${esc(S().club.name)}`;
  const empty = (txt, btn) => `<div class="empty"><p>${txt}</p>${btn || ''}</div>`;

  function teamSwitch() {
    const t = activeTeam();
    return `<div class="team-switch" role="tablist" aria-label="Équipe">
      <button class="chip ${!t ? 'on' : ''}" data-team="">Toutes les équipes</button>
      ${S().teams.map(x => `<button class="chip ${x.id === t ? 'on' : ''}" data-team="${x.id}">${esc(x.name)}</button>`).join('')}
    </div>`;
  }
  function bindTeamSwitch(root, rerender) {
    $$('[data-team]', root).forEach(b => b.onclick = () => { S().ui.teamId = b.dataset.team; Store.save(); rerender(); });
  }
  const header = (title, sub, actions = '') => `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="head-actions">${actions}</div></header>`;

  /* ================= Accueil ================= */
  // Getting the club ready: shown to responsables until every step is done
  function serverBanner() {
    if (!Auth.localOnly()) return '';
    return `<section class="card server-banner"><h2>${I.share}Connecte-toi au serveur du club</h2>
      <p>Tu es connecté avec un ancien compte gardé seulement sur ce téléphone. Pour retrouver les dirigeants, le planning et les messages du club, connecte-toi au serveur${Auth.isAdmin() ? ' avec ton <b>code responsable</b> (ou « J\'ai perdu le code responsable »)' : ' avec le lien d\'invitation'}. Tes données de ce téléphone sont gardées et envoyées au serveur.</p>
      <button class="btn primary" data-connect>${I.check}<span>Me connecter au serveur</span></button></section>`;
  }
  function setupCard() {
    if (!Auth.isAdmin()) return '';
    const st = S(), steps = [
      [st.players.length > 0, 'Charger les licenciés', 'Réglages → Recevoir un fichier (fichier des licenciés)', '#/reglages'],
      [st.staff.length > 1, 'Ajouter les éducateurs et dirigeants', 'Équipes → Dirigeants → Coller une liste ou Nouveau dirigeant', '#/dirigeants'],
      [Cloud.ready(), 'Connecter le serveur du club', 'Touche ici, puis « Je suis le responsable du club »', '#/connexion'],
      [!!st.club.reportEmail, 'Indiquer ton e-mail pour les signalements', 'Réglages → Aide et signalements', '#/reglages'],
      [!!(st.ui.invited || st.ui.clubFileSent), 'Inviter les éducateurs', 'Réglages → Serveur du club → Inviter les éducateurs (lien à envoyer par WhatsApp)', '#/reglages'],
    ];
    if (steps.every(s => s[0])) return '';
    return `<section class="card setup-card"><h2>${I.check}Mise en route du club</h2><ol class="setup-steps">${steps.map(([ok, t, how, href]) =>
      `<li class="${ok ? 'ok' : ''}"><a href="${href}"><span class="tick">${ok ? '✓' : ''}</span><span><b>${esc(t)}</b><span class="muted small">${esc(how)}</span></span></a></li>`).join('')}</ol></section>`;
  }
  function home(root) {
    const now = today();
    const matches = byTeam(S().matches), trainings = byTeam(S().trainings);
    const next = matches.filter(m => !m.played && m.date >= now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    const nextTr = trainings.filter(t => t.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0];
    const last = matches.filter(m => m.played).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const schemas = S().schemas.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
    root.innerHTML = `<header class="hero"><img src="icons/crest.png" alt="" class="hero-crest"><div><p class="eyebrow">Espace éducateurs</p><h1>${esc(S().club.name)}</h1><p class="sub">Tableau tactique, effectifs, entraînements et matchs</p></div></header>
      ${serverBanner()}
      ${teamSwitch()}
      ${setupCard()}
      <div class="quick">
        <button class="quick-btn" data-go="new-schema">${I.board}<b>Dessiner un exercice</b><span>Joueurs, flèches, zones</span></button>
        <button class="quick-btn" data-go="new-training">${I.training}<b>Préparer un entraînement</b><span>Exercices et PDF</span></button>
        <button class="quick-btn" data-go="new-match">${I.match}<b>Ajouter un match</b><span>Convocation et score</span></button>
        <a class="quick-btn" href="#/bibliotheque">${I.upload}<b>Importer vidéo ou PDF</b><span>Dessiner dessus, créer une séance</span></a>
      </div>
      <div class="cards2">
        <section class="card">
          <h2>${I.match}Prochain match</h2>
          ${next ? `<a class="rowlink" href="#/match/${next.id}"><div><b>${matchTitle(next)}</b><span>${esc(fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(next.time || '')} · ${next.home ? 'Domicile' : 'Extérieur'}</span></div>${I.next}</a>` : `<p class="muted">Aucun match prévu.</p>`}
        </section>
        <section class="card">
          <h2>${I.training}Prochain entraînement</h2>
          ${nextTr ? `<a class="rowlink" href="#/entrainement/${nextTr.id}"><div><b>${esc(nextTr.title || 'Entraînement')}</b><span>${esc(fmtDate(nextTr.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${nextTr.exercises.length} exercice${nextTr.exercises.length > 1 ? 's' : ''}</span></div>${I.next}</a>` : `<p class="muted">Aucun entraînement prévu.</p>`}
        </section>
        <section class="card">
          <h2>${I.calendar}Mes créneaux (7 jours)</h2>
          <div id="planMini"><p class="muted">Chargement…</p></div>
          <a class="btn soft" href="#/planning" style="margin-top:8px">${I.calendar}<span>Ouvrir le planning</span></a>
        </section>
        <section class="card">
          <h2>${I.stats}Derniers résultats</h2>
          ${last.length ? `<ul class="res-list">${last.map(m => `<li><a href="#/match/${m.id}"><span class="d">${esc(fmtDate(m.date))}</span><span class="o">${esc(m.opponent)}</span><span class="s">${scoreTxt(m)}</span>${resPill(m)}</a></li>`).join('')}</ul>` : `<p class="muted">Pas encore de résultat.</p>`}
        </section>
        <section class="card">
          <h2>${I.board}Derniers schémas</h2>
          ${schemas.length ? `<div class="mini-grid">${schemas.map(s => `<a href="#/schema/${s.id}" class="mini"><img alt="" src="${UI.thumb(s, 320, 208)}"><span>${esc(s.name)}</span></a>`).join('')}</div>` : `<p class="muted">Aucun schéma.</p>`}
        </section>
      </div>`;
    bindTeamSwitch(root, () => home(root));
    Planning.upcoming($('#planMini', root));
    const cb = $('[data-connect]', root); if (cb) cb.onclick = () => Auth.connectServer();
    $$('[data-go]', root).forEach(b => b.onclick = () => ({ 'new-schema': newSchema, 'new-training': newTraining, 'new-match': newMatch })[b.dataset.go]());
  }

  /* ================= Équipes ================= */
  function teams(root) {
    const count = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
    root.innerHTML = `${header('Équipes', 'Les catégories du club, leurs joueurs et leurs dirigeants',
      `<a class="btn" href="#/joueurs">${I.team}<span>Tous les joueurs (${S().players.length})</span></a>
       <a class="btn" href="#/dirigeants">${I.whistle}<span>Dirigeants (${S().staff.length})</span></a>
       ${Auth.isAdmin() ? `<button class="btn" data-act="bybirth">${I.calendar}<span>Ranger par année de naissance</span></button>` : ''}
       <button class="btn primary" data-act="new">${I.plus}<span>Nouvelle catégorie</span></button>`)}
      ${S().teams.length ? `<div class="grid">${S().teams.map(t => { const np = Store.playersOf(t.id).length, ns = Store.staffOf(t.id).length;
        return `<a class="card team-card" href="#/equipe/${t.id}">
          <span class="badge">${fmtLabel(t.format)}</span><h2>${esc(t.name)}</h2><p class="muted">${count(np, 'joueur')} · ${count(ns, 'dirigeant')}</p></a>`; }).join('')}</div>`
        : empty('Crée ta première catégorie pour ajouter tes joueurs.')}`;
    $('[data-act="new"]', root).onclick = newTeam;
    const bb = $('[data-act="bybirth"]', root); if (bb) bb.onclick = () => People.sortByBirthDialog(() => teams(root));
  }
  function newTeam() {
    modal({ title: 'Nouvelle catégorie', body: `
      <label class="fld"><span>Nom</span><input id="tName" placeholder="ex : U11 A" maxlength="40"></label>
      <label class="fld"><span>Catégorie</span><input id="tCat" placeholder="ex : U11, Seniors" maxlength="20"></label>
      <div class="lbl">Format</div><div class="chips" id="tFmt">${FORMATS.map(([v, l], i) => `<button class="chip ${i ? '' : 'on'}" data-v="${v}">${l}</button>`).join('')}</div>`,
      onOpen: r => $$('#tFmt .chip', r).forEach(b => b.onclick = () => { $$('#tFmt .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const name = $('#tName', r).value.trim(); if (!name) { toast('Donne un nom à la catégorie', 'err'); return false; }
        const t = Store.upsert('teams', { id: Store.uid(), name, category: $('#tCat', r).value.trim() || name, format: $('#tFmt .on', r).dataset.v });
        S().ui.teamId = t.id; location.hash = '#/equipe/' + t.id;
      } }] });
  }
  function team(root, id) {
    const t = teamOf(id); if (!t) return (location.hash = '#/equipes');
    const save = () => Store.upsert('teams', t);
    const render = () => {
      root.innerHTML = `${header(`<input class="h1-input" id="tName" value="${esc(t.name)}" aria-label="Nom de la catégorie">`, `${fmtLabel(t.format)} · ${Store.playersOf(t.id).length} joueurs`,
        `<a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>`)}
        <section class="card">
          <div class="row-head"><label class="fld inline"><span>Catégorie</span><input id="tCat" value="${esc(t.category || '')}" maxlength="20"></label>
          <div class="chips">${FORMATS.map(([v, l]) => `<button class="chip ${t.format === v ? 'on' : ''}" data-fmt="${v}">${l}</button>`).join('')}</div></div>
        </section>
        <div id="teamPeople"></div>
        <div class="danger-zone"><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer la catégorie</span></button></div>`;
      const box = $('#teamPeople', root);
      const people = () => { box.innerHTML = People.teamSections(t); $('.sub', root).textContent = `${fmtLabel(t.format)} · ${Store.playersOf(t.id).length} joueurs`; };
      people(); People.bindTeamSections(box, t, people);
    };
    render();
    root.oninput = e => {
      if (e.target.id === 'tName') { t.name = e.target.value; save(); }
      if (e.target.id === 'tCat') { t.category = e.target.value; save(); }
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b || b.closest('#teamPeople')) return;
      if (b.dataset.fmt) { t.format = b.dataset.fmt; save(); return render(); }
      if (b.dataset.act === 'delete' && await confirmBox(`Supprimer la catégorie ${t.name} ? Les joueurs et dirigeants restent dans le club.`)) {
        [...S().players, ...S().staff].forEach(p => p.teamIds = (p.teamIds || []).filter(x => x !== t.id));
        Store.remove('teams', t.id); location.hash = '#/equipes';
      }
    };
  }

  /* ================= Schémas ================= */
  function schemas(root) {
    const filt = S().ui.schemaFilter || '';
    const list = S().schemas.filter(s => !filt || s.field.format === filt).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    root.innerHTML = `${header('Schémas', 'Exercices et tactiques animés', `<a class="btn" href="#/bibliotheque">${I.video}<span>Bibliothèque</span></a><button class="btn" data-act="import">${I.upload}<span>Recevoir</span></button><button class="btn primary" data-act="new">${I.plus}<span>Nouveau schéma</span></button>`)}
      <div class="chips filter">${[['', 'Tous'], ['11', 'Foot à 11'], ['8', 'Foot à 8'], ['5', 'Foot à 5'], ['zone', 'Zones libres']].map(([v, l]) => `<button class="chip ${v === filt ? 'on' : ''}" data-f="${v}">${l}</button>`).join('')}</div>
      ${list.length ? `<div class="grid">${list.map(s => `<article class="card schema-card">
          <a href="#/schema/${s.id}" class="thumb"><img alt="" src="${UI.thumb(s)}"></a>
          <div class="sc-meta"><a href="#/schema/${s.id}"><b>${esc(s.name)}</b></a><span class="muted">${s.field.format === 'zone' ? `Zone ${s.field.w}×${s.field.h} m` : fmtLabel(s.field.format)} · ${s.steps.length} étape${s.steps.length > 1 ? 's' : ''}</span></div>
          <div class="sc-actions"><button class="icon-btn" data-dup="${s.id}" aria-label="Dupliquer">${I.copy}</button><button class="icon-btn danger" data-del="${s.id}" aria-label="Supprimer">${I.trash}</button></div>
        </article>`).join('')}</div>` : empty('Aucun schéma ici.', `<button class="btn primary" data-act="new">${I.plus}<span>Dessiner un schéma</span></button>`)}`;
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f !== undefined && b.classList.contains('chip')) { S().ui.schemaFilter = b.dataset.f; Store.save(); return schemas(root); }
      if (b.dataset.act === 'new') return newSchema();
      if (b.dataset.act === 'import') return importFile();
      if (b.dataset.dup) { const s = JSON.parse(JSON.stringify(Store.get('schemas', b.dataset.dup))); s.id = Store.uid(); s.name += ' (copie)'; Store.upsert('schemas', s); return schemas(root); }
      if (b.dataset.del) { const s = Store.get('schemas', b.dataset.del); if (await confirmBox(`Supprimer « ${s.name} » ?`)) { Store.remove('schemas', s.id); schemas(root); } }
    };
  }
  function blankSchema(name, field, teamId) {
    return { id: Store.uid(), name, teamId: teamId || null, field, overlays: {}, objects: [], zones: [], steps: [{ pos: {}, arrows: [], moves: {}, note: '', dur: 2 }] };
  }
  function newSchema(opts = {}) {
    const t = teamOf(opts.teamId || activeTeam());
    modal({ title: 'Nouveau schéma', body: `
      <label class="fld"><span>Nom</span><input id="sName" value="${esc(opts.name || '')}" placeholder="ex : Conservation 5 contre 5" maxlength="80"></label>
      <div class="lbl">Terrain</div>
      <div class="chips" id="sFmt">${[...FORMATS, ['zone', 'Zone libre']].map(([v, l]) => `<button class="chip ${v === (t ? t.format : '11') ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="chips" id="sView"><button class="chip on" data-v="full">Terrain entier</button><button class="chip" data-v="half">Demi-terrain</button></div>
      <div class="row2" id="sDims" hidden><label class="fld"><span>Longueur (m)</span><input type="number" id="sW" value="30" min="5" max="110"></label><label class="fld"><span>Largeur (m)</span><input type="number" id="sH" value="20" min="5" max="75"></label></div>`,
      onOpen: r => {
        const pick = id => $$(`#${id} .chip`, r).forEach(b => b.onclick = () => { $$(`#${id} .chip`, r).forEach(x => x.classList.remove('on')); b.classList.add('on'); sync(); });
        const sync = () => { const z = $('#sFmt .on', r).dataset.v === 'zone'; $('#sDims', r).hidden = !z; $('#sView', r).hidden = z; };
        pick('sFmt'); pick('sView'); sync();
      },
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const format = $('#sFmt .on', r).dataset.v;
        const field = format === 'zone' ? { format, view: 'full', w: Board.clamp(+$('#sW', r).value || 30, 5, 110), h: Board.clamp(+$('#sH', r).value || 20, 5, 75) } : { format, view: $('#sView .on', r).dataset.v };
        const s = Store.upsert('schemas', blankSchema($('#sName', r).value.trim() || 'Nouveau schéma', field, t && t.format === format ? t.id : null));
        if (opts.onCreate) opts.onCreate(s);
        location.hash = '#/schema/' + s.id;
      } }] });
  }

  /* ================= Entraînements ================= */
  function trainings(root) {
    const now = today(), list = byTeam(S().trainings);
    const up = list.filter(t => t.date >= now).sort((a, b) => a.date.localeCompare(b.date)), past = list.filter(t => t.date < now).sort((a, b) => b.date.localeCompare(a.date));
    const item = t => { const tm = teamOf(t.teamId), dur = t.exercises.reduce((a, e) => a + (+e.duration || 0), 0);
      return `<a class="list-item" href="#/entrainement/${t.id}"><div class="date-box"><b>${new Date(t.date + 'T12:00').getDate()}</b><span>${esc(fmtDate(t.date, { month: 'short' }))}</span></div>
        <div class="li-main"><b>${esc(t.title || 'Entraînement')}</b><span class="muted">${tm ? esc(tm.name) + ' · ' : ''}${t.exercises.length} exercice${t.exercises.length > 1 ? 's' : ''} · ${dur} min</span></div>${I.next}</a>`; };
    root.innerHTML = `${header('Entraînements', 'Séances, exercices et présences', `<button class="btn" data-act="import">${I.upload}<span>Recevoir</span></button><button class="btn" data-act="ics">${I.calendar}<span>Agenda (.ics)</span></button><a class="btn" href="#/bibliotheque">${I.pdf}<span>PDF (AssistCoachAI…)</span></a><button class="btn primary" data-act="new">${I.plus}<span>Nouvel entraînement</span></button>`)}
      ${teamSwitch()}
      <h2 class="section">À venir</h2>${up.length ? `<div class="list">${up.map(item).join('')}</div>` : '<p class="muted">Aucun entraînement prévu.</p>'}
      <h2 class="section">Passés</h2>${past.length ? `<div class="list">${past.map(item).join('')}</div>` : '<p class="muted">Rien pour l\'instant.</p>'}`;
    bindTeamSwitch(root, () => trainings(root));
    $('[data-act="new"]', root).onclick = newTraining;
    $('[data-act="import"]', root).onclick = importFile;
    $('[data-act="ics"]', root).onclick = () => Importer.trainingsFromICS(() => trainings(root));
  }
  function newTraining() {
    const t = activeTeam();
    modal({ title: 'Nouvel entraînement', body: `
      <label class="fld"><span>Thème</span><input id="trTitle" placeholder="ex : Sortie de balle à 3" maxlength="80"></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="trDate" value="${today()}"></label><label class="fld"><span>Heure</span><input type="time" id="trTime" value="18:00"></label></div>
      <label class="fld"><span>Équipe</span><select id="trTeam"><option value="">Aucune</option>${S().teams.map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const tr = Store.upsert('trainings', { id: Store.uid(), title: $('#trTitle', r).value.trim() || 'Entraînement', date: $('#trDate', r).value || today(), time: $('#trTime', r).value, teamId: $('#trTeam', r).value || null, goal: '', exercises: [], presents: [] });
        location.hash = '#/entrainement/' + tr.id;
      } }] });
  }
  function training(root, id) {
    const tr = Store.get('trainings', id); if (!tr) return (location.hash = '#/entrainements');
    const save = () => Store.upsert('trainings', tr);
    const render = () => {
      const tm = teamOf(tr.teamId), total = tr.exercises.reduce((a, e) => a + (+e.duration || 0), 0);
      root.innerHTML = `${header(`<input class="h1-input" id="trTitle" value="${esc(tr.title)}" aria-label="Thème">`, `${total} min au total`,
        `<button class="btn" data-act="share">${I.share}<span>Envoyer</span></button><button class="btn primary" data-act="pdf">${I.pdf}<span>PDF</span></button>`)}
        <section class="card">
          <div class="row3">
            <label class="fld"><span>Date</span><input type="date" id="trDate" value="${esc(tr.date)}"></label>
            <label class="fld"><span>Heure</span><input type="time" id="trTime" value="${esc(tr.time || '')}"></label>
            <label class="fld"><span>Équipe</span><select id="trTeam"><option value="">Aucune</option>${S().teams.map(x => `<option value="${x.id}" ${x.id === tr.teamId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          </div>
          <label class="fld"><span>Objectif de la séance</span><textarea id="trGoal" rows="2" placeholder="ex : jouer vers l'avant après la récupération">${esc(tr.goal || '')}</textarea></label>
        </section>
        <h2 class="section">Exercices</h2>
        <div class="ex-list">${tr.exercises.map((e, i) => exerciseCard(e, i, tr.exercises.length)).join('') || '<p class="muted">Ajoute ton premier exercice.</p>'}</div>
        <button class="btn primary" data-act="addEx">${I.plus}<span>Ajouter un exercice</span></button>
        <h2 class="section">Encadrants</h2><div class="staff-pick">${People.staffPicker(tr.teamId, tr.staffIds)}</div>
        ${tm ? `<h2 class="section" id="presH">Présents (${(tr.presents || []).length}/${Store.playersOf(tm.id).length})</h2>
          <div class="chips roster">${Store.playersOf(tm.id).map(p => `<button class="chip ${(tr.presents || []).includes(p.id) ? 'on' : ''}" data-present="${p.id}">${esc(pLabel(p))}</button>`).join('')}</div>` : ''}
        <div id="rateBox"></div>
        <div id="docsBox">${Library.docsPlaceholder()}</div>
        ${Media.placeholder('training:' + tr.id, 'Photos et vidéos de la séance')}
        <div class="danger-zone"><button class="btn" data-act="dup">${I.copy}<span>Dupliquer la séance</span></button><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer</span></button></div>`;
      const box = $('#rateBox', root); if (box) Ratings.bind(box, tr, save);
      rateTr(); Media.mount(root); Library.mountDocs($('#docsBox', root), tr, save);
    };
    const rateTr = () => { const box = $('#rateBox', root); if (box) box.innerHTML = Ratings.section(tr, Store.playersOf(tr.teamId || '').filter(p => (tr.presents || []).includes(p.id)), 'training'); };
    const exerciseCard = (e, i, n) => {
      const sc = e.schemaId && Store.get('schemas', e.schemaId);
      return `<article class="card ex" data-ex="${e.id}">
        <div class="ex-head"><span class="ex-num">${i + 1}</span><input class="ex-title" data-f="title" value="${esc(e.title)}" placeholder="Nom de l'exercice">
          <label class="dur"><input type="number" min="0" max="180" data-f="duration" value="${esc(e.duration)}" aria-label="Durée en minutes"><span>min</span></label>
          <button class="icon-btn" data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">${I.up}</button><button class="icon-btn" data-mv="1" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre">${I.down}</button>
          <button class="icon-btn danger" data-delex aria-label="Supprimer l'exercice">${I.trash}</button></div>
        <div class="ex-body">
          <div class="ex-fields">
            <label class="fld"><span>Organisation</span><textarea rows="2" data-f="org" placeholder="Taille du terrain, nombre de joueurs, déroulement">${esc(e.org || '')}</textarea></label>
            <label class="fld"><span>Consignes (une par ligne)</span><textarea rows="3" data-f="consignes" placeholder="Passe au sol&#10;Je regarde avant de recevoir">${esc(e.consignes || '')}</textarea></label>
            <label class="fld"><span>Matériel</span><input data-f="materiel" value="${esc(e.materiel || '')}" placeholder="plots, chasubles, ballons"></label>
          </div>
          <div class="ex-schema">${sc ? `<a href="#/schema/${sc.id}" class="thumb"><img alt="" src="${UI.thumb(sc)}"></a><div class="chips"><a class="btn soft" href="#/schema/${sc.id}">${I.edit}<span>Modifier le schéma</span></a><button class="btn soft" data-pick>${I.layers}<span>Changer</span></button></div>`
            : `<div class="no-schema"><button class="btn primary" data-draw>${I.board}<span>Dessiner le schéma</span></button><button class="btn soft" data-pick>${I.layers}<span>Choisir un schéma</span></button></div>`}</div>
        </div></article>`;
    };
    render();
    root.oninput = e => {
      const t = e.target, card = t.closest('[data-ex]');
      if (card) { const ex = tr.exercises.find(x => x.id === card.dataset.ex); ex[t.dataset.f] = t.dataset.f === 'duration' ? +t.value : t.value; save(); if (t.dataset.f === 'duration') $('.sub', root).textContent = tr.exercises.reduce((a, x) => a + (+x.duration || 0), 0) + ' min au total'; return; }
      const map = { trTitle: 'title', trDate: 'date', trTime: 'time', trGoal: 'goal' };
      if (map[t.id]) { tr[map[t.id]] = t.value; save(); }
    };
    root.onchange = e => {
      if (e.target.id === 'trTeam') { tr.teamId = e.target.value || null; save(); render(); }
      if (e.target.hasAttribute('data-staffpick') && e.target.value) { tr.staffIds = [...new Set([...(tr.staffIds || []), e.target.value])]; save(); render(); }
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const card = b.closest('[data-ex]'), ex = card && tr.exercises.find(x => x.id === card.dataset.ex);
      if (b.dataset.present) { const p = tr.presents = tr.presents || [], i = p.indexOf(b.dataset.present); i < 0 ? p.push(b.dataset.present) : p.splice(i, 1); save(); b.classList.toggle('on'); $('#presH', root).textContent = `Présents (${p.length}/${Store.playersOf(tr.teamId).length})`; rateTr(); return; }
      if (b.dataset.unstaff) { tr.staffIds = (tr.staffIds || []).filter(x => x !== b.dataset.unstaff); save(); return render(); }
      if (b.dataset.mv) { const i = tr.exercises.indexOf(ex), j = i + +b.dataset.mv; [tr.exercises[i], tr.exercises[j]] = [tr.exercises[j], tr.exercises[i]]; save(); return render(); }
      if (b.hasAttribute('data-delex')) { if (await confirmBox(`Retirer l'exercice « ${ex.title || 'sans nom'} » ?`, 'Retirer')) { tr.exercises = tr.exercises.filter(x => x !== ex); save(); render(); } return; }
      if (b.hasAttribute('data-draw')) return newSchema({ name: ex.title, teamId: tr.teamId, onCreate: s => { ex.schemaId = s.id; save(); } });
      if (b.hasAttribute('data-pick')) return pickSchema(s => { ex.schemaId = s.id; save(); render(); });
      switch (b.dataset.act) {
        case 'addEx': tr.exercises.push({ id: Store.uid(), title: '', duration: 15, org: '', consignes: '', materiel: '', schemaId: null }); save(); render(); { const l = $$('.ex-title', root).pop(); if (l) l.focus(); } return;
        case 'pdf': return runExport('Création du PDF…', () => Exporter.pdfTraining(tr, teamOf(tr.teamId), S().club, { homeBib: S().club.homeBib }));
        case 'share': return runExport('Préparation du fichier…', async () => Exporter.json(await Library.withBackgrounds(Store.exportTraining(tr)), tr.title || 'entrainement'));
        case 'dup': { const c = JSON.parse(JSON.stringify(tr)); c.id = Store.uid(); c.title += ' (copie)'; c.date = today(); c.presents = []; c.exercises.forEach(x => x.id = Store.uid()); Store.upsert('trainings', c); location.hash = '#/entrainement/' + c.id; return; }
        case 'delete': if (await confirmBox(`Supprimer l'entraînement « ${tr.title} » ? Les schémas restent dans la liste des schémas.`)) { Store.remove('trainings', tr.id); Media.removeRef('training:' + tr.id); location.hash = '#/entrainements'; } return;
      }
    };
  }
  function pickSchema(cb) {
    const list = S().schemas.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const close = modal({ title: 'Choisir un schéma', noFocus: true,
      body: list.length ? `<div class="pick-grid">${list.map(s => `<button class="pick" data-id="${s.id}"><img alt="" src="${UI.thumb(s, 320, 208)}"><span>${esc(s.name)}</span></button>`).join('')}</div>` : '<p class="muted">Aucun schéma pour l\'instant.</p>',
      onOpen: r => $$('.pick', r).forEach(b => b.onclick = () => { close(); cb(Store.get('schemas', b.dataset.id)); }) });
  }

  /* ================= Matchs ================= */
  function matches(root) {
    const now = today(), list = byTeam(S().matches);
    const up = list.filter(m => !m.played && m.date >= now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const done = list.filter(m => m.played || m.date < now).sort((a, b) => b.date.localeCompare(a.date));
    const item = m => `<a class="list-item" href="#/match/${m.id}"><div class="date-box"><b>${new Date(m.date + 'T12:00').getDate()}</b><span>${esc(fmtDate(m.date, { month: 'short' }))}</span></div>
      <div class="li-main"><b>${matchTitle(m)}</b><span class="muted">${esc(m.competition || '')} · ${m.home ? 'Domicile' : 'Extérieur'}${m.time ? ' · ' + esc(m.time) : ''}</span></div>
      ${m.played ? `<span class="score">${scoreTxt(m)}</span>${resPill(m)}` : ''}${I.next}</a>`;
    root.innerHTML = `${header('Matchs', 'Convocations, compositions et résultats', `<button class="btn" data-act="imp">${I.upload}<span>Importer (FFF, agenda…)</span></button><button class="btn primary" data-act="new">${I.plus}<span>Nouveau match</span></button>`)}
      ${teamSwitch()}
      <h2 class="section">À venir</h2>${up.length ? `<div class="list">${up.map(item).join('')}</div>` : '<p class="muted">Aucun match prévu.</p>'}
      <h2 class="section">Résultats</h2>${done.length ? `<div class="list">${done.map(item).join('')}</div>` : '<p class="muted">Pas encore de résultat.</p>'}`;
    bindTeamSwitch(root, () => matches(root));
    $('[data-act="new"]', root).onclick = newMatch;
    $('[data-act="imp"]', root).onclick = () => Importer.matchesDialog(() => matches(root));
  }
  function newMatch() {
    const t = activeTeam() || (S().teams[0] && S().teams[0].id) || '';
    modal({ title: 'Nouveau match', body: `
      <label class="fld"><span>Adversaire</span><input id="mOpp" placeholder="ex : AS Bondy" maxlength="40"></label>
      <div class="row2"><label class="fld"><span>Date</span><input type="date" id="mDate" value="${today()}"></label><label class="fld"><span>Coup d'envoi</span><input type="time" id="mTime" value="10:00"></label></div>
      <div class="chips" id="mHome"><button class="chip on" data-v="1">Domicile</button><button class="chip" data-v="0">Extérieur</button></div>
      <div class="row2"><label class="fld"><span>Compétition</span><select id="mComp">${COMPS.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label class="fld"><span>Équipe</span><select id="mTeam">${S().teams.map(x => `<option value="${x.id}" ${x.id === t ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>`,
      onOpen: r => $$('#mHome .chip', r).forEach(b => b.onclick = () => { $$('#mHome .chip', r).forEach(x => x.classList.remove('on')); b.classList.add('on'); }),
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        if (!S().teams.length) { toast('Crée d\'abord une équipe', 'err'); return false; }
        const m = Store.upsert('matches', { id: Store.uid(), teamId: $('#mTeam', r).value, opponent: $('#mOpp', r).value.trim() || 'Adversaire', date: $('#mDate', r).value || today(), time: $('#mTime', r).value, home: $('#mHome .on', r).dataset.v === '1', competition: $('#mComp', r).value, place: '', rdv: '', played: false, gf: 0, ga: 0, convoked: [], stats: {}, notes: '' });
        location.hash = '#/match/' + m.id;
      } }] });
  }
  function match(root, id) {
    const m = Store.get('matches', id); if (!m) return (location.hash = '#/matchs');
    const save = () => Store.upsert('matches', m);
    const stepper = (key, val, lab) => `<div class="stepper"><span>${lab}</span><button class="icon-btn" data-sc="${key}" data-d="-1" aria-label="Moins">${I.minus}</button><b>${val}</b><button class="icon-btn" data-sc="${key}" data-d="1" aria-label="Plus">${I.plus}</button></div>`;
    const render = () => {
      const t = teamOf(m.teamId), roster = t ? Store.playersOf(t.id) : [], conv = roster.filter(p => (m.convoked || []).includes(p.id));
      const lineup = m.lineupId && Store.get('schemas', m.lineupId);
      root.innerHTML = `${header(matchTitle(m), `${esc(fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${t ? ' · ' + esc(t.name) : ''}`,
        `<button class="btn primary" data-act="pdf">${I.pdf}<span>Feuille de match</span></button>`)}
        <section class="card">
          <div class="row3">
            <label class="fld"><span>Adversaire</span><input data-f="opponent" value="${esc(m.opponent)}"></label>
            <label class="fld"><span>Date</span><input type="date" data-f="date" value="${esc(m.date)}"></label>
            <label class="fld"><span>Coup d'envoi</span><input type="time" data-f="time" value="${esc(m.time || '')}"></label>
            <label class="fld"><span>Rendez-vous</span><input type="time" data-f="rdv" value="${esc(m.rdv || '')}"></label>
            <label class="fld"><span>Compétition</span><select data-f="competition">${COMPS.map(c => `<option ${c === m.competition ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="fld"><span>Lieu</span><input data-f="place" value="${esc(m.place || '')}" placeholder="Stade, adresse"></label>
          </div>
          <div class="chips"><button class="chip ${m.home ? 'on' : ''}" data-home="1">Domicile</button><button class="chip ${!m.home ? 'on' : ''}" data-home="0">Extérieur</button></div>
        </section>
        <h2 class="section">Convoqués (${conv.length})</h2>
        ${t ? `<div class="chips roster">${roster.map(p => `<button class="chip ${(m.convoked || []).includes(p.id) ? 'on' : ''}" data-conv="${p.id}">${esc(pLabel(p))}</button>`).join('')}</div>` : '<p class="muted">Choisis une équipe.</p>'}
        <h2 class="section">Encadrants</h2><div class="staff-pick">${People.staffPicker(m.teamId, m.staffIds)}</div>
        <h2 class="section">Composition</h2>
        <section class="card lineup">${lineup ? `<a href="#/schema/${lineup.id}" class="thumb"><img alt="" src="${UI.thumb(lineup)}"></a><a class="btn soft" href="#/schema/${lineup.id}">${I.edit}<span>Modifier la composition</span></a>`
          : `<p class="muted">Place tes joueurs convoqués sur le terrain.</p><button class="btn primary" data-act="lineup">${I.formation}<span>Faire la composition</span></button>`}</section>
        <h2 class="section">Score</h2>
        <section class="card">
          <label class="switch"><input type="checkbox" id="mPlayed" ${m.played ? 'checked' : ''}><span>Le match est joué</span></label>
          ${Ratings.smileyPicker(m)}
          ${m.played ? `<div class="score-board">${stepper('gf', m.gf, esc(S().club.name))}${stepper('ga', m.ga, esc(m.opponent))}</div>
            ${conv.length ? `<div class="lbl">Buteurs et passeurs</div><div class="scorers">${conv.map(p => { const st = (m.stats || {})[p.id] || {};
              return `<div class="scorer"><span class="nm">${esc(pLabel(p))}</span>
                <span class="mini-step" title="Buts">${I.ball}<button data-pl="${p.id}" data-k="g" data-d="-1" aria-label="Moins de buts">−</button><b>${st.g || 0}</b><button data-pl="${p.id}" data-k="g" data-d="1" aria-label="Plus de buts">+</button></span>
                <span class="mini-step" title="Passes décisives"><em>P</em><button data-pl="${p.id}" data-k="a" data-d="-1" aria-label="Moins de passes">−</button><b>${st.a || 0}</b><button data-pl="${p.id}" data-k="a" data-d="1" aria-label="Plus de passes">+</button></span></div>`; }).join('')}</div>` : '<p class="tip">Coche les convoqués pour noter les buteurs.</p>'}` : ''}
          <label class="fld"><span>Notes</span><textarea data-f="notes" rows="3" placeholder="Ce qui a marché, ce qu'on travaille la semaine prochaine">${esc(m.notes || '')}</textarea></label>
        </section>
        <div id="rateBox"></div>
        <div id="docsBox">${Library.docsPlaceholder()}</div>
        ${Media.placeholder('match:' + m.id, 'Photos et vidéos du match')}
        <div class="danger-zone"><button class="btn danger" data-act="delete">${I.trash}<span>Supprimer le match</span></button></div>`;
      const box = $('#rateBox', root); box.innerHTML = Ratings.section(m, conv, 'match'); Ratings.bind(box, m, save);
      Media.mount(root); Library.mountDocs($('#docsBox', root), m, save);
    };
    const cheer = before => { if (Ratings.result(m) === 'V' && before !== 'V') Ratings.celebrate(); };
    render();
    root.oninput = e => { const f = e.target.dataset.f; if (f) { m[f] = e.target.value; save(); } };
    root.onchange = e => {
      if (e.target.id === 'mPlayed') { const before = Ratings.result(m); m.played = e.target.checked; save(); render(); return cheer(before); }
      if (e.target.hasAttribute('data-staffpick') && e.target.value) { m.staffIds = [...new Set([...(m.staffIds || []), e.target.value])]; save(); return render(); }
      root.oninput(e);
    };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.home) { m.home = b.dataset.home === '1'; save(); return render(); }
      if (b.dataset.unstaff) { m.staffIds = (m.staffIds || []).filter(x => x !== b.dataset.unstaff); save(); return render(); }
      if (b.dataset.conv) { const c = m.convoked = m.convoked || [], i = c.indexOf(b.dataset.conv); i < 0 ? c.push(b.dataset.conv) : c.splice(i, 1); save(); return render(); }
      if (b.dataset.sc) { const before = Ratings.result(m); m[b.dataset.sc] = Math.max(0, (+m[b.dataset.sc] || 0) + +b.dataset.d); if (Ratings.result(m) !== before) delete m.smiley; save(); render(); return cheer(before); }
      if (b.dataset.smiley) { m.smiley = b.dataset.smiley; save(); return render(); }
      if (b.dataset.pl) { const st = (m.stats = m.stats || {})[b.dataset.pl] = m.stats[b.dataset.pl] || {}; st[b.dataset.k] = Math.max(0, (st[b.dataset.k] || 0) + +b.dataset.d); save(); return render(); }
      switch (b.dataset.act) {
        case 'pdf': return runExport('Création de la feuille de match…', () => Exporter.pdfMatch(m, teamOf(m.teamId), S().club, { homeBib: S().club.homeBib }));
        case 'lineup': return makeLineup(m);
        case 'delete': if (await confirmBox('Supprimer ce match ?')) { Store.remove('matches', m.id); Media.removeRef('match:' + m.id); location.hash = '#/matchs'; } return;
      }
    };
  }
  function makeLineup(m) {
    const t = teamOf(m.teamId); if (!t) return toast('Choisis une équipe', 'err');
    const forms = Object.keys(Formations[t.format]);
    modal({ title: 'Composition', body: `<label class="fld"><span>Système</span><select id="lf">${forms.map(f => `<option>${esc(f)}</option>`).join('')}</select></label>
      <p class="tip">Les convoqués sont placés automatiquement : gardien dans le but, puis dans l'ordre de la liste. Tu pourras les déplacer.</p>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer', kind: 'primary', onClick: (c, r) => {
        const sc = blankSchema(`Compo contre ${m.opponent}`, { format: t.format, view: 'full' }, t.id);
        const { L, W } = Board.dims(sc.field), players = Store.playersOf(t.id).filter(p => (m.convoked || []).includes(p.id));
        const gks = players.filter(p => p.pos === 'GB'), field = players.filter(p => p.pos !== 'GB');
        const order = { DEF: 0, MIL: 1, ATT: 2 }; field.sort((a, b) => order[a.pos] - order[b.pos]);
        Formations[t.format][$('#lf', r).value].forEach(([lab, x, y, gk]) => {
          const who = gk ? gks.shift() : field.shift(), id = Store.uid();
          sc.objects.push({ id, type: 'player', color: gk ? 'jaune' : S().club.homeBib, gk: !!gk, label: who && who.number ? String(who.number) : lab, name: who ? Store.shortName(who) : '', playerId: who ? who.id : undefined });
          sc.steps[0].pos[id] = [Math.min(x * 1.9, .94) * L, y * W]; // spread our half over the whole pitch
        });
        sc.overlays.names = true;
        Store.upsert('schemas', sc); m.lineupId = sc.id; Store.upsert('matches', m);
        location.hash = '#/schema/' + sc.id;
      } }] });
  }

  /* ================= Stats ================= */
  function stats(root) {
    const tid = activeTeam() || (S().teams[0] && S().teams[0].id);
    const t = teamOf(tid);
    if (!t) { root.innerHTML = header('Statistiques') + empty('Crée une équipe pour voir ses statistiques.'); return; }
    S().ui.teamId = tid;
    const ms = S().matches.filter(m => m.teamId === t.id && m.played).sort((a, b) => b.date.localeCompare(a.date));
    const trs = S().trainings.filter(x => x.teamId === t.id && (x.presents || []).length);
    const V = ms.filter(m => result(m) === 'V').length, N = ms.filter(m => result(m) === 'N').length, D = ms.filter(m => result(m) === 'D').length;
    const bp = ms.reduce((a, m) => a + (+m.gf || 0), 0), bc = ms.reduce((a, m) => a + (+m.ga || 0), 0);
    const sortKey = S().ui.statSort || 'g';
    const rows = Store.playersOf(t.id).map(p => {
      const played = ms.filter(m => (m.convoked || []).includes(p.id)).length;
      const g = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).g || 0), 0), as = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).a || 0), 0);
      const pr = trs.filter(x => x.presents.includes(p.id)).length;
      return { p, played, g, a: as, pr, rate: trs.length ? Math.round(pr / trs.length * 100) : null, nm: Ratings.average(p.id, 'match') || 0, nt: Ratings.average(p.id, 'training') || 0 };
    }).sort((a, b) => sortKey === 'name' ? Store.byName(a.p, b.p) : sortKey === 'num' ? (+a.p.number || 99) - (+b.p.number || 99) : (b[sortKey] || 0) - (a[sortKey] || 0));
    const th = (k, l) => `<th><button class="th ${sortKey === k ? 'on' : ''}" data-sort="${k}">${l}</button></th>`;
    root.innerHTML = `${header('Statistiques', esc(t.name))}
      ${teamSwitch()}
      <div class="tiles">
        <div class="tile"><b>${ms.length}</b><span>Matchs</span></div>
        <div class="tile v"><b>${V}</b><span>Gagnés</span></div>
        <div class="tile n"><b>${N}</b><span>Nuls</span></div>
        <div class="tile d"><b>${D}</b><span>Perdus</span></div>
        <div class="tile"><b>${bp}</b><span>Buts marqués</span></div>
        <div class="tile"><b>${bc}</b><span>Buts encaissés</span></div>
        <div class="tile"><b>${V * 3 + N}</b><span>Points</span></div>
      </div>
      <h2 class="section">Joueurs</h2>
      <div class="table-wrap"><table class="tbl">
        <thead><tr>${th('num', 'N°')}${th('name', 'Joueur')}${th('played', 'Matchs')}${th('g', 'Buts')}${th('a', 'Passes déc.')}${th('pr', 'Entraînements')}${th('nm', 'Note matchs')}${th('nt', 'Note entr.')}</tr></thead>
        <tbody>${rows.map(r => `<tr><td class="num">${esc(r.p.number)}</td><td>${esc(pName(r.p))}</td><td>${r.played}</td><td><b>${r.g}</b></td><td>${r.a}</td><td>${r.rate === null ? '–' : `${r.pr} <span class="muted">(${r.rate} %)</span>`}</td><td>${r.nm ? '⭐ ' + Ratings.fr(r.nm) : '–'}</td><td>${r.nt ? '⭐ ' + Ratings.fr(r.nt) : '–'}</td></tr>`).join('')}</tbody>
      </table></div>
      <h2 class="section">Résultats</h2>
      ${ms.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Match</th><th>Score</th><th>Résultat</th></tr></thead>
        <tbody>${ms.map(m => `<tr><td>${esc(fmtDate(m.date))}</td><td><a href="#/match/${m.id}">${matchTitle(m)}</a></td><td class="num">${scoreTxt(m)}</td><td>${resPill(m)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Pas encore de match joué.</p>'}`;
    bindTeamSwitch(root, () => stats(root));
    $$('[data-sort]', root).forEach(b => b.onclick = () => { S().ui.statSort = b.dataset.sort; Store.save(); stats(root); });
  }

  /* ================= Réglages ================= */
  function settings(root) {
    const c = S().club;
    const bibs = (key, cur) => `<div class="chips">${Object.entries(Board.BIBS).map(([k, v]) => `<button class="chip bib ${k === cur ? 'on' : ''}" data-${key}="${k}" aria-label="${k}"><i class="sw" style="background:${v[0]}"></i>${k}</button>`).join('')}</div>`;
    root.innerHTML = `${header('Réglages', '')}
      ${Auth.settingsSection()}
      ${Cloud.settingsSection()}
      ${Help.settingsSection()}
      <section class="card">
        <h2>${I.team}Club</h2>
        <label class="fld"><span>Nom du club</span><input id="clubName" value="${esc(c.name)}" maxlength="40"></label>
        <div class="lbl">Couleur de nos maillots</div>${bibs('home', c.homeBib)}
        <div class="lbl">Couleur des adversaires</div>${bibs('away', c.awayBib)}
      </section>
      <section class="card">
        <h2>${I.share}Fichiers du club</h2>
        <p>${Cloud.ready() ? 'Les équipes, joueurs, dirigeants, schémas, entraînements et matchs se partagent tout seuls entre les éducateurs par le serveur du club. Les photos et vidéos restent sur l\'appareil qui les a prises.' : 'Chaque éducateur a l\'appli sur son appareil. Pour partager, envoie un fichier (AirDrop, WhatsApp, mail) : l\'autre éducateur l\'ouvre avec « Recevoir un fichier ».'}</p>
        <p class="muted small">« Recevoir un fichier » sert aussi à charger la liste des licenciés ou une sauvegarde. Les listes de joueurs contiennent des numéros de téléphone : envoie-les seulement aux éducateurs du club.</p>
        <div class="chips"><button class="btn primary" data-act="exportAll">${I.download}<span>Envoyer toutes mes données</span></button>
        <button class="btn" data-act="import">${I.upload}<span>Recevoir un fichier</span></button></div>
      </section>
      <section class="card">
        <h2>${I.help}Installer l'appli sur l'iPad ou l'iPhone</h2>
        <ol class="steps-help"><li>Ouvre cette page dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li><li>Choisis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li><li>Lance l'appli depuis son icône : elle marche ensuite sans internet.</li></ol>
      </section>
      ${S().teams.some(t => t.example) || S().schemas.some(s => s.example) ? `<section class="card">
        <h2>${I.layers}Exemples</h2>
        <p class="muted">L'appli contient des équipes, schémas, entraînements et matchs d'exemple.</p>
        <button class="btn" data-act="noExamples">${I.trash}<span>Supprimer les exemples</span></button>
      </section>` : ''}
      ${Auth.isAdmin() ? `<section class="card">
        <h2>${I.trash}Effacer</h2>
        <p class="muted">${Cloud.ready() ? 'Efface les données de cet appareil seulement (elles restent sur le serveur du club et reviennent à la prochaine connexion).' : 'Les données sont enregistrées sur cet appareil uniquement. Pense à envoyer une copie avant d\'effacer.'}</p>
        <button class="btn danger" data-act="reset">${I.trash}<span>Effacer les données de cet appareil</span></button>
      </section>` : ''}
      <p class="muted small">Raincy Coach · version ${Help.VERSION} · <button class="linkish" onclick="App.checkUpdate(true)">Mettre à jour l'appli</button></p>`;
    Help.onSettings(root, () => settings(root));
    Auth.mountSettings(root);
    root.onchange = e => Auth.onSettingsChange(e.target);
    $('#clubName', root).oninput = e => { c.name = e.target.value || 'Mon club'; Store.save(); App.refreshChrome(); };
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.home) { c.homeBib = b.dataset.home; Store.save(); App.refreshChrome(); return settings(root); }
      if (b.dataset.away) { c.awayBib = b.dataset.away; Store.save(); return settings(root); }
      if (b.dataset.act === 'exportAll') return runExport('Préparation du fichier…', async () => { S().ui.clubFileSent = true; Store.save(); return Exporter.json(await Library.withBackgrounds(Store.exportAll()), `${c.name}-${today()}`); });
      if (b.dataset.auth || b.dataset.reset) return Auth.onSettingsClick(b, () => settings(root));
      if (b.dataset.cloud) return Cloud.onSettingsClick(b, () => settings(root));
      if (b.dataset.act === 'import') return importFile();
      if (b.dataset.act === 'noExamples' && await confirmBox('Supprimer toutes les données d\'exemple ?')) { Store.removeExamples(); toast('Exemples supprimés'); return settings(root); }
      if (b.dataset.act === 'reset' && await confirmBox('Effacer toutes les équipes, schémas, entraînements et matchs de cet appareil ?', 'Tout effacer')) { Store.reset(); toast('Données effacées'); Auth.logout(); }
    };
  }

  /* ================= shared ================= */
  async function runExport(label, fn) {
    const b = UI.busy(label);
    try { const r = await fn(b.progress); if (r === 'downloaded') toast('Fichier enregistré dans Téléchargements'); }
    catch (err) { console.error(err); toast(err.message || 'Export impossible', 'err'); }
    finally { b.done(); }
  }
  // Receive a .raincy.json file (players, staff, sessions, matches…) from another coach or from the club
  async function receiveText(txt) {
    txt = String(txt).replace(/^\uFEFF/, '');
    if (People.isClubList(txt)) {
      const r = People.importClubList(txt), p = r.players, s = r.staff;
      App.route();
      modal({ title: 'Liste reçue', noFocus: true, body: `<p class="lead">Joueurs : ${p.added} ajouté${p.added > 1 ? 's' : ''}, ${p.updated} mis à jour. Dirigeants : ${s.added} ajouté${s.added > 1 ? 's' : ''}, ${s.updated} mis à jour.</p>
        <p class="muted">Chaque joueur est rangé dans sa catégorie selon son année de naissance. Retrouve-les dans Équipes.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
      return true;
    }
    try {
      const r = Store.importText(String(txt).replace(/^﻿/, '').trim());
      await Library.restoreBackgrounds();
      const d = r.byCol || {}, names = [['players', 'joueur'], ['staff', 'dirigeant'], ['teams', 'catégorie'], ['trainings', 'séance'], ['matches', 'match'], ['schemas', 'schéma']];
      const parts = names.filter(([c]) => d[c]).map(([c, w]) => `${d[c]} ${w}${d[c] > 1 ? 's' : ''}`);
      App.route();
      modal({ title: 'Fichier reçu', noFocus: true, body: `<p class="lead">${parts.length ? 'Ajouté ou mis à jour : ' + esc(parts.join(', ')) + '.' : 'Tout était déjà à jour sur cet appareil.'}</p>
        <p class="muted">${r.added} nouveauté${r.added > 1 ? 's' : ''} · ${r.updated} mise${r.updated > 1 ? 's' : ''} à jour. Retrouve les joueurs dans Équipes.</p>`, actions: [{ label: 'OK', kind: 'primary' }] });
      return true;
    } catch (err) { toast(err.message || 'Fichier illisible', 'err'); return false; }
  }
  function importFile() {
    modal({ title: 'Recevoir un fichier', noFocus: true,
      body: `<p>Choisis le fichier <b>.raincy.json</b> ou la liste <b>.txt</b> des licenciés et dirigeants (liste des licenciés, données d'un autre éducateur…). Sur iPhone ou iPad, il doit d'abord être enregistré dans l'app <b>Fichiers</b> ; sur PC ou Android, dans Téléchargements.</p>
        <button class="btn primary wide" id="rcvPick">${I.upload}<span>Choisir le fichier</span></button>
        <details class="paste-box"><summary>Le fichier ne se sélectionne pas ?</summary>
          <p class="muted small">Ouvre le fichier dans une autre appli (Fichiers, Mail, Notes…), copie tout son texte, puis colle-le ici.</p>
          <textarea id="rcvText" rows="5" placeholder='{"app":"raincy-coach", …}'></textarea>
          <button class="btn wide" id="rcvPaste">${I.paste}<span>Importer le texte collé</span></button></details>`,
      onOpen: (r, close) => {
        $('#rcvPick', r).onclick = async () => {
          const [f] = await UI.pickFiles(); if (!f) return;
          const txt = await f.text(); close();
          const b = UI.busy('Lecture du fichier…');
          try { await receiveText(txt); } finally { b.done(); }
        };
        $('#rcvPaste', r).onclick = async () => {
          const t = $('#rcvText', r).value; if (!t.trim()) return toast('Colle d\'abord le texte du fichier', 'err');
          close(); await receiveText(t);
        };
      } });
  }

  return { home, teams, team, schemas, trainings, training, matches, match, stats, settings, newSchema };
})();
