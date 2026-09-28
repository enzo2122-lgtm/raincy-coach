/* Exos: the exercise library of the club, and a session built on demand.
   Every exercise the coaches wrote in a session (with its diagram) is found here, by theme and by category;
   a base of classic exercises fills the gaps from the first day. « Générer une séance »: a theme, a category, a length →
   warm-up, 2 or 3 exercises of the theme (from simple to game-like), a themed game, cool-down; the club's exercises first. */
const Exos = (() => {
  const { esc, $, $$, toast, modal } = UI;
  const S = () => Store.state;
  const THEMES = [['pressing', '🔥 Pressing / récupération'], ['conservation', '🔄 Conservation'], ['transitions', '⚡ Transitions'], ['finition', '🎯 Finition'],
    ['defense', '🛡️ Défense'], ['construction', '🧱 Construction / relance'], ['technique', '⚽ Technique'], ['cpa', '🚩 Coups de pied arrêtés'], ['physique', '🏃 Physique / vitesse'],
    ['echauffement', '🔥 Échauffement'], ['jeu', '🏟️ Jeu / match à thème'], ['calme', '🧘 Retour au calme']];
  const KEYS = { pressing: /press|récup|contre-press|harc|déclench/i, conservation: /conserv|rondo|possess|toro|garder le ballon/i, transitions: /transit|contre-attaque|perte.*balle|récupération.*attaque|attaque rapide/i,
    finition: /finit|frapp|\btirs?\b|\bcentres?\b|devant le but|conclu/i, defense: /défen|duel|marquage|bloc|couverture|coulisse/i, construction: /construct|relance|sortie de balle|jeu court|premi[eè]re relance/i,
    technique: /techni|contrôle|passe|conduite|dribble|jongl|coordination|motricit/i, cpa: /cpa|corner|coup franc|coup-franc|penalty|touche longue|arrêté/i,
    physique: /physi|vitesse|sprint|endurance|puissance|fractionn|intermittent|explos|athlét/i, echauffement: /échauff|activation|mobilit|gamme/i,
    jeu: /match|jeu réduit|jeu à thème|opposition|\d ?c ?\d|contre \d/i, calme: /retour au calme|étirement|récupération active/i };
  // age groups: the format of the team (5, 8 or 11)
  const fmtOf = teamId => ((Store.get('teams', teamId) || {}).format) || '11';
  // the classic base: [theme, title, minutes, organisation, consignes, matériel, formats]
  const BASE = [
    ['echauffement', 'Échauffement avec ballon par 2', 12, 'Par 2, 15 m d\'écart. Passes, contrôles orientés, puis déplacements.', 'Contrôle orienté du bon pied\nRegarder avant de recevoir\nMonter progressivement l\'intensité', 'Ballons, plots', '5,8,11'],
    ['echauffement', 'Activation : gammes et coordination', 10, 'Couloir de 20 m, échelle de rythme et petites haies.', 'Appuis rapides\nGainage du buste\nAccélération en sortie', 'Échelle, haies, plots', '8,11'],
    ['echauffement', 'Le béret / jeu de réaction', 10, 'Deux équipes face à face, un ballon au centre. Le coach appelle un numéro.', 'Réagir vite\nProtéger le ballon\nRevenir en défense', 'Ballons, plots', '5,8'],
    ['conservation', 'Rondo 5 contre 2', 12, 'Carré de 12 × 12 m. 5 joueurs autour, 2 au milieu. Le défenseur qui récupère sort celui qui a perdu.', 'Deux touches maximum\nOffrir des angles de passe\nPasse à l\'opposé quand c\'est fermé', 'Ballons, chasubles, plots', '5,8,11'],
    ['conservation', 'Conservation 4 contre 4 + 2 jokers', 15, 'Carré de 25 × 25 m. Les jokers jouent avec l\'équipe qui a le ballon.', 'Se démarquer dans les intervalles\nJouer vite\nChanger de côté', 'Chasubles 3 couleurs', '8,11'],
    ['conservation', 'Toro 3 contre 1 en triangle', 10, 'Triangles de 8 m, un défenseur par triangle.', 'Soutien toujours proche\nContrôle orienté vers le partenaire libre', 'Ballons, plots', '5,8'],
    ['pressing', 'Pressing 3 contre 2 : récupérer vite', 12, 'Zone de 20 × 15 m. 3 attaquent en conservation, 2 pressent puis 1 renfort entre.', 'Presser en triangle\nCouper la passe vers l\'axe\nRécupérer en moins de 6 secondes', 'Chasubles, plots', '8,11'],
    ['pressing', 'Pressing sur la relance adverse', 20, 'Demi-terrain. L\'adversaire relance de son gardien, nous pressons sur un signal (passe au latéral).', 'Signal : passe vers le côté\nFermer l\'intérieur\nLe bloc monte ensemble', 'Chasubles, ballons, 2 buts', '8,11'],
    ['pressing', 'Jeu réduit 5 contre 5 : contre-pressing 5 secondes', 15, 'Terrain de 35 × 25 m, 2 buts. Un point en plus si on récupère dans les 5 secondes après la perte.', 'Réagir tout de suite à la perte\nLe plus proche presse, les autres ferment\nGagner le duel', 'Chasubles, 2 buts', '8,11'],
    ['transitions', 'Transition 3 contre 2 puis 2 contre 1 retour', 15, 'Longueur de 40 m. Attaque à 3 contre 2, puis les 2 défenseurs repartent en 2 contre 1.', 'Attaquer vite l\'espace\nFixer avant de passer\nRepli immédiat', 'Ballons, 2 buts', '8,11'],
    ['transitions', 'Récupérer et marquer en 8 secondes', 15, 'Demi-terrain, 6 contre 6 + gardiens. Après la récupération, 8 secondes pour marquer.', 'Première passe vers l\'avant\n3 joueurs partent\nFinir l\'action', 'Chasubles, buts, chrono', '8,11'],
    ['finition', 'Frappes après combinaison', 15, 'Deux colonnes à 25 m du but. Une-deux avec le pivot puis frappe.', 'Frappe cadrée\nSurface de pied adaptée\nSuivre sa frappe', 'Ballons, but, plots', '5,8,11'],
    ['finition', 'Centres et reprises', 15, 'Couloir latéral + 2 attaquants dans la surface (premier et second poteau).', 'Centre en retrait ou tendu\nAttaquer le premier poteau\nDécaler les courses', 'Ballons, but, plots', '8,11'],
    ['finition', 'Duels 1 contre 1 face au but', 12, 'Deux colonnes, départ côte à côte à 25 m. Le coach lance le ballon.', 'Protéger le ballon\nFrapper vite\nDéfenseur : cadrer, orienter', 'Ballons, but', '5,8,11'],
    ['defense', 'Défense à 4 : coulisser et couvrir', 20, 'Ligne de 4 défenseurs contre 3 milieux qui font circuler sur la largeur.', 'Coulisser ensemble\nCouverture derrière celui qui sort\nParler', 'Plots, ballons', '11'],
    ['defense', 'Duels 1 contre 1 défensifs', 12, 'Couloir de 10 × 15 m, l\'attaquant doit franchir la ligne.', 'Distance d\'intervention\nSur les appuis, de profil\nPousser vers l\'extérieur', 'Plots, ballons', '5,8,11'],
    ['defense', 'Défendre les centres', 15, 'Centres des deux côtés, 3 défenseurs contre 3 attaquants dans la surface.', 'Voir le ballon et l\'adversaire\nAttaquer le ballon\nDégager loin et large', 'Ballons, but', '8,11'],
    ['construction', 'Sortie de balle depuis le gardien', 20, 'Tiers défensif : gardien + 4 défenseurs + 2 milieux contre 4 presseurs.', 'Écarter les défenseurs centraux\nUn milieu entre les lignes\nSi c\'est fermé : jeu long ciblé', 'Chasubles, but, mini-buts', '8,11'],
    ['construction', 'Jeu en triangle et troisième homme', 15, 'Losanges de 15 m, circulation à une ou deux touches.', 'Remiser pour le troisième\nFaux appel avant de recevoir', 'Ballons, plots', '8,11'],
    ['technique', 'Conduite de balle et dribbles', 12, 'Slalom entre plots puis dribble face à un défenseur passif.', 'Toucher le ballon souvent\nChangement de rythme\nTête levée', 'Plots, ballons', '5,8'],
    ['technique', 'Passes et contrôles en carré', 12, 'Carré de 10 m, un joueur par plot, passe et suit.', 'Contrôle orienté\nPasse au sol, appuyée\nAnnoncer', 'Ballons, plots', '5,8,11'],
    ['technique', 'Jonglerie et coordination', 10, 'Chacun son ballon, défis de jonglerie.', 'Pied fort puis pied faible\nCuisse, tête\nSe fixer un record', 'Ballons', '5,8'],
    ['cpa', 'Corners offensifs', 12, 'Corner des deux côtés, 5 attaquants dans la surface contre défense et gardien.', 'Courses croisées\nUn joueur sur le gardien\nAttaquer le ballon', 'Ballons, but', '8,11'],
    ['cpa', 'Corners défensifs : placement', 10, 'Placement en zone + 2 joueurs au marquage.', 'Chacun connaît sa zone\nSortir ensemble après le dégagement', 'Ballons, but', '8,11'],
    ['cpa', 'Coups francs et penalties', 10, 'Tireurs désignés, coups francs à 20-25 m et penalties.', 'Routine avant la frappe\nChoisir son côté', 'Ballons, but, mur', '8,11'],
    ['physique', 'Vitesse : départs et sprints courts', 10, 'Sprints de 10 à 20 m, départs variés (assis, dos, au signal).', 'Récupération complète entre les sprints\nPremiers appuis rapides', 'Plots', '8,11'],
    ['physique', 'Intermittent 15-15 avec ballon', 12, '15 s de course rapide balle au pied, 15 s de marche, 2 × 6 min.', 'Tenir le rythme\nRespirer', 'Ballons, plots', '11'],
    ['physique', 'Jeu réduit 4 contre 4 intense', 16, 'Terrain de 30 × 20 m, 4 × 3 min, 1 min de récupération.', 'Intensité maximale\nPresser à la perte\nEncourager', 'Chasubles, 2 buts', '8,11'],
    ['jeu', 'Match à thème', 20, 'Grand terrain, consigne liée au thème de la séance (ex : but valable après 5 passes, pressing sur signal).', 'Appliquer le thème\nLe coach arrête pour corriger', 'Chasubles, buts', '5,8,11'],
    ['jeu', 'Jeu réduit 6 contre 6 avec zones', 20, 'Terrain de 50 × 35 m découpé en 3 zones, contraintes par zone.', 'Occuper la largeur\nProgresser zone par zone', 'Chasubles, buts, plots', '8,11'],
    ['jeu', 'Petit match 3 contre 3', 15, 'Terrain de 20 × 15 m, mini-buts, pas de gardien.', 'Chacun touche beaucoup de ballons\nAttaquer, défendre ensemble', 'Mini-buts, chasubles', '5,8'],
    ['calme', 'Retour au calme et étirements', 5, 'Footing léger puis étirements en cercle, retour sur la séance.', 'Respirer calmement\nUne phrase sur ce qu\'on retient', '', '5,8,11'],
  ].map(([theme, title, duration, org, consignes, materiel, formats], i) => ({ id: 'base' + i, theme, title, duration, org, consignes, materiel, formats: formats.split(','), base: true }));

  const themeOf = e => { if (e.theme) return [e.theme]; const t = `${e.title || ''} ${e.org || ''} ${e.consignes || ''}`; return Object.keys(KEYS).filter(k => KEYS[k].test(t)); };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // every exercise of the club (one per title, the one with a diagram first), then the base
  function all() {
    const seen = new Map();
    S().trainings.forEach(t => (t.exercises || []).forEach(e => {
      if (!e.title || !e.title.trim()) return;
      const k = norm(e.title), cur = seen.get(k);
      const item = { id: t.id + ':' + e.id, theme: e.theme || null, title: e.title, duration: +e.duration || 15, org: e.org || '', consignes: e.consignes || '', materiel: e.materiel || '', schemaId: e.schemaId || null,
        from: t, formats: [fmtOf(t.teamId)], club: true };
      if (!cur || (!cur.schemaId && item.schemaId) || (cur.from.date || '') < (t.date || '')) seen.set(k, cur ? Object.assign(item, { formats: [...new Set([...cur.formats, ...item.formats])] }) : item);
    }));
    const club = [...seen.values()];
    const clubTitles = new Set(club.map(e => norm(e.title)));
    return [...club, ...BASE.filter(b => !clubTitles.has(norm(b.title)))];
  }

  /* ---------- the library page ---------- */
  function page(root) {
    const st = S().ui.exos = S().ui.exos || { theme: '', fmt: '', q: '' };
    const list = all().filter(e => (!st.theme || themeOf(e).includes(st.theme)) && (!st.fmt || e.formats.includes(st.fmt)) && (!st.q || norm(`${e.title} ${e.org} ${e.consignes}`).includes(norm(st.q))));
    const clubN = all().filter(e => e.club).length;
    root.innerHTML = `<header class="page-head"><div><h1>📚 Exercices du club</h1><p class="sub">${clubN} exercice${clubN > 1 ? 's' : ''} des coachs du club + ${BASE.length} exercices de base</p></div>
      <div class="head-actions"><a class="btn" href="#/entrainements">${I.back}<span>Séances</span></a><button class="btn primary" data-gen>✨<span>Générer une séance</span></button></div></header>
      <input class="hl-q" id="exQ" placeholder="Rechercher (ex : rondo, centre, pressing)" value="${esc(st.q)}" autocomplete="off">
      <div class="chips ex-themes"><button class="chip ${!st.theme ? 'on' : ''}" data-th="">Tous</button>${THEMES.map(([k, l]) => `<button class="chip ${st.theme === k ? 'on' : ''}" data-th="${k}">${l}</button>`).join('')}</div>
      <div class="chips"><button class="chip ${!st.fmt ? 'on' : ''}" data-fm="">Toutes catégories</button>${[['5', 'Foot à 5 (U6-U9)'], ['8', 'Foot à 8 (U10-U13)'], ['11', 'Foot à 11 (U14+)']].map(([k, l]) => `<button class="chip ${st.fmt === k ? 'on' : ''}" data-fm="${k}">${l}</button>`).join('')}</div>
      <p class="muted small">${list.length} exercice${list.length > 1 ? 's' : ''}</p>
      <div class="ex-lib">${list.slice(0, 80).map(e => { const sc = e.schemaId && Store.get('schemas', e.schemaId), th = themeOf(e);
        return `<article class="card ex-item"><div class="ex-item-head">${sc ? `<img alt="" src="${UI.thumb(sc, 240, 156)}">` : `<span class="ex-noimg">${(THEMES.find(t => t[0] === th[0]) || ['', '⚽'])[1].split(' ')[0]}</span>`}
          <div><b>${esc(e.title)}</b><span class="muted small">${e.duration} min · ${th.map(k => (THEMES.find(t => t[0] === k) || ['', k])[1].replace(/^\S+\s/, '')).join(', ') || 'Divers'}${e.club ? ` · ${esc((Store.get('teams', e.from.teamId) || {}).name || 'club')}` : ' · base'}</span></div></div>
          ${e.org ? `<p class="small">${esc(e.org)}</p>` : ''}${e.consignes ? `<ul class="small ex-cons">${e.consignes.split('\n').filter(Boolean).slice(0, 4).map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
          <div class="chips"><button class="btn soft" data-addex="${esc(e.id)}">${I.plus}<span>Ajouter à une séance</span></button>${e.club ? `<a class="btn soft" href="#/entrainement/${e.from.id}">Voir la séance</a>` : ''}</div></article>`; }).join('') || '<p class="muted">Aucun exercice ne correspond.</p>'}</div>`;
    const redraw = () => page(root);
    $('#exQ', root).oninput = e => { st.q = e.target.value; clearTimeout(page.t); page.t = setTimeout(() => { const pos = e.target.selectionStart; redraw(); const q = $('#exQ', root); q.focus(); q.setSelectionRange(pos, pos); }, 300); };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.th !== undefined) { st.theme = b.dataset.th; Store.persistNow(); return redraw(); }
      if (b.dataset.fm !== undefined) { st.fmt = b.dataset.fm; Store.persistNow(); return redraw(); }
      if (b.hasAttribute('data-gen')) return generator();
      if (b.dataset.addex) return addTo(all().find(x => x.id === b.dataset.addex));
    };
  }
  const copyEx = e => ({ id: Store.uid(), theme: e.theme || themeOf(e)[0] || null, title: e.title, duration: e.duration, org: e.org || '', consignes: e.consignes || '', materiel: e.materiel || '', schemaId: e.schemaId || null });
  function addTo(ex) {
    if (!ex) return;
    const list = S().trainings.filter(t => !t.model && Auth.sees(t.teamId) && t.date >= UI.today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
    const close = modal({ title: `Ajouter « ${ex.title} »`, noFocus: true, body: list.length ? `<div class="list">${list.map(t => `<button class="list-item hl-pickrow" data-tr="${t.id}"><span class="li-main"><b>${esc(t.title || 'Entraînement')}</b><span class="muted">${esc(UI.fmtDate(t.date))} · ${esc((Store.get('teams', t.teamId) || {}).name || '')}</span></span></button>`).join('')}</div>`
      : '<p class="muted">Pas de séance à venir : crée d\'abord un entraînement, ou « Générer une séance ».</p>',
      onOpen: r => $$('[data-tr]', r).forEach(b => b.onclick = () => { const t = Store.get('trainings', b.dataset.tr); t.exercises.push(copyEx(ex)); Store.upsert('trainings', t); close(); toast('Exercice ajouté'); location.hash = '#/entrainement/' + t.id; }) });
  }

  /* ---------- the generator ---------- */
  function generator(pre = {}) {
    const teams = Auth.teams(), g = Object.assign({ theme: 'pressing', teamId: S().ui.teamId || (teams[0] || {}).id, minutes: 75, date: UI.today() }, S().ui.exGen || {}, pre);
    const body = () => `<div class="lbl">Thème</div><div class="chips">${THEMES.filter(t => !['echauffement', 'calme', 'jeu'].includes(t[0])).map(([k, l]) => `<button class="chip ${g.theme === k ? 'on' : ''}" data-gth="${k}">${l}</button>`).join('')}</div>
      <div class="row2"><label class="fld"><span>Catégorie</span><select id="gTeam">${teams.map(t => `<option value="${t.id}" ${t.id === g.teamId ? 'selected' : ''}>${esc(Store.teamLabel(t))}</option>`).join('')}</select></label>
        <label class="fld"><span>Durée</span><select id="gMin">${[45, 60, 75, 90, 105].map(n => `<option ${n === +g.minutes ? 'selected' : ''} value="${n}">${n} min</option>`).join('')}</select></label>
        <label class="fld"><span>Date</span><input type="date" id="gDate" value="${esc(g.date)}"></label></div>
      <p class="muted small">L'appli prend d'abord les exercices des coachs du club, puis ceux de la base. Tu pourras tout changer ensuite.</p>`;
    modal({ title: '✨ Générer une séance', noFocus: true, body: `<div id="genBody">${body()}</div>`,
      onOpen: r => { r.querySelector('#genBody').onclick = e => { const b = e.target.closest('[data-gth]'); if (!b) return; keep(r); g.theme = b.dataset.gth; r.querySelector('#genBody').innerHTML = body(); }; },
      actions: [{ label: 'Annuler' }, { label: 'Générer', kind: 'primary', onClick: (c, r) => { keep(r); S().ui.exGen = { theme: g.theme, minutes: g.minutes }; Store.persistNow(); setTimeout(() => build(g), 60); } }] });
    function keep(r) { g.teamId = $('#gTeam', r).value; g.minutes = +$('#gMin', r).value; g.date = $('#gDate', r).value || UI.today(); }
  }
  function build(g) {
    const fmt = fmtOf(g.teamId), pool = all().filter(e => e.formats.includes(fmt) || e.formats.length === 0);
    const pick = (theme, used, n = 1) => {
      const c = pool.filter(e => themeOf(e).includes(theme) && !used.has(norm(e.title)));
      // the club's exercises first (with a diagram first), then the base
      c.sort((a, b) => (b.club ? 1 : 0) - (a.club ? 1 : 0) || (b.schemaId ? 1 : 0) - (a.schemaId ? 1 : 0) || Math.random() - .5);
      const out = c.slice(0, n); out.forEach(e => used.add(norm(e.title))); return out;
    };
    const used = new Set(), total = g.minutes, warm = total >= 75 ? 15 : 10, calm = 5, game = total >= 75 ? 20 : 15, core = total - warm - calm - game;
    const nCore = core >= 40 ? 3 : core >= 25 ? 2 : 1;
    // the core time shared in blocks of 5 min, the last exercise takes what is left (the total is exactly the chosen length)
    const coreEx = pick(g.theme, used, nCore);
    // too few exercises of the theme for this category: a close theme completes (never one exercise of 45 min)
    const NEAR = { defense: ['pressing', 'physique'], pressing: ['transitions', 'defense'], transitions: ['pressing', 'finition'], finition: ['technique', 'transitions'],
      conservation: ['construction', 'technique'], construction: ['conservation', 'technique'], technique: ['conservation', 'finition'], cpa: ['finition', 'defense'], physique: ['pressing', 'transitions'] };
    for (const alt of [...(NEAR[g.theme] || []), 'conservation', 'technique']) { if (coreEx.length >= nCore) break; coreEx.push(...pick(alt, used, nCore - coreEx.length)); }
    const each = Math.max(5, Math.floor(core / Math.max(1, coreEx.length) / 5) * 5);
    const plan = [...pick('echauffement', used).map(e => [e, warm]), ...coreEx.map((e, i) => [e, i === coreEx.length - 1 ? core - each * (coreEx.length - 1) : each]),
      ...pick('jeu', used).map(e => [e, game]), ...pick('calme', used).map(e => [e, calm])];
    // not enough exercises of the theme: another close theme completes
    const have = plan.reduce((a, [, d]) => a + d, 0); if (have < total - 10) { const extra = pick('conservation', used)[0] || pick('technique', used)[0]; if (extra) plan.splice(1 + nCore, 0, [extra, total - have]); }
    const thLabel = (THEMES.find(t => t[0] === g.theme) || ['', g.theme])[1].replace(/^\S+\s/, '');
    const tr = Store.upsert('trainings', { id: Store.uid(), title: thLabel, date: g.date, time: '', teamId: g.teamId, goal: `Thème : ${thLabel}. Séance générée : échauffement, ${nCore} exercice${nCore > 1 ? 's' : ''} du thème, jeu à thème, retour au calme.`,
      exercises: plan.map(([e, d]) => Object.assign(copyEx(e), { duration: d })), presents: [] });
    toast(`Séance « ${thLabel} » créée : ${plan.length} exercices, ${plan.reduce((a, [, d]) => a + d, 0)} min`);
    location.hash = '#/entrainement/' + tr.id;
  }

  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-exgen]'); if (b) generator(); });
  return { page, generator, all, THEMES };
})();
