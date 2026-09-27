/* App shell: navigation, routing, service worker. */
const App = (() => {
  // [hash, label, icon, short label for phones]; on phones the first five stay in the tab bar, the others go in « Plus »
  const NAV = [
    ['', 'Accueil', 'home'], ['planning', 'Planning', 'calendar'], ['entrainements', 'Entraînements', 'training', 'Séances'], ['matchs', 'Matchs', 'match'], ['messages', 'Messages', 'chat'],
    ['equipes', 'Équipes', 'team'], ['schemas', 'Schémas', 'board'], ['bibliotheque', 'Bibliothèque', 'video'], ['stats', 'Stats', 'stats'], ['reglages', 'Réglages', 'settings'],
  ];
  const PHONE_MAIN = 5;
  const view = () => document.getElementById('view');

  function refreshChrome() {
    const c = Store.state.club;
    document.documentElement.style.setProperty('--accent', UI.accentFor(c.homeBib));
    document.getElementById('clubName').textContent = c.name;
    const u = Auth.current(), ru = document.getElementById('railUser');
    ru.innerHTML = u ? `<span class="avatar" aria-hidden="true">${UI.esc(((u.firstName || '')[0] || '') + ((u.lastName || '')[0] || ''))}</span><span class="ru-name">${UI.esc(u.firstName || u.lastName)}</span><button class="ru-out" id="logoutBtn">Sortir</button>` : '';
    const lo = document.getElementById('logoutBtn'); if (lo) lo.onclick = () => Auth.logout();
    document.title = c.name + ' · Coach';
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
  function route() {
    const [, name = '', id] = (location.hash || '#/').split('/');
    const root = view();
    root.onclick = root.oninput = root.onchange = null;
    Editor.close();
    if (name !== 'messages') Messages.leave();
    if (name === 'connexion') { history.replaceState(null, '', '#/'); route(); return Auth.connectServer(); }
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
      planning: r => Planning.page(r), messages: (r, x) => Messages.page(r, x),
      bibliotheque: r => Library.page(r), joueurs: r => People.listPage(r, 'player'), dirigeants: r => People.listPage(r, 'staff') }[name] || Views.home;
    fn(root, id);
    root.scrollTop = 0; window.scrollTo(0, 0);
    Help.button();
  }
  /* Updates: version.json on the site says which build is online. When it is newer than this one,
     the app empties its offline copy and reloads (an iPhone can keep an old copy open for days). */
  const BUILD = 20, UPD = 'raincy-update-tried';
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
    Messages.start();
  }
  return { start, route, refreshChrome, checkUpdate };
})();
App.start();
