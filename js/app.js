/* App shell: navigation, routing, service worker. */
const App = (() => {
  // [hash, label, icon, short label for phones]; on phones the first five stay in the tab bar, the others go in « Plus »
  const NAV = [
    ['', 'Accueil', 'home'], ['planning', 'Planning', 'calendar'], ['entrainements', 'Entraînements', 'training', 'Séances'], ['matchs', 'Matchs', 'match'], ['messages', 'Messages', 'chat'],
    ['club', 'Vie du club', 'pin', 'Club'], ['resultats', 'Résultats', 'medal'], ['equipes', 'Équipes', 'team'], ['schemas', 'Schémas', 'board'], ['bibliotheque', 'Bibliothèque', 'video', 'Biblio'], ['stats', 'Stats', 'stats'], ['reglages', 'Réglages', 'settings'],
  ];
  const PHONE_MAIN = 5;
  const view = () => document.getElementById('view');

  function refreshChrome() {
    const c = Store.state.club;
    // Banner while a responsable looks at the app as a coach
    let bar = document.getElementById('previewBar'); const pv = Auth.preview();
    if (pv) {
      if (!bar) { bar = document.createElement('div'); bar.id = 'previewBar'; document.body.appendChild(bar); }
      const names = pv.teamIds.map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ');
      bar.innerHTML = `<span>👀 Aperçu coach · ${UI.esc(names)}</span><button class="btn" id="stopPv">Revenir<span class="lg"> en responsable</span></button>`;
      bar.querySelector('#stopPv').onclick = () => Auth.stopPreview();
      document.body.classList.add('previewing');
      document.body.style.setProperty('--pvh', bar.offsetHeight + 'px');
    } else if (bar) { bar.remove(); document.body.classList.remove('previewing'); }
    document.documentElement.style.setProperty('--accent', UI.accentFor(c.homeBib));
    document.getElementById('clubName').textContent = c.name;
    const u = Auth.current(), ru = document.getElementById('railUser');
    // The connected coach: his initials with his favourite club's crest, and « Coach Prénom » (opens Mon compte)
    const coach = u ? Messages.coachName(u) : '', first = coach.replace(/^Coach /, '');
    ru.innerHTML = u ? `<a class="ru-me" href="#/reglages" title="Mon compte">
        <span class="avatar" aria-hidden="true">${UI.esc((first[0] || '') + ((u.lastName || '')[0] || ''))}${u.club ? `<span class="avatar-club">${Clubs.crest(u.club, 18, () => refreshChrome())}</span>` : ''}</span>
        <span class="ru-name">${UI.esc(coach)}</span></a><button class="ru-out" id="logoutBtn">Sortir</button>` : '';
    const lo = document.getElementById('logoutBtn'); if (lo) lo.onclick = () => Auth.logout();
    document.title = (u ? coach + ' · ' : '') + c.name;
  }
  function renderNav(active) {
    const idx = NAV.findIndex(n => n[0] === active);
    document.getElementById('nav').innerHTML = NAV.map(([h, l, ic, short], i) =>
      `<a href="#/${h}" class="${h === active ? 'on' : ''} ${i >= PHONE_MAIN ? 'more' : ''}" ${h === active ? 'aria-current="page"' : ''} aria-label="${l}">${I[ic]}<span class="lg">${l}</span><span class="sh">${short || l}</span></a>`).join('')
      + `<button class="nav-more ${idx >= PHONE_MAIN ? 'on' : ''}" id="navMore" aria-label="Plus de pages">${I.layers}<span class="sh">Plus</span></button>`;
    document.getElementById('navMore').onclick = () => {
      const close = UI.modal({ title: 'Plus', noFocus: true,
        body: `<div class="more-grid">${NAV.slice(PHONE_MAIN).map(([h, l, ic]) => `<a class="more-item" href="#/${h}">${I[ic]}<span>${l}</span></a>`).join('')}</div>`,
        onOpen: r => r.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close())) });
    };
    Messages.badge();
  }
  // keep = true: same page redrawn with new data from the server, stay where the user was in the page
  function route(keep) {
    keep = keep === true;
    const sy = window.scrollY, st = view().scrollTop;
    const [, name = '', id] = (location.hash || '#/').split('/');
    const root = view();
    root.onclick = root.oninput = root.onchange = null;
    Editor.close();
    if (name !== 'messages') Messages.leave();
    if (name === 'connexion') { history.replaceState(null, '', '#/'); route(); return Auth.connectServer(); }
    document.body.dataset.page = name;
    const full = name === 'schema';
    document.body.classList.toggle('editing', full);
    const navKey = { equipe: 'equipes', joueurs: 'equipes', dirigeants: 'equipes', schema: 'schemas', entrainement: 'entrainements', match: 'matchs' }[name] || name;
    renderNav(navKey);
    if (full) {
      const sc = Store.get('schemas', id);
      if (!sc) { location.hash = '#/schemas'; return; }
      Help.button(); return Editor.open(root, sc);
    }
    const fn = { '': Views.home, equipes: Views.teams, equipe: Views.team, schemas: Views.schemas, entrainements: Views.trainings, entrainement: Views.training,
      matchs: Views.matches, match: Views.match, stats: Views.stats, reglages: Views.settings,
      planning: r => Planning.page(r), resultats: r => Results.page(r), club: (r, x) => ClubLife.page(r, x), messages: (r, x) => Messages.page(r, x),
      bibliotheque: r => Library.page(r), joueurs: r => People.listPage(r, 'player'), dirigeants: r => People.listPage(r, 'staff') }[name] || Views.home;
    fn(root, id);
    if (keep) { root.scrollTop = st; window.scrollTo(0, sy); } else { root.scrollTop = 0; window.scrollTo(0, 0); }
    Help.button();
  }
  /* Updates: version.json on the site says which build is online. When it is newer than this one,
     the app empties its offline copy and reloads (an iPhone can keep an old copy open for days). */
  const BUILD = 44, UPD = 'raincy-update-tried';
  async function onlineBuild() {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    return (await r.json()).build || 0;
  }
  async function forceUpdate() {
    try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch (e) {}
    try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch (e) {}
    location.reload();
  }
  async function checkUpdate(manual) {
    let online;
    try { online = await onlineBuild(); } catch (e) { if (manual) UI.toast('Pas de connexion internet : impossible de vérifier la version.', 'err'); return; }
    if (online > BUILD) {
      let tried = null; try { tried = sessionStorage.getItem(UPD); } catch (e) {}
      if (!manual && tried === String(online)) return; // already tried once: don't loop
      try { sessionStorage.setItem(UPD, String(online)); } catch (e) {}
      UI.busy('Mise à jour de l\'appli…'); return forceUpdate();
    }
    if (manual) { UI.busy('Rechargement de l\'appli…'); forceUpdate(); }
  }
  async function start() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    if (location.protocol !== 'file:') { checkUpdate(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); }); }
    await Store.load();
    // Invitation link sent by the responsable: …#rejoindre=CODE
    const join = (location.hash.match(/^#rejoindre=([A-Za-z0-9]+)/) || [])[1];
    if (join) { Auth.setInvite(join); history.replaceState(null, '', location.pathname + location.search); }
    refreshChrome();
    await Auth.gate({ joined: !!join });
    try { await Board.preloadBackgrounds(Store.state.schemas); } catch (e) {}
    window.addEventListener('hashchange', route);
    route();
    Sync.start();
    // After the first exchange with the server: categories U6 … Vétérans for the new season
    Promise.resolve(Sync.run()).catch(() => {}).then(() => {
      let redraw = People.autoCategories();
      // once, on a responsable's device: imported matches go to team A / B from the District team number
      const c = Store.state.club;
      if (Auth.isAdmin() && !c.matchTeamsV1) { if (Importer.reassignImported()) redraw = true; c.matchTeamsV1 = 1; Store.save(); }
      if (redraw) route(true);
    });
    Messages.start();
  }
  return { start, route, refreshChrome, checkUpdate };
})();
App.start();
