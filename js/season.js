/* Season: the review of the season of a team (results, scorers, playing time, attendance, progression, injuries),
   a word of the coach, a PDF to hand to the club or the parents, and the full backup of the season before starting the next one. */
const Season = (() => {
  const { esc, $, toast } = UI;
  const S = () => Store.state;
  const res = m => m.gf > m.ga ? 'V' : m.gf < m.ga ? 'D' : 'N';

  function data(t) {
    const from = People.seasonFrom(), now = UI.today();
    const ms = S().matches.filter(m => m.teamId === t.id && m.played && !m.exempt && m.date >= from).sort((a, b) => a.date.localeCompare(b.date));
    const trs = S().trainings.filter(x => !x.model && x.teamId === t.id && x.date >= from && x.date <= now);
    const r = { V: 0, N: 0, D: 0 }; ms.forEach(m => r[res(m)]++);
    const gf = ms.reduce((a, m) => a + (+m.gf || 0), 0), ga = ms.reduce((a, m) => a + (+m.ga || 0), 0);
    const players = (Store.playersOf(t.id).length ? Store.playersOf(t.id) : Store.rosterOf(t.id)).map(p => {
      const mp = ms.filter(m => +((m.minutes || {})[p.id]) > 0 || (m.convoked || []).includes(p.id) && (m.minutes || {})[p.id] == null);
      const minutes = ms.reduce((a, m) => a + (+((m.minutes || {})[p.id]) || 0), 0);
      const g = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).g || 0), 0), as = ms.reduce((a, m) => a + (((m.stats || {})[p.id] || {}).a || 0), 0);
      const att = People.attendance(p, t.id), ev = Progress.evals(p).filter(e => e.date >= from), gl = ev.length ? Progress.global(ev[ev.length - 1]) : null;
      const inj = (p.unavail || []).filter(u => u.kind === 'injury' && (u.to || now) >= from).reduce((a, u) => a + Math.max(0, Math.round((new Date((u.to && u.to < now ? u.to : now) + 'T12:00') - new Date((u.from > from ? u.from : from) + 'T12:00')) / 864e5)), 0);
      return { p, mp: mp.length, minutes, g, a: as, att: att.pct, evalG: gl, evalN: ev.length, inj };
    }).sort((a, b) => b.minutes - a.minutes || Store.byName(a.p, b.p));
    return { ms, trs, r, gf, ga, players, trMin: trs.reduce((a, x) => a + (x.exercises || []).reduce((b, e) => b + (+e.duration || 0), 0), 0) };
  }

  function page(root, teamId) {
    const teams = Auth.teams(), t = Store.get('teams', teamId) || Store.get('teams', S().ui.teamId) || teams[0];
    if (!t) { root.innerHTML = '<div class="empty"><p>Crée d\'abord une équipe.</p></div>'; return; }
    const d = data(t), season = People.seasonLabel(), note = ((t.seasonNotes || {})[season]) || '';
    const top = k => d.players.filter(x => x[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 5);
    root.innerHTML = `<header class="page-head"><div><h1>🏆 Bilan de saison</h1><p class="sub">${esc(t.name)} · ${esc(season)}</p></div>
      <div class="head-actions"><a class="btn" href="#/stats">${I.back}<span>Statistiques</span></a><button class="btn" data-ss="save">${I.download}<span>Sauvegarder la saison</span></button><button class="btn primary" data-ss="pdf">${I.pdf}<span>Bilan PDF</span></button></div></header>
      <label class="fld inline"><span>Équipe</span><select id="ssTeam">${teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(Store.teamLabel(x))}</option>`).join('')}</select></label>
      <div class="tiles"><div class="tile"><b>${d.ms.length}</b><span>Matchs</span></div><div class="tile v"><b>${d.r.V}</b><span>Victoires</span></div><div class="tile n"><b>${d.r.N}</b><span>Nuls</span></div><div class="tile d"><b>${d.r.D}</b><span>Défaites</span></div>
        <div class="tile"><b>${d.gf} – ${d.ga}</b><span>Buts pour – contre</span></div><div class="tile"><b>${d.trs.length}</b><span>Séances (${Math.round(d.trMin / 60)} h)</span></div></div>
      <div class="cards2">
        <section class="card"><h2>⚽ Buteurs</h2>${top('g').map((x, i) => `<p class="ss-row"><span>${i + 1}. ${esc(Store.fullName(x.p))}</span><b>${x.g}</b></p>`).join('') || '<p class="muted">—</p>'}</section>
        <section class="card"><h2>🅿️ Passeurs</h2>${top('a').map((x, i) => `<p class="ss-row"><span>${i + 1}. ${esc(Store.fullName(x.p))}</span><b>${x.a}</b></p>`).join('') || '<p class="muted">—</p>'}</section>
      </div>
      <section class="card"><h2>👥 Les joueurs</h2><div class="ss-table"><table><thead><tr><th>Joueur</th><th>Matchs</th><th>Minutes</th><th>Buts</th><th>Passes</th><th>Présence</th><th>Éval.</th><th>Blessé</th></tr></thead>
        <tbody>${d.players.map(x => `<tr><td><a href="#/joueur/${x.p.id}">${esc(Store.fullName(x.p))}</a></td><td>${x.mp}</td><td>${x.minutes}'</td><td>${x.g || ''}</td><td>${x.a || ''}</td><td>${x.att == null ? '–' : x.att + ' %'}</td><td>${x.evalG == null ? '–' : x.evalG.toFixed(1).replace('.', ',')}</td><td>${x.inj ? x.inj + ' j' : ''}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><h2>📋 Les résultats</h2><div class="ss-results">${d.ms.map(m => `<a href="#/match/${m.id}" class="res-${res(m)}"><span>${esc(UI.fmtDate(m.date, { day: 'numeric', month: 'short' }))}</span><span>${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}</span><b>${m.gf} – ${m.ga}</b></a>`).join('') || '<p class="muted">Pas encore de match joué.</p>'}</div></section>
      <section class="card"><h2>🗣️ Le mot du coach</h2><textarea id="ssNote" rows="4" placeholder="Ce qu'on retient de la saison, les progrès, les objectifs pour la suivante (apparaît dans le PDF)">${esc(note)}</textarea></section>`;
    $('#ssTeam', root).onchange = e => { location.hash = '#/bilan/' + e.target.value; };
    $('#ssNote', root).oninput = e => { t.seasonNotes = Object.assign({}, t.seasonNotes || {}, { [season]: e.target.value }); clearTimeout(page.t); page.t = setTimeout(() => Store.upsert('teams', t), 600); };
    root.onclick = async e => { const b = e.target.closest('[data-ss]'); if (!b) return;
      if (b.dataset.ss === 'pdf') return pdf(t);
      if (b.dataset.ss === 'save') { try { const r = await Exporter.json(Store.exportAll(), `raincy-saison-${season}`); if (r === 'downloaded') toast('Sauvegarde enregistrée dans Téléchargements'); } catch (err) { toast('Sauvegarde impossible', 'err'); } } };
  }

  async function pdf(t) {
    const b = UI.busy('Création du bilan…');
    try {
      const d = data(t), season = People.seasonLabel(), P = Exporter.pdfDoc(S().club), note = ((t.seasonNotes || {})[season]) || '';
      P.header('Bilan de saison', `${t.name} · ${season}`); P.h2(`${t.name} · saison ${season}`);
      P.facts([['Matchs', String(d.ms.length)], ['V / N / D', `${d.r.V} / ${d.r.N} / ${d.r.D}`], ['Buts', `${d.gf} pour · ${d.ga} contre`], ['Séances', `${d.trs.length} (${Math.round(d.trMin / 60)} h)`]]);
      if (note) { P.label('Le mot du coach'); P.para(note, 11.5); }
      const top = k => d.players.filter(x => x[k] > 0).sort((a, c) => c[k] - a[k]).slice(0, 5);
      if (top('g').length) { P.label('Meilleurs buteurs'); P.table(['Joueur', 'Buts'], top('g').map(x => [Store.fullName(x.p), String(x.g)]), [.8, .2]); }
      if (top('a').length) { P.label('Meilleurs passeurs'); P.table(['Joueur', 'Passes'], top('a').map(x => [Store.fullName(x.p), String(x.a)]), [.8, .2]); }
      P.label('Les joueurs'); P.table(['Joueur', 'Matchs', 'Min.', 'Buts', 'Passes', 'Présence', 'Éval.'], d.players.map(x => [Store.fullName(x.p), String(x.mp), String(x.minutes), String(x.g || ''), String(x.a || ''), x.att == null ? '-' : x.att + ' %', x.evalG == null ? '-' : x.evalG.toFixed(1)]), [.34, .1, .1, .1, .1, .13, .13]);
      if (d.ms.length) { P.label('Les résultats'); P.table(['Date', 'Adversaire', 'Score', ''], d.ms.map(m => [UI.fmtDate(m.date), `${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`, `${m.gf} - ${m.ga}`, { V: 'Victoire', N: 'Nul', D: 'Défaite' }[res(m)]]), [.25, .45, .15, .15]); }
      const r = await Exporter.deliver(P.blob(), `bilan-${String(t.name).replace(/[^\wÀ-ÿ-]+/g, '-')}-${season}.pdf`);
      if (r === 'downloaded') toast('Bilan enregistré dans Téléchargements');
    } catch (e) { console.error(e); toast('Bilan impossible : ' + (e.message || e), 'err'); } finally { b.done(); }
  }
  return { page, pdf, data };
})();
