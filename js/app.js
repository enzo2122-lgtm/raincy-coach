/* App shell: navigation, routing, service worker. */
const App = (() => {
  const NAV = [
    ['', 'Accueil', 'home'], ['equipes', 'Équipes', 'team'], ['schemas', 'Schémas', 'board'],
    ['entrainements', 'Entraînements', 'training', 'Séances'], ['matchs', 'Matchs', 'match'], ['stats', 'Stats', 'stats'], ['reglages', 'Réglages', 'settings'],
  ];
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
    document.getElementById('nav').innerHTML = NAV.map(([h, l, ic, short]) =>
      `<a href="#/${h}" class="${h === active ? 'on' : ''}" ${h === active ? 'aria-current="page"' : ''} aria-label="${l}">${I[ic]}<span class="lg">${l}</span><span class="sh">${short || l}</span></a>`).join('');
  }
  function route() {
    const [, name = '', id] = (location.hash || '#/').split('/');
    const root = view();
    root.onclick = root.oninput = root.onchange = null;
    Editor.close();
    const full = name === 'schema';
    document.body.classList.toggle('editing', full);
    const navKey = { equipe: 'equipes', joueurs: 'equipes', dirigeants: 'equipes', schema: 'schemas', bibliotheque: 'schemas', entrainement: 'entrainements', match: 'matchs' }[name] || name;
    renderNav(navKey);
    if (full) {
      const sc = Store.get('schemas', id);
      if (!sc) { location.hash = '#/schemas'; return; }
      Help.button(); return Editor.open(root, sc);
    }
    const fn = { '': Views.home, equipes: Views.teams, equipe: Views.team, schemas: Views.schemas, entrainements: Views.trainings, entrainement: Views.training,
      matchs: Views.matches, match: Views.match, stats: Views.stats, reglages: Views.settings,
      bibliotheque: r => Library.page(r), joueurs: r => People.listPage(r, 'player'), dirigeants: r => People.listPage(r, 'staff') }[name] || Views.home;
    fn(root, id);
    root.scrollTop = 0; window.scrollTo(0, 0);
    Help.button();
  }
  async function start() {
    await Store.load();
    refreshChrome();
    await Auth.gate();
    try { await Board.preloadBackgrounds(Store.state.schemas); } catch (e) {}
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  return { start, route, refreshChrome };
})();
App.start();
