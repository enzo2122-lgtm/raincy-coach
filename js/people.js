/* People: club-wide players and staff (dirigeants), their contact details and their categories. */
const People = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const POS = [['', '–'], ['GB', 'Gardien'], ['DEF', 'Défenseur'], ['MIL', 'Milieu'], ['ATT', 'Attaquant']];
  const SUBCATS = ['Senior', 'Senior U20', 'Vétéran', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19'];
  const ROLES = ['Éducateur', 'Éducateur adjoint', 'Responsable de catégorie', 'Dirigeant', 'Accompagnateur', 'Entraîneur des gardiens', 'Arbitre bénévole', 'Intendant', 'Président', 'Vice-président', 'Secrétaire', 'Trésorier', 'Autre'];
  const RELS = ['Mère', 'Père', 'Tuteur', 'Autre'];
  // Which category (team) gathers each licence sub-category
  // Footclubs sub-category → category of the club (no U18 / U19 / U20 at the club: those players are in Seniors)
  const TEAM_OF_SUB = { 'Vétéran': 'Vétérans', 'Senior': 'Seniors', 'Senior U20': 'Seniors', U19: 'Seniors', U18: 'Seniors', U17: 'U17', U16: 'U16', U15: 'U15', U14: 'U14', U13: 'U13', U12: 'U12', U11: 'U11', U10: 'U10', U9: 'U9', U8: 'U8', U7: 'U7', U6: 'U6' };
  const FORMAT_OF_TEAM = { U7: '5', U9: '5', U11: '8', U13: '8' };

  const name = Store.fullName;
  const age = iso => { if (!iso) return ''; const b = new Date(iso + 'T12:00'), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  const fmtBirth = iso => iso ? iso.split('-').reverse().join('/') : '';
  const telHref = n => 'tel:' + String(n).replace(/[^\d+]/g, '');
  const tel = (n, label) => n ? `<a class="tel" href="${telHref(n)}">${I.phone}<span>${label ? esc(label) + ' : ' : ''}${esc(n)}</span></a>` : '';
  const teamNames = ids => (ids || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ');
  const phonesOf = p => [p.phone, ...(p.parents || []).map(x => x.phone)].filter(Boolean);
  // A dirigeant who is also a licensed player: same nom and same first prénom (without accents or capitals)
  const nk = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const firstOf = s => nk(String(s || '').replace(/\(.*\)/, '')).split(' ')[0];
  // « Giova (Christian) » also matches the licence « Christian »
  const firstsOf = s => [firstOf(s), ...(String(s || '').match(/\(([^)]*)\)/g) || []).map(m => firstOf(m.slice(1, -1)))].filter(Boolean);
  const playerLike = p => S().players.find(x => nk(x.lastName) === nk(p.lastName) && firstsOf(p.firstName).includes(firstOf(x.firstName)));
  const linkPlayer = p => { if (!p.playerId || !Store.get('players', p.playerId)) { const x = playerLike(p); if (x) p.playerId = x.id; } };

  /* ---------- rows ---------- */
  function playerRow(p, teamId, groups) {
    const sub = [p.subcat, p.birth ? `${age(p.birth)} ans` : '', teamId ? '' : teamNames(p.teamIds), S().staff.some(x => x.playerId === p.id) ? 'aussi dirigeant' : ''].filter(Boolean).join(' · ');
    // Groups A / B of the category: one touch puts the player in A or in B (touch his group again: no group)
    const ab = groups ? `<span class="ab" role="group" aria-label="Groupe de ${esc(name(p))}">${groups.subs.map(g => `<button type="button" class="ab-b ${(p.teamIds || []).includes(g.id) ? 'on' : ''}" data-ab="${g.id}" data-p="${p.id}" aria-label="Mettre ${esc(name(p))} en ${esc(g.name)}">${esc(g.name.trim().slice(-1))}</button>`).join('')}</span>` : '';
    return `<div class="person">
      <button class="person-main" data-person="${p.id}" data-kind="player">
        <span class="pnum">${esc(p.number || '')}</span>
        <span class="pmain"><b>${esc(name(p))}</b><span class="muted">${esc(sub) || '&nbsp;'}</span></span>
        ${phonesOf(p).length ? `<span class="has-tel" title="Téléphone renseigné">${I.phone}</span>` : ''}
      </button>${ab}
      ${teamId ? `<button class="icon-btn" data-unlink="${p.id}" data-kind="player" aria-label="Retirer ${esc(name(p))} de la catégorie">${I.x}</button>` : ''}
    </div>`;
  }
  function staffRow(p, teamId) {
    return `<div class="person">
      <button class="person-main" data-person="${p.id}" data-kind="staff">
        <span class="pnum role">${I.whistle}</span>
        <span class="pmain"><b>${esc(name(p))}</b>${UI.motto(p)}<span class="muted">${esc(p.role || '')}${teamId ? '' : ' · ' + esc(teamNames(p.teamIds) || 'aucune catégorie')}${p.playerId && Store.get('players', p.playerId) ? ' · aussi joueur (' + esc(teamNames(Store.get('players', p.playerId).teamIds)) + ')' : ''}</span></span>
      </button>
      ${p.phone ? `<a class="icon-btn" href="${telHref(p.phone)}" aria-label="Appeler ${esc(name(p))}">${I.phone}</a>` : ''}
      ${teamId ? `<button class="icon-btn" data-unlink="${p.id}" data-kind="staff" aria-label="Retirer ${esc(name(p))} de la catégorie">${I.x}</button>` : ''}
    </div>`;
  }
  const teamChips = ids => `<div class="chips" id="pTeams">${Auth.teams().map(t => `<button type="button" class="chip ${(ids || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</button>`).join('') || '<p class="muted">Crée d\'abord une catégorie dans Équipes.</p>'}</div>`;
  const bindChips = r => $$('#pTeams .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
  // Chips only show the categories this dirigeant sees: the other categories of the person are kept as they were
  const pickedTeams = (r, before = []) => [...before.filter(id => !Auth.teams().some(t => t.id === id)), ...$$('#pTeams .chip.on', r).map(b => b.dataset.t)];
  // (a value that is not in the list, e.g. a role typed elsewhere, is kept as the first choice instead of being lost)
  const opt = (list, cur) => (cur && !list.some(v => (Array.isArray(v) ? v[0] : v) === cur) ? `<option selected>${esc(cur)}</option>` : '') + list.map(v => Array.isArray(v) ? `<option value="${esc(v[0])}" ${v[0] === cur ? 'selected' : ''}>${esc(v[1])}</option>` : `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');

  /* ---------- player sheet ---------- */
  function editPlayer(p, opts = {}) {
    const isNew = !p;
    p = p || { id: Store.uid(), lastName: '', firstName: '', birth: '', subcat: '', number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: opts.teamId ? [opts.teamId] : [] };
    const par = i => p.parents[i] || { name: '', rel: i ? 'Père' : 'Mère', phone: '' };
    const parentBlock = i => `<fieldset class="parent"><legend>Parent ${i + 1}</legend>
      <div class="row2"><label class="fld"><span>Nom et prénom</span><input id="par${i}n" value="${esc(par(i).name)}"></label>
      <label class="fld"><span>Lien</span><select id="par${i}r">${opt(RELS, par(i).rel)}</select></label></div>
      <label class="fld"><span>Téléphone</span><input id="par${i}t" type="tel" inputmode="tel" value="${esc(par(i).phone)}" placeholder="06 12 34 56 78"></label>
      ${par(i).phone ? tel(par(i).phone, 'Appeler') : ''}</fieldset>`;
    modal({
      title: isNew ? 'Nouveau joueur' : name(p),
      body: `<div class="row2"><label class="fld"><span>Nom</span><input id="pLast" value="${esc(p.lastName)}" autocapitalize="characters"></label>
        <label class="fld"><span>Prénom</span><input id="pFirst" value="${esc(p.firstName)}"></label></div>
        <div class="row3"><label class="fld"><span>Né(e) le</span><input id="pBirth" type="date" value="${esc(p.birth || '')}"></label>
        <label class="fld"><span>Sous-catégorie</span><select id="pSub"><option value="">–</option>${opt(SUBCATS, p.subcat)}</select></label>
        <label class="fld"><span>Numéro</span><input id="pNum" type="number" min="0" max="99" value="${esc(p.number)}"></label>
        <label class="fld"><span>Poste</span><select id="pPos">${opt(POS, p.pos || '')}</select></label></div>
        <div class="lbl">Catégories (plusieurs possibles)</div>${teamChips(p.teamIds)}
        <h3 class="sub-h">Contacts</h3>
        <div class="row2"><label class="fld"><span>Téléphone du joueur</span><input id="pTel" type="tel" inputmode="tel" value="${esc(p.phone || '')}"></label>
        <label class="fld"><span>E-mail</span><input id="pMail" type="email" inputmode="email" value="${esc(p.email || '')}"></label></div>
        ${p.phone ? tel(p.phone, 'Appeler') : ''}
        ${parentBlock(0)}${parentBlock(1)}
        <label class="fld"><span>Infos utiles (santé, allergies, transport…)</span><textarea id="pNotes" rows="3">${esc(p.notes || '')}</textarea></label>
        ${isNew ? '' : notesHistory(p)}`,
      onOpen: r => {
        bindChips(r);
        // A new date of birth selects the matching category (U6 … U17, Seniors, Vétérans)
        $('#pBirth', r).onchange = e => {
          const cat = catOf({ birth: e.target.value, subcat: $('#pSub', r).value }); if (!cat) return;
          const t = findCat(cat); if (!t) return;
          $$('#pTeams .chip', r).forEach(b => { const tm = Store.get('teams', b.dataset.t); if (tm && isAgeTeam(tm)) b.classList.toggle('on', b.dataset.t === t.id); });
        };
      },
      actions: [
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(() => confirmBox(`Supprimer ${name(p)} de tout le club ?`).then(ok => { if (ok) { Store.remove('players', p.id); toast('Joueur supprimé'); opts.onSave && opts.onSave(); } }), 60); } }]),
        { label: 'Annuler' },
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const v = id => $('#' + id, r).value.trim();
          if (!v('pLast') && !v('pFirst')) { toast('Écris au moins le nom ou le prénom', 'err'); return false; }
          Object.assign(p, { lastName: v('pLast').toUpperCase(), firstName: v('pFirst'), birth: v('pBirth'), subcat: v('pSub'), number: v('pNum') === '' ? '' : +v('pNum'), pos: v('pPos'), phone: v('pTel'), email: v('pMail'), notes: $('#pNotes', r).value, teamIds: pickedTeams(r, p.teamIds || []),
            parents: [0, 1].map(i => ({ name: v(`par${i}n`), rel: v(`par${i}r`), phone: v(`par${i}t`) })).filter(x => x.name || x.phone) });
          Store.upsert('players', p); toast('Enregistré'); opts.onSave && opts.onSave(p);
        } },
      ],
    });
  }

  function notesHistory(p) {
    const h = Ratings.history(p.id); if (!h.length) return '';
    const am = Ratings.average(p.id, 'match'), at = Ratings.average(p.id, 'training');
    return `<h3 class="sub-h">⭐ Notes des dirigeants</h3>
      <p class="muted">${am ? 'Matchs : ' + Ratings.fr(am) + '/5' : ''}${am && at ? ' · ' : ''}${at ? 'Entraînements : ' + Ratings.fr(at) + '/5' : ''}</p>
      <ul class="notes-list">${h.slice(0, 12).map(x => `<li><span class="stars-ro" aria-label="${x.v} sur 5">${'★'.repeat(x.v)}<i>${'★'.repeat(5 - x.v)}</i></span>
        <span><b>${x.kind === 'match' ? 'Match contre ' + esc(x.ev.opponent || '') : esc(x.ev.title || 'Entraînement')}</b> · ${esc(UI.fmtDate(x.date))}${x.by ? ' · ' + esc(Store.fullName(x.by)) : ''}${x.c ? `<br><span class="muted">« ${esc(x.c)} »</span>` : ''}</span></li>`).join('')}</ul>`;
  }

  /* ---------- staff sheet ---------- */
  function editStaff(p, opts = {}) {
    const isNew = !p;
    p = p || { id: Store.uid(), lastName: '', firstName: '', role: 'Éducateur', phone: '', email: '', notes: '', teamIds: opts.teamId ? [opts.teamId] : [] };
    modal({
      title: isNew ? 'Nouveau dirigeant' : name(p),
      body: `<div class="row2"><label class="fld"><span>Nom</span><input id="sLast" value="${esc(p.lastName)}" autocapitalize="characters"></label>
        <label class="fld"><span>Prénom</span><input id="sFirst" value="${esc(p.firstName)}"></label></div>
        <div class="row2"><label class="fld"><span>Rôle</span><select id="sRole">${opt(ROLES, p.role)}</select></label>
        <label class="fld"><span>Club de cœur (son blason s'affiche dans les messages)</span><select id="sClub">${Clubs.options(p.club)}</select></label></div>
        <label class="fld"><span>Petite phrase (drôle ou philosophique, à côté de son nom)</span><input id="sMotto" value="${esc(p.motto || '')}" maxlength="${UI.MOTTO_MAX}"></label>
        <div class="lbl">Catégories (plusieurs possibles)</div>${Auth.isAdmin() || isNew ? teamChips(p.teamIds) : `<p class="tip">🔒 ${esc(teamNames(p.teamIds) || 'Aucune catégorie')} · seul un responsable peut changer les catégories d'un dirigeant.</p>`}
        <div class="row2"><label class="fld"><span>Téléphone</span><input id="sTel" type="tel" inputmode="tel" value="${esc(p.phone || '')}"></label>
        <label class="fld"><span>E-mail</span><input id="sMail" type="email" inputmode="email" value="${esc(p.email || '')}"></label></div>
        ${p.phone ? tel(p.phone, 'Appeler') : ''}
        ${S().players.length ? (() => { const sel = p.playerId || (playerLike(p) || {}).id || ''; return `<label class="fld"><span>Aussi joueur licencié ?</span><select id="sPlayer"><option value="">Non</option>
          ${S().players.slice().sort(Store.byName).map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(name(x))}${x.teamIds && x.teamIds.length ? ' · ' + esc(teamNames(x.teamIds)) : ''}</option>`).join('')}</select></label>`; })() : ''}
        <label class="fld"><span>Infos (diplôme, licence, disponibilités…)</span><textarea id="sNotes" rows="3">${esc(p.notes || '')}</textarea></label>`,
      onOpen: bindChips,
      actions: [
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(() => confirmBox(`Supprimer ${name(p)} ?`).then(ok => { if (ok) { Store.remove('staff', p.id); Auth.forget(p.id); toast('Dirigeant supprimé'); opts.onSave && opts.onSave(); } }), 60); } }]),
        { label: 'Annuler' },
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const v = id => $('#' + id, r).value.trim();
          if (!v('sLast') && !v('sFirst')) { toast('Écris au moins le nom ou le prénom', 'err'); return false; }
          Object.assign(p, { lastName: v('sLast').toUpperCase(), firstName: v('sFirst'), role: v('sRole'), club: v('sClub'), motto: v('sMotto').replace(/\s+/g, ' '), phone: v('sTel'), email: v('sMail'), notes: $('#sNotes', r).value });
          if (Auth.isAdmin() || isNew) p.teamIds = pickedTeams(r, p.teamIds || []);
          const sp = $('#sPlayer', r); if (sp) { if (sp.value) p.playerId = sp.value; else delete p.playerId; }
          Store.upsert('staff', p); toast('Enregistré'); opts.onSave && opts.onSave(p);
        } },
      ],
    });
  }

  /* ---------- dropdowns ---------- */
  // Select listing people not yet in the team, grouped by their categories
  function addSelect(kind, teamId, label) {
    const list = (kind === 'player' ? S().players : S().staff).filter(p => Auth.seesPerson(p) && !(p.teamIds || []).includes(teamId)).sort(Store.byName);
    const groups = new Map();
    list.forEach(p => { const g = teamNames(p.teamIds) || 'Sans catégorie'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
    return `<select class="add-select" data-add="${kind}" aria-label="${esc(label)}"><option value="">${esc(label)}</option>
      ${[...groups].map(([g, ps]) => `<optgroup label="${esc(g)}">${ps.map(p => `<option value="${p.id}">${esc(name(p))}${kind === 'staff' && p.role ? ' · ' + esc(p.role) : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
  }
  // Staff picker for a training or a match: category staff first
  function staffPicker(teamId, chosen) {
    const all = S().staff.slice().sort(Store.byName), mine = all.filter(p => (p.teamIds || []).includes(teamId)), others = all.filter(p => !mine.includes(p));
    const chips = (chosen || []).map(id => Store.get('staff', id)).filter(Boolean)
      .map(p => `<span class="chip on staff-chip">${I.whistle}${esc(name(p))}<button class="x" data-unstaff="${p.id}" aria-label="Retirer ${esc(name(p))}">${I.x}</button></span>`).join('');
    const o = ps => ps.filter(p => !(chosen || []).includes(p.id)).map(p => `<option value="${p.id}">${esc(name(p))}${p.role ? ' · ' + esc(p.role) : ''}</option>`).join('');
    return `<div class="chips">${chips}</div>
      <select class="add-select" data-staffpick aria-label="Ajouter un encadrant"><option value="">Ajouter un encadrant…</option>
      ${mine.length ? `<optgroup label="De la catégorie">${o(mine)}</optgroup>` : ''}${others.length ? `<optgroup label="Autres dirigeants">${o(others)}</optgroup>` : ''}</select>
      ${!all.length ? '<p class="tip">Ajoute les dirigeants dans Équipes → Dirigeants.</p>' : ''}`;
  }

  /* ---------- team sections (inside a category page) ---------- */
  // A category (« U15 ») with its teams A and B, or one of these teams: the groups the players can be moved between
  function groupsOf(t) {
    const key = catKey(t.category || t.name), base = isSubTeam(t) ? findCat(t.category || '') : t;
    const subs = S().teams.filter(x => isSubTeam(x) && catKey(x.category) === key).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return subs.length >= 2 ? { base: base && !isSubTeam(base) ? base : null, subs } : null;
  }
  function moveGroup(p, target, g) {
    const had = (p.teamIds || []).includes(target);
    p.teamIds = (p.teamIds || []).filter(id => !g.subs.some(s => s.id === id));
    if (!had) { p.teamIds.push(target); if (g.base && !p.teamIds.includes(g.base.id)) p.teamIds.push(g.base.id); }
    Store.upsert('players', p);
    toast(had ? `${name(p)} n'est plus dans un groupe` : `${name(p)} → ${Store.get('teams', target).name}`);
  }
  function teamSections(t) {
    const ps = Store.playersOf(t.id), st = Store.staffOf(t.id), g = groupsOf(t);
    const count = g ? g.subs.map(s => `${esc(s.name)} : ${ps.filter(p => (p.teamIds || []).includes(s.id)).length}`).join(' · ') + (isSubTeam(t) ? '' : ` · sans groupe : ${ps.filter(p => !g.subs.some(s => (p.teamIds || []).includes(s.id))).length}`) : '';
    return `<section class="card">
        <div class="row-head"><h2>${I.team}Joueurs (${ps.length})</h2>
          <div class="chips"><button class="btn primary" data-newplayer>${I.plus}<span>Nouveau joueur</span></button></div></div>
        ${g ? `<p class="tip">Groupes : touche ${g.subs.map(s => `<b>${esc(s.name.trim().slice(-1))}</b>`).join(' ou ')} à côté d'un joueur pour le changer de groupe (touche encore : plus de groupe).<br>${count}</p>` : ''}
        ${addSelect('player', t.id, 'Ajouter un joueur d\'une autre catégorie…')}
        <div class="people">${ps.map(p => playerRow(p, t.id, g)).join('') || '<p class="muted">Aucun joueur dans cette catégorie.</p>'}</div>
      </section>
      <section class="card">
        <div class="row-head"><h2>${I.whistle}Encadrement (${st.length})</h2>
          <button class="btn" data-newstaff>${I.plus}<span>Nouveau dirigeant</span></button></div>
        ${Auth.isAdmin() ? addSelect('staff', t.id, 'Ajouter un dirigeant existant…') : ''}
        <div class="people">${st.map(p => staffRow(p, Auth.isAdmin() ? t.id : null)).join('') || '<p class="muted">Aucun dirigeant pour cette catégorie.</p>'}</div>
      </section>`;
  }
  function bindTeamSections(root, t, rerender) {
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.dataset.ab) { const g = groupsOf(t), p = Store.get('players', b.dataset.p); if (g && p) { moveGroup(p, b.dataset.ab, g); rerender(); } return; }
      if (b.hasAttribute('data-newplayer')) return editPlayer(null, { teamId: t.id, onSave: rerender });
      if (b.hasAttribute('data-newstaff')) return editStaff(null, { teamId: t.id, onSave: rerender });
      if (b.dataset.person) return (b.dataset.kind === 'player' ? editPlayer : editStaff)(Store.get(b.dataset.kind === 'player' ? 'players' : 'staff', b.dataset.person), { onSave: rerender });
      if (b.dataset.unlink) {
        const col = b.dataset.kind === 'player' ? 'players' : 'staff', p = Store.get(col, b.dataset.unlink);
        if (await confirmBox(`Retirer ${name(p)} de ${t.name} ? ${b.dataset.kind === 'player' ? 'Le joueur' : 'Le dirigeant'} reste dans le club.`, 'Retirer')) { p.teamIds = p.teamIds.filter(id => id !== t.id); Store.upsert(col, p); rerender(); }
      }
    });
    root.addEventListener('change', e => {
      const s = e.target.closest('[data-add]'); if (!s || !s.value) return;
      const col = s.dataset.add === 'player' ? 'players' : 'staff', p = Store.get(col, s.value);
      p.teamIds = [...new Set([...(p.teamIds || []), t.id])]; Store.upsert(col, p); toast(`${name(p)} ajouté à ${t.name}`); rerender();
    });
  }

  /* ---------- pages ---------- */
  function listPage(root, kind) {
    const isP = kind === 'player', ui = S().ui, key = isP ? 'plFilter' : 'stFilter';
    const filt = ui[key] || '', q = (ui[key + 'Q'] || '').toLowerCase();
    const all = (isP ? S().players : S().staff).filter(Auth.seesPerson).sort(Store.byName);
    const list = all.filter(p => (!filt || (filt === '-' ? !(p.teamIds || []).length : (p.teamIds || []).includes(filt))) && (!q || name(p).toLowerCase().includes(q)));
    root.innerHTML = `<header class="page-head"><div><h1>${isP ? 'Joueurs' : 'Dirigeants'}</h1><p class="sub">${list.length} sur ${all.length} · ${Auth.isAdmin() ? 'tout le club' : 'mes catégories'}</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>
      <button class="btn" data-act="paste">${I.paste}<span>Coller une liste</span></button>
      <button class="btn primary" data-act="new">${I.plus}<span>${isP ? 'Nouveau joueur' : 'Nouveau dirigeant'}</span></button></div></header>
      <div class="filters">
        <label class="search">${I.search}<input id="q" type="search" placeholder="Chercher un nom" value="${esc(ui[key + 'Q'] || '')}"></label>
        <select id="cat" aria-label="Catégorie"><option value="">${Auth.isAdmin() ? 'Toutes les catégories' : 'Mes catégories'}</option>${Auth.teams().map(t => `<option value="${t.id}" ${t.id === filt ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="-" ${filt === '-' ? 'selected' : ''}>Sans catégorie</option></select>
      </div>
      <div class="people big" id="plist">${list.map(p => isP ? playerRow(p) : staffRow(p)).join('') || '<p class="muted">Personne ici.</p>'}</div>`;
    const again = () => { const y = window.scrollY; listPage(root, kind); window.scrollTo(0, y); };
    // Search: only the list is redrawn, the search field keeps the keyboard (no jump on iPhone)
    $('#q', root).oninput = e => {
      ui[key + 'Q'] = e.target.value; const qq = e.target.value.toLowerCase(), f = ui[key] || '';
      const l = all.filter(p => (!f || (f === '-' ? !(p.teamIds || []).length : (p.teamIds || []).includes(f))) && (!qq || name(p).toLowerCase().includes(qq)));
      $('#plist', root).innerHTML = l.map(p => isP ? playerRow(p) : staffRow(p)).join('') || '<p class="muted">Personne ici.</p>';
      $('.page-head .sub', root).textContent = `${l.length} sur ${all.length} · ${Auth.isAdmin() ? 'tout le club' : 'mes catégories'}`;
    };
    $('#cat', root).onchange = e => { ui[key] = e.target.value; Store.save(); again(); };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'new') return (isP ? editPlayer : editStaff)(null, { teamId: filt && filt !== '-' ? filt : null, onSave: again });
      if (b.dataset.act === 'paste') return isP ? pasteList(again) : pasteStaff(again);
      if (b.dataset.person) (isP ? editPlayer : editStaff)(Store.get(isP ? 'players' : 'staff', b.dataset.person), { onSave: again });
    };
  }

  /* ---------- paste a list copied from Footclubs ---------- */
  function parseLines(txt) {
    const out = [];
    txt.split(/\r?\n/).forEach(line => {
      const d = line.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (!d) return;
      const before = line.slice(0, d.index).replace(/[\t|;]+/g, ' ').trim(), after = line.slice(d.index + d[0].length);
      const words = before.split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w));
      if (!words.length) return;
      const upper = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w)), rest = words.filter(w => !upper.includes(w));
      const subM = after.match(/Senior U20|Senior|V[ée]t[ée]ran|U\d{1,2}/i);
      let sub = subM ? subM[0] : '';
      if (/^v/i.test(sub)) sub = 'Vétéran'; else if (/senior u20/i.test(sub)) sub = 'Senior U20'; else if (/senior/i.test(sub)) sub = 'Senior'; else sub = sub.toUpperCase();
      out.push({ lastName: upper.join(' '), firstName: rest.join(' '), birth: `${d[3]}-${d[2]}-${d[1]}`, subcat: sub });
    });
    return out;
  }
  /* ---------- categories by year of birth (FFF: a season starts on 1 July, U13 in 2026-2027 = born in 2014) ---------- */
  const AGE_CATS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'Seniors', 'Vétérans'];
  const REMOVED_CATS = ['U18', 'U19', 'U20']; // the club has no U18 / U19 / U20: from 18 years old, players are in Seniors
  const seasonStart = (d = new Date()) => d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  const seasonLabel = () => `${seasonStart()}-${seasonStart() + 1}`;
  // From U9 to Seniors, each category also has two teams A and B: the coach picks their players among the category's licenci\u00e9s
  const AB_FROM = ['U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'Seniors'];
  const EXTRA_CATS = ['\u00c9cole de foot']; // filled by hand
  const catKey = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');
  const isSubTeam = t => /\s[A-Z]$/.test(String(t.name || '').trim()); // \u00ab U13 A \u00bb, \u00ab Seniors B \u00bb
  const isAgeTeam = t => AGE_CATS.some(c => catKey(c) === catKey(t.name) || (!isSubTeam(t) && catKey(c) === catKey(t.category)));
  // The category itself (\u00ab U13 \u00bb), never one of its teams (\u00ab U13 A \u00bb)
  const findCat = cat => S().teams.find(x => catKey(x.name) === catKey(cat)) || S().teams.find(x => !isSubTeam(x) && catKey(x.category) === catKey(cat));
  // Category of a player: U + age reached during the season; 18 and over: Seniors (no U18 / U19 / U20 at the club), or Vétérans with a vétéran licence
  function catOf(p) {
    const y = +(String(p.birth || '').slice(0, 4)); if (!y) return null;
    const age = seasonStart() + 1 - y;
    if (/v[ée]t/i.test(p.subcat || '') || age >= 36) return 'Vétérans';
    if (age >= 18) return 'Seniors';
    return 'U' + Math.max(6, age);
  }
  const formatOf = cat => { if (/^[ÉE]cole/i.test(cat)) return '5'; const n = +cat.slice(1); return cat[0] !== 'U' ? '11' : n <= 9 ? '5' : n <= 13 ? '8' : '11'; };
  function ageTeam(cat) {
    let t = findCat(cat);
    // Same id on every device, so two devices creating « U8 » at the same time give one category after the sync
    if (!t) t = Store.upsert('teams', { id: 'cat-' + catKey(cat), name: cat, category: cat, format: formatOf(cat) });
    return t;
  }
  // École de foot, and teams A and B from U9 to Seniors (made once: a team the club deletes is not made again)
  function extraTeams() {
    EXTRA_CATS.forEach(ageTeam);
    AB_FROM.forEach(base => ['A', 'B'].forEach(l => {
      const name = base + ' ' + l;
      if (!S().teams.some(x => catKey(x.name) === catKey(name))) Store.upsert('teams', { id: 'cat-' + catKey(name), name, category: base, format: formatOf(base) });
    }));
  }
  const sortTeams = () => Store.sortTeams(); // Seniors, Vétérans, École de foot, then U6 … U17
  // U18, U19 and U20 removed (done once): their players, dirigeants, sessions, matches and schemas go to Seniors,
  // then the two categories and their teams A / B are deleted on every device
  function removeOldCats() {
    const gone = S().teams.filter(t => REMOVED_CATS.some(c => catKey(c) === catKey(t.name) || catKey(c) === catKey(t.category)));
    if (!gone.length) return false;
    const sen = ageTeam('Seniors'), ids = new Set(gone.map(t => t.id));
    const swap = list => [...new Set((list || []).map(id => ids.has(id) ? sen.id : id))];
    ['players', 'staff'].forEach(col => S()[col].slice().forEach(x => { const n = swap(x.teamIds); if (n.join() !== (x.teamIds || []).join()) { x.teamIds = n; Store.upsert(col, x); } }));
    ['matches', 'trainings', 'schemas'].forEach(col => S()[col].slice().forEach(x => { if (ids.has(x.teamId)) { x.teamId = sen.id; Store.upsert(col, x); } }));
    if (ids.has(S().ui.teamId)) S().ui.teamId = '';
    gone.forEach(t => Store.remove('teams', t.id));
    return true;
  }
  // Creates every category and puts each player with a date of birth in his one (other teams, e.g. « U13 A », are kept)
  function sortByBirth() {
    AGE_CATS.forEach(ageTeam);
    const ageIds = new Set(S().teams.filter(isAgeTeam).map(t => t.id));
    let moved = 0, noBirth = 0;
    S().players.forEach(p => {
      const cat = catOf(p); if (!cat) { noBirth++; return; }
      const tid = ageTeam(cat).id, before = (p.teamIds || []).slice().sort().join();
      p.teamIds = [...(p.teamIds || []).filter(id => !ageIds.has(id)), tid];
      if (p.teamIds.slice().sort().join() !== before) { p.updatedAt = Date.now(); moved++; }
    });
    sortTeams(); Store.save();
    return { moved, noBirth };
  }
  // Once per season, on a responsable's device: every category exists and each player is in his own
  // (after that, a player moved by hand, e.g. surclassé, stays where he was put)
  function autoCategories() {
    if (!Auth.isAdmin() || !S().players.length) return false;
    const season = seasonLabel(), c = S().club;
    let changed = false;
    if (!c.noU18U19U20) { removeOldCats(); c.noU18U19U20 = 1; changed = true; }
    // Vétérans loisirs, next to Vétérans (made once; players are put in it by hand)
    if (!c.vetLoisirs) { ageTeam('Vétérans loisirs'); c.vetLoisirs = 1; changed = true; }
    if (!c.teamsAB) { AGE_CATS.forEach(ageTeam); extraTeams(); c.teamsAB = 1; changed = true; }
    if (c.catSeason === season && AGE_CATS.every(k => findCat(k))) { if (changed) { sortTeams(); Store.save(); } return changed; }
    if (c.catSeason === season) { AGE_CATS.forEach(ageTeam); sortTeams(); Store.save(); return true; }
    sortByBirth(); c.catSeason = season; Store.save(); return true;
  }
  function sortByBirthDialog(done) {
    const y = seasonStart() + 1;
    UI.confirmBox(`Créer les catégories U6 à U17, Seniors et Vétérans, et ranger chaque joueur selon son année de naissance (saison ${seasonLabel()} : U13 = né en ${y - 13}, U17 = né en ${y - 17}, Seniors = né en ${y - 18} ou avant) ? Les autres équipes (ex : « U13 A ») et les dirigeants ne changent pas.`, 'Ranger').then(ok => {
      if (!ok) return;
      const r = sortByBirth(); S().club.catSeason = seasonLabel(); Store.save();
      toast(`${r.moved} joueur${r.moved > 1 ? 's' : ''} rangé${r.moved > 1 ? 's' : ''}${r.noBirth ? ` · ${r.noBirth} sans date de naissance` : ''}`);
      done && done();
    });
  }
  function teamForSub(sub) {
    const tn = TEAM_OF_SUB[sub]; if (!tn) return null;
    let t = findCat(tn);
    if (!t) t = Store.upsert('teams', { id: Store.uid(), name: tn, category: tn, format: FORMAT_OF_TEAM[tn] || '11' });
    return t.id;
  }
  function pasteList(done) {
    modal({ title: 'Coller une liste de joueurs',
      body: `<p class="tip">Dans Footclubs, sélectionne les lignes de la liste des licenciés, copie-les puis colle-les ici. Il faut au minimum le nom, le prénom et la date de naissance sur chaque ligne. Les joueurs sont rangés dans leur catégorie selon leur année de naissance (U6 à U17, Seniors à partir de 18 ans, Vétérans).</p>
        <textarea id="pasteTxt" rows="9" placeholder="DUPONT Lucas   12/03/2014   Libre / U13 (- 13 ans)"></textarea><p class="muted small" id="pasteInfo"></p>`,
      onOpen: r => { $('#pasteTxt', r).oninput = e => { const n = parseLines(e.target.value).length; $('#pasteInfo', r).textContent = n ? `${n} joueur${n > 1 ? 's' : ''} reconnu${n > 1 ? 's' : ''}` : ''; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const rows = parseLines($('#pasteTxt', r).value);
        if (!rows.length) { toast('Aucune ligne reconnue : il faut une date de naissance jj/mm/aaaa', 'err'); return false; }
        const { added, updated } = addPlayers(rows);
        toast(`${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour`); done && done();
      } }] });
  }
  // Players from a Footclubs list: same nom + prénom (+ date of birth) → updated, otherwise added; category from the year of birth
  function addPlayers(rows) {
        let added = 0, updated = 0;
        rows.forEach(x => {
          const ex = S().players.find(p => (p.lastName || '').toUpperCase() === x.lastName && (p.firstName || '').toLowerCase() === x.firstName.toLowerCase() && (!p.birth || p.birth === x.birth));
          const cat = catOf(x), tid = cat ? ageTeam(cat).id : teamForSub(x.subcat);
          if (ex) { Object.assign(ex, { birth: x.birth, subcat: x.subcat || ex.subcat }); if (tid) { const ageIds = new Set(S().teams.filter(isAgeTeam).map(t => t.id)); ex.teamIds = [...(ex.teamIds || []).filter(id => !ageIds.has(id)), tid]; } Store.upsert('players', ex); updated++; }
          else { Store.upsert('players', Object.assign({ id: Store.uid(), number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: tid ? [tid] : [] }, x)); added++; }
        });
        sortTeams(); Store.save();
        return { added, updated };
  }

  /* ---------- paste a list of dirigeants: « NOM Prénom · rôle · téléphone · catégories » on each line ---------- */
  const ROLE_RE = /(responsable de cat[ée]gorie|[ée]ducateur adjoint|entra[iî]neur des gardiens|[ée]ducat(?:eur|rice)|entra[iî]neu(?:r|se)|coach|dirigeant(?:e)?|accompagnat(?:eur|rice)|pr[ée]sident(?:e)?|vice-pr[ée]sident(?:e)?|secr[ée]taire|tr[ée]sori(?:er|[èe]re)|arbitre)/i;
  function parseStaff(txt) {
    return txt.split(/\r?\n/).map(line => {
      let l = line.replace(/[\t|;]+/g, ' ').replace(/\s+/g, ' ').trim(); if (!l) return null;
      // « club: Juventus » (or « équipe: … ») at the end of the line = favourite club
      const clubM = l.match(/\b(?:club(?:\s+de\s+c(?:œ|oe)ur)?|[ée]quipe(?:\s+pr[ée]f[ée]r[ée]e)?)\s*:\s*(.+)$/i), club = clubM ? Clubs.find(clubM[1]) : '';
      if (clubM) l = l.slice(0, clubM.index).trim();
      const phone = (l.match(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/) || [''])[0];
      const email = (l.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0];
      const roleM = l.match(ROLE_RE);
      const cats = (l.match(/\bU\s?\d{1,2}\b|\bS[ée]niors?\b|\bV[ée]t[ée]rans?\b/gi) || []).map(c => c.replace(/\s/g, '').toUpperCase().replace(/^S[ÉE]NIORS?$/, 'SENIORS').replace(/^V[ÉE]T[ÉE]RANS?$/, 'VETERANS'));
      let rest = l.replace(phone, ' ').replace(email, ' ').replace(roleM ? roleM[0] : '', ' ').replace(/\bU\s?\d{1,2}\b|\bS[ée]niors?\b|\bV[ée]t[ée]rans?\b/gi, ' ').replace(/\d{2}\/\d{2}\/\d{4}/g, ' ');
      // a usual first name can keep the licence one in brackets: « MOTO Giova (Christian) »
      const par = (rest.match(/\([^)]*\)/g) || []).join(' '); rest = rest.replace(/\([^)]*\)/g, ' ');
      const words = rest.split(/[\s,·/-]+/).filter(w => /^[A-Za-zÀ-ÿ'’]{2,}$/.test(w) && !/^(Libre|Dirigeant|Licence|Valid[ée]e)$/i.test(w));
      if (!words.length) return null;
      const upper = words.filter(w => w === w.toUpperCase()), other = words.filter(w => w !== w.toUpperCase());
      const lastName = (upper.length ? upper : words.slice(0, 1)).join(' ').toUpperCase(), firstName = [(upper.length ? other : words.slice(1)).join(' '), par].filter(Boolean).join(' ');
      const role = roleM ? roleM[0].replace(/^./, c => c.toUpperCase()).replace(/^Entra[iî]neur$/i, 'Éducateur').replace(/^Coach$/i, 'Éducateur').replace(/^Educateur/i, 'Éducateur') : '';
      return { lastName, firstName, role, phone, email, cats, club };
    }).filter(Boolean);
  }
  const normCat = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  function pasteStaff(done) {
    modal({ title: 'Coller une liste de dirigeants',
      body: `<p class="tip">Une personne par ligne : nom, prénom, et si tu les as le rôle, le téléphone et la ou les catégories. Par exemple : « DUPONT Karim Éducateur U13 06 12 34 56 78 ». Une liste copiée depuis Footclubs ou un tableur marche aussi.</p>
        <textarea id="stTxt" rows="8" placeholder="DUPONT Karim Éducateur U13 06 12 34 56 78&#10;MARTIN Sophie Dirigeante U11 U9"></textarea><div id="stPrev" class="imp-preview"></div>`,
      onOpen: r => { $('#stTxt', r).oninput = e => { const rows = parseStaff(e.target.value);
        $('#stPrev', r).innerHTML = rows.length ? `<ul class="imp-list">${rows.map(x => `<li><b>${esc(x.lastName)} ${esc(x.firstName)}</b> · ${esc(x.role)}${x.cats.length ? ' · ' + esc(x.cats.join(', ')) : ''}${x.club ? ' · club de cœur : ' + Clubs.crest(x.club, 16) + ' ' + esc(Clubs.name(x.club)) : ''}${x.phone ? ' · ' + esc(x.phone) : ''}</li>`).join('')}</ul>` : ''; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const rows = parseStaff($('#stTxt', r).value);
        if (!rows.length) { toast('Aucune ligne reconnue', 'err'); return false; }
        const { added, updated } = addStaff(rows);
        toast(`${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour. Ils apparaissent maintenant dans « Première connexion ».`); done && done();
      } }] });
  }
  function addStaff(rows) {
        let added = 0, updated = 0;
        rows.forEach(x => {
          const teamIds = x.cats.map(cat => (S().teams.find(t => normCat(t.name) === cat) || S().teams.find(t => !isSubTeam(t) && normCat(t.category) === cat) || {}).id).filter(Boolean);
          // same person: same nom and a common prénom (« Giova (Christian) » = « Christian »)
          const ex = S().staff.find(p => nk(p.lastName) === nk(x.lastName) && firstsOf(p.firstName).some(f => firstsOf(x.firstName).includes(f)));
          if (ex) { Object.assign(ex, { firstName: x.firstName.length > (ex.firstName || '').length ? x.firstName : ex.firstName, role: x.role || ex.role, phone: x.phone || ex.phone, email: x.email || ex.email, club: x.club || ex.club, teamIds: [...new Set([...(ex.teamIds || []), ...teamIds])] }); linkPlayer(ex); Store.upsert('staff', ex); updated++; }
          else { const n = { id: Store.uid(), lastName: x.lastName, firstName: x.firstName, role: x.role || 'Éducateur', phone: x.phone, email: x.email, notes: '', teamIds, club: x.club || '' }; linkPlayer(n); Store.upsert('staff', n); added++; }
        });
        return { added, updated };
  }

  /* ---------- a club list as a text file: Footclubs lines, then a line « DIRIGEANTS » and one dirigeant per line ---------- */
  const isClubList = txt => !/^\s*[{[]/.test(txt) && (parseLines(txt).length > 0 || /^\s*#?\s*DIRIGEANTS\s*$/im.test(txt));
  function importClubList(txt) {
    const [pl, st = ''] = txt.split(/^\s*#?\s*DIRIGEANTS\s*$/im);
    const p = addPlayers(parseLines(pl)), s = addStaff(parseStaff(st));
    sortByBirth(); S().club.catSeason = seasonLabel();
    return { players: p, staff: s };
  }

  return { isClubList, importClubList, autoCategories, sortByBirth, sortByBirthDialog, catOf, seasonLabel, editPlayer, editStaff, teamSections, bindTeamSections, staffPicker, listPage, age, fmtBirth, tel, name };
})();
