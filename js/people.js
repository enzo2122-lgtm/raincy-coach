/* People: club-wide players and staff (dirigeants), their contact details and their categories. */
const People = (() => {
  const { esc, $, $$, toast, modal, confirmBox } = UI;
  const S = () => Store.state;
  const POS = [['', '–'], ['GB', 'Gardien'], ['DEF', 'Défenseur'], ['MIL', 'Milieu'], ['ATT', 'Attaquant']];
  const SUBCATS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'Senior U20', 'Senior', 'Vétéran'];
  const ROLES = ['Éducateur', 'Éducateur adjoint', 'Responsable de catégorie', 'Dirigeant', 'Accompagnateur', 'Entraîneur des gardiens', 'Arbitre bénévole', 'Président', 'Vice-président', 'Secrétaire', 'Trésorier', 'Autre'];
  const RELS = ['Mère', 'Père', 'Tuteur', 'Autre'];
  // Which category (team) gathers each licence sub-category
  const TEAM_OF_SUB = { 'Vétéran': 'Vétérans', 'Senior': 'Seniors', 'Senior U20': 'Seniors', U19: 'U19', U18: 'U19', U17: 'U17', U16: 'U17', U15: 'U15', U14: 'U15', U13: 'U13', U12: 'U13', U11: 'U11', U10: 'U11', U9: 'U9', U8: 'U9', U7: 'U7', U6: 'U7' };
  const FORMAT_OF_TEAM = { U7: '5', U9: '5', U11: '8', U13: '8' };

  const name = Store.fullName;
  const age = iso => { if (!iso) return ''; const b = new Date(iso + 'T12:00'), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  const fmtBirth = iso => iso ? iso.split('-').reverse().join('/') : '';
  const telHref = n => 'tel:' + String(n).replace(/[^\d+]/g, '');
  const tel = (n, label) => n ? `<a class="tel" href="${telHref(n)}">${I.phone}<span>${label ? esc(label) + ' : ' : ''}${esc(n)}</span></a>` : '';
  const teamNames = ids => (ids || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', ');
  const phonesOf = p => [p.phone, ...(p.parents || []).map(x => x.phone)].filter(Boolean);

  /* ---------- rows ---------- */
  function playerRow(p, teamId) {
    const sub = [p.subcat, p.birth ? `${age(p.birth)} ans` : '', teamId ? '' : teamNames(p.teamIds)].filter(Boolean).join(' · ');
    return `<div class="person">
      <button class="person-main" data-person="${p.id}" data-kind="player">
        <span class="pnum">${esc(p.number || '')}</span>
        <span class="pmain"><b>${esc(name(p))}</b><span class="muted">${esc(sub) || '&nbsp;'}</span></span>
        ${phonesOf(p).length ? `<span class="has-tel" title="Téléphone renseigné">${I.phone}</span>` : ''}
      </button>
      ${teamId ? `<button class="icon-btn" data-unlink="${p.id}" data-kind="player" aria-label="Retirer ${esc(name(p))} de la catégorie">${I.x}</button>` : ''}
    </div>`;
  }
  function staffRow(p, teamId) {
    return `<div class="person">
      <button class="person-main" data-person="${p.id}" data-kind="staff">
        <span class="pnum role">${I.whistle}</span>
        <span class="pmain"><b>${esc(name(p))}</b><span class="muted">${esc(p.role || '')}${teamId ? '' : ' · ' + esc(teamNames(p.teamIds) || 'aucune catégorie')}</span></span>
      </button>
      ${p.phone ? `<a class="icon-btn" href="${telHref(p.phone)}" aria-label="Appeler ${esc(name(p))}">${I.phone}</a>` : ''}
      ${teamId ? `<button class="icon-btn" data-unlink="${p.id}" data-kind="staff" aria-label="Retirer ${esc(name(p))} de la catégorie">${I.x}</button>` : ''}
    </div>`;
  }
  const teamChips = ids => `<div class="chips" id="pTeams">${S().teams.map(t => `<button type="button" class="chip ${(ids || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.name)}</button>`).join('') || '<p class="muted">Crée d\'abord une catégorie dans Équipes.</p>'}</div>`;
  const bindChips = r => $$('#pTeams .chip', r).forEach(b => b.onclick = () => b.classList.toggle('on'));
  const pickedTeams = r => $$('#pTeams .chip.on', r).map(b => b.dataset.t);
  const opt = (list, cur) => list.map(v => Array.isArray(v) ? `<option value="${esc(v[0])}" ${v[0] === cur ? 'selected' : ''}>${esc(v[1])}</option>` : `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');

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
      onOpen: bindChips,
      actions: [
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(() => confirmBox(`Supprimer ${name(p)} de tout le club ?`).then(ok => { if (ok) { Store.remove('players', p.id); toast('Joueur supprimé'); opts.onSave && opts.onSave(); } }), 60); } }]),
        { label: 'Annuler' },
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const v = id => $('#' + id, r).value.trim();
          if (!v('pLast') && !v('pFirst')) { toast('Écris au moins le nom ou le prénom', 'err'); return false; }
          Object.assign(p, { lastName: v('pLast').toUpperCase(), firstName: v('pFirst'), birth: v('pBirth'), subcat: v('pSub'), number: v('pNum') === '' ? '' : +v('pNum'), pos: v('pPos'), phone: v('pTel'), email: v('pMail'), notes: $('#pNotes', r).value, teamIds: pickedTeams(r),
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
        <label class="fld"><span>Rôle</span><select id="sRole">${opt(ROLES, p.role)}</select></label>
        <div class="lbl">Catégories (plusieurs possibles)</div>${teamChips(p.teamIds)}
        <div class="row2"><label class="fld"><span>Téléphone</span><input id="sTel" type="tel" inputmode="tel" value="${esc(p.phone || '')}"></label>
        <label class="fld"><span>E-mail</span><input id="sMail" type="email" inputmode="email" value="${esc(p.email || '')}"></label></div>
        ${p.phone ? tel(p.phone, 'Appeler') : ''}
        <label class="fld"><span>Infos (diplôme, licence, disponibilités…)</span><textarea id="sNotes" rows="3">${esc(p.notes || '')}</textarea></label>`,
      onOpen: bindChips,
      actions: [
        ...(isNew ? [] : [{ label: 'Supprimer', kind: 'danger', icon: I.trash, onClick: () => { setTimeout(() => confirmBox(`Supprimer ${name(p)} ?`).then(ok => { if (ok) { Store.remove('staff', p.id); Auth.forget(p.id); toast('Dirigeant supprimé'); opts.onSave && opts.onSave(); } }), 60); } }]),
        { label: 'Annuler' },
        { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => {
          const v = id => $('#' + id, r).value.trim();
          if (!v('sLast') && !v('sFirst')) { toast('Écris au moins le nom ou le prénom', 'err'); return false; }
          Object.assign(p, { lastName: v('sLast').toUpperCase(), firstName: v('sFirst'), role: v('sRole'), phone: v('sTel'), email: v('sMail'), notes: $('#sNotes', r).value, teamIds: pickedTeams(r) });
          Store.upsert('staff', p); toast('Enregistré'); opts.onSave && opts.onSave(p);
        } },
      ],
    });
  }

  /* ---------- dropdowns ---------- */
  // Select listing people not yet in the team, grouped by their categories
  function addSelect(kind, teamId, label) {
    const list = (kind === 'player' ? S().players : S().staff).filter(p => !(p.teamIds || []).includes(teamId)).sort(Store.byName);
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
  function teamSections(t) {
    const ps = Store.playersOf(t.id), st = Store.staffOf(t.id);
    return `<section class="card">
        <div class="row-head"><h2>${I.team}Joueurs (${ps.length})</h2>
          <div class="chips"><button class="btn primary" data-newplayer>${I.plus}<span>Nouveau joueur</span></button></div></div>
        ${addSelect('player', t.id, 'Ajouter un joueur d\'une autre catégorie…')}
        <div class="people">${ps.map(p => playerRow(p, t.id)).join('') || '<p class="muted">Aucun joueur dans cette catégorie.</p>'}</div>
      </section>
      <section class="card">
        <div class="row-head"><h2>${I.whistle}Encadrement (${st.length})</h2>
          <button class="btn" data-newstaff>${I.plus}<span>Nouveau dirigeant</span></button></div>
        ${addSelect('staff', t.id, 'Ajouter un dirigeant existant…')}
        <div class="people">${st.map(p => staffRow(p, t.id)).join('') || '<p class="muted">Aucun dirigeant pour cette catégorie.</p>'}</div>
      </section>`;
  }
  function bindTeamSections(root, t, rerender) {
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
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
    const all = (isP ? S().players : S().staff).slice().sort(Store.byName);
    const list = all.filter(p => (!filt || (filt === '-' ? !(p.teamIds || []).length : (p.teamIds || []).includes(filt))) && (!q || name(p).toLowerCase().includes(q)));
    root.innerHTML = `<header class="page-head"><div><h1>${isP ? 'Joueurs' : 'Dirigeants'}</h1><p class="sub">${list.length} sur ${all.length} · tout le club</p></div>
      <div class="head-actions"><a class="btn" href="#/equipes">${I.back}<span>Équipes</span></a>
      ${isP ? `<button class="btn" data-act="paste">${I.paste}<span>Coller une liste</span></button>` : ''}
      <button class="btn primary" data-act="new">${I.plus}<span>${isP ? 'Nouveau joueur' : 'Nouveau dirigeant'}</span></button></div></header>
      <div class="filters">
        <label class="search">${I.search}<input id="q" type="search" placeholder="Chercher un nom" value="${esc(ui[key + 'Q'] || '')}"></label>
        <select id="cat" aria-label="Catégorie"><option value="">Toutes les catégories</option>${S().teams.map(t => `<option value="${t.id}" ${t.id === filt ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="-" ${filt === '-' ? 'selected' : ''}>Sans catégorie</option></select>
      </div>
      <div class="people big">${list.map(p => isP ? playerRow(p) : staffRow(p)).join('') || '<p class="muted">Personne ici.</p>'}</div>`;
    const again = () => listPage(root, kind);
    $('#q', root).oninput = e => { ui[key + 'Q'] = e.target.value; const pos = e.target.selectionStart; again(); const i = $('#q', root); i.focus(); i.setSelectionRange(pos, pos); };
    $('#cat', root).onchange = e => { ui[key] = e.target.value; Store.save(); again(); };
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'new') return (isP ? editPlayer : editStaff)(null, { teamId: filt && filt !== '-' ? filt : null, onSave: again });
      if (b.dataset.act === 'paste') return pasteList(again);
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
  function teamForSub(sub) {
    const tn = TEAM_OF_SUB[sub]; if (!tn) return null;
    let t = S().teams.find(x => x.category === tn || x.name === tn);
    if (!t) t = Store.upsert('teams', { id: Store.uid(), name: tn, category: tn, format: FORMAT_OF_TEAM[tn] || '11' });
    return t.id;
  }
  function pasteList(done) {
    modal({ title: 'Coller une liste de joueurs',
      body: `<p class="tip">Dans Footclubs, sélectionne les lignes de la liste des licenciés, copie-les puis colle-les ici. Il faut au minimum le nom, le prénom et la date de naissance sur chaque ligne. Les joueurs sont rangés dans leur catégorie selon leur sous-catégorie (U14 et U15 dans U15, par exemple).</p>
        <textarea id="pasteTxt" rows="9" placeholder="DUPONT Lucas   12/03/2014   Libre / U13 (- 13 ans)"></textarea><p class="muted small" id="pasteInfo"></p>`,
      onOpen: r => { $('#pasteTxt', r).oninput = e => { const n = parseLines(e.target.value).length; $('#pasteInfo', r).textContent = n ? `${n} joueur${n > 1 ? 's' : ''} reconnu${n > 1 ? 's' : ''}` : ''; }; },
      actions: [{ label: 'Annuler' }, { label: 'Ajouter', kind: 'primary', onClick: (c, r) => {
        const rows = parseLines($('#pasteTxt', r).value);
        if (!rows.length) { toast('Aucune ligne reconnue : il faut une date de naissance jj/mm/aaaa', 'err'); return false; }
        let added = 0, updated = 0;
        rows.forEach(x => {
          const ex = S().players.find(p => (p.lastName || '').toUpperCase() === x.lastName && (p.firstName || '').toLowerCase() === x.firstName.toLowerCase() && (!p.birth || p.birth === x.birth));
          const tid = teamForSub(x.subcat);
          if (ex) { Object.assign(ex, { birth: x.birth, subcat: x.subcat || ex.subcat }); if (tid && !ex.teamIds.includes(tid)) ex.teamIds.push(tid); Store.upsert('players', ex); updated++; }
          else { Store.upsert('players', Object.assign({ id: Store.uid(), number: '', pos: '', phone: '', email: '', parents: [], notes: '', teamIds: tid ? [tid] : [] }, x)); added++; }
        });
        toast(`${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour`); done && done();
      } }] });
  }

  return { editPlayer, editStaff, teamSections, bindTeamSections, staffPicker, listPage, age, fmtBirth, tel, name };
})();
