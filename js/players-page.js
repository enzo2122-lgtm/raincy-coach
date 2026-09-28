/* Page for the players (joueurs.html#t=LINK): one category (seniors, U17, U18…), no account.
   The next match with the coach's team talk (objective, 3 keys, last word, video), the convocation (présent / absent),
   the sessions, the results with each one's playing time, and « Ma saison » once the player has said who he is.
   It only talks to the club server through player_view / player_answer. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hh = x => String(x || '').replace(':', 'h');
  const fmt = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o) : '';
  const ME = 'raincy-player-me';
  const token = (location.hash.match(/t=([A-Za-z0-9]+)/) || [])[1] || '';
  let data = null;
  const me = () => { try { return localStorage.getItem(ME + ':' + token) || ''; } catch (e) { return ''; } };
  const setMe = id => { try { if (id) localStorage.setItem(ME + ':' + token, id); else localStorage.removeItem(ME + ':' + token); } catch (e) {} };
  const nameOf = id => ((data.roster || []).find(p => p.id === id) || {}).name || '';

  let tt;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = 'toast'; }, 2600); }
  async function rpc(name, args) {
    const c = typeof CLUB_SERVER !== 'undefined' ? CLUB_SERVER : null;
    if (!c || !c.url) throw new Error('Serveur du club introuvable.');
    const headers = { apikey: c.key, 'Content-Type': 'application/json' };
    if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
    let r;
    try { r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) }); }
    catch (e) { throw new Error('Pas de connexion internet. Réessaie dans un instant.'); }
    const txt = await r.text();
    if (!r.ok) {
      let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) {}
      if (/LIEN_JOUEURS/.test(m)) throw new Error('Ce lien n\'est plus valable : demande le nouveau lien au coach.');
      if (/MATCH_PASSE/.test(m)) throw new Error('Ce match est passé : les réponses sont fermées.');
      if (r.status === 404 || /could not find the function/i.test(m)) throw new Error('La page des joueurs n\'est pas encore prête : le club doit mettre à jour son serveur.');
      throw new Error('Le serveur ne répond pas. Réessaie dans un instant.');
    }
    return txt ? JSON.parse(txt) : null;
  }

  const result = m => !m.played ? '' : +m.gf > +m.ga ? 'V' : +m.gf < +m.ga ? 'D' : 'N';
  const RES = { V: 'Gagné', D: 'Perdu', N: 'Nul' };
  const mapLink = place => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener noreferrer">${esc(place)}</a>`;
  const club = () => (data.club && data.club.name) || 'FA Le Raincy';
  const score = m => m.home ? `${esc(m.gf)} – ${esc(m.ga)}` : `${esc(m.ga)} – ${esc(m.gf)}`;
  const title = m => m.home ? `<b>${esc(club())}</b> <i>contre</i> ${esc(m.opponent || '?')}` : `${esc(m.opponent || '?')} <i>contre</i> <b>${esc(club())}</b>`;

  // the season of every player, from the played matches
  function season() {
    const s = {};
    (data.matches || []).filter(m => m.played).forEach(m => (m.stats || []).forEach(x => {
      const r = s[x.id] = s[x.id] || { id: x.id, mp: 0, min: 0, g: 0, a: 0, conv: 0 }; r.conv++;
      const mn = +x.min || 0; if (mn > 0) { r.mp++; r.min += mn; } r.g += +x.g || 0; r.a += +x.a || 0;
    }));
    return s;
  }

  function nextCard(m) {
    const t = m.talk || {}, keys = (t.keys || []).filter(Boolean), kids = m.players || [], mine = me(), place = m.place || (m.home ? (data.club && data.club.fieldName) || '' : '');
    const k = kids.find(x => x.id === mine), yes = kids.filter(x => x.answer === 'oui').length;
    return `<article class="card next ${m.home ? 'home' : 'away'}" data-m="${esc(m.id)}">
      <div class="m-date">${esc(fmt(m.date))}${m.team && m.team !== data.team ? ` · ${esc(m.team)}` : ''}</div>
      <div class="m-title">${title(m)}</div>
      <span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>${m.competition ? `<span class="tag">${esc(m.competition)}</span>` : ''}
      <p class="info">${m.rdv ? `🕘 Rendez-vous <b>${esc(hh(m.rdv))}</b>` : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? `coup d'envoi <b>${esc(hh(m.time))}</b>` : ''}${!m.rdv && !m.time ? '🕘 Horaire à confirmer' : ''}</p>
      ${place ? `<p class="info">📍 ${mapLink(place)}</p>` : ''}
      ${mine && kids.length ? (k ? `<div class="mine-box"><b>Tu es convoqué 💪</b><div class="btns"><button class="b yes ${k.answer === 'oui' ? 'on' : ''}" data-ans="oui" data-p="${esc(k.id)}">Je suis présent</button><button class="b no ${k.answer === 'non' ? 'on' : ''}" data-ans="non" data-p="${esc(k.id)}">Absent</button></div></div>`
        : '<div class="mine-box off">Tu n\'es pas convoqué pour ce match.</div>') : ''}
      ${t.objective || keys.length || t.final || t.video ? `<div class="talk"><h3>🗣️ Le mot du coach</h3>
        ${t.objective ? `<p class="obj">🎯 ${esc(t.objective)}</p>` : ''}${t.system ? `<p class="info">Système : <b>${esc(t.system)}</b></p>` : ''}
        ${keys.length ? `<ol class="keys">${keys.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${t.final ? `<p class="final">${esc(t.final)}</p>` : ''}
        ${t.video ? `<p><a class="b vid" href="${esc(t.video)}" target="_blank" rel="noopener noreferrer">▶ Voir la vidéo du coach</a></p>` : ''}</div>` : ''}
      ${kids.length ? `<details class="conv"><summary><b>Convoqués (${kids.length})</b> · ✓ ${yes} présent${yes > 1 ? 's' : ''}</summary><ul class="kids">${kids.map(x => `<li class="kid ${x.id === mine ? 'mine' : ''}"><span class="nm">${esc(x.name)}</span>
        <span class="st ${esc(x.answer || '')}">${x.answer === 'oui' ? '✓ présent' : x.answer === 'non' ? '✗ absent' : 'pas de réponse'}</span>
        ${!mine ? `<span class="btns"><button class="b yes ${x.answer === 'oui' ? 'on' : ''}" data-ans="oui" data-p="${esc(x.id)}">Présent</button><button class="b no ${x.answer === 'non' ? 'on' : ''}" data-ans="non" data-p="${esc(x.id)}">Absent</button></span>` : ''}</li>`).join('')}</ul></details>`
        : '<p class="info">La convocation n\'est pas encore publiée.</p>'}
      <p><button class="b cal" data-cal="${esc(m.id)}">📅 Ajouter à mon agenda</button></p></article>`;
  }
  function pastCard(m) {
    const r = result(m), mine = me(), st = (m.stats || []).find(x => x.id === mine);
    const rows = (m.stats || []).map(x => ({ ...x, name: nameOf(x.id) })).filter(x => x.name).sort((a, b) => (+b.min || 0) - (+a.min || 0));
    return `<article class="card past"><div class="m-date">${esc(fmt(m.date, { weekday: 'short', day: 'numeric', month: 'short' }))}${m.competition ? ' · ' + esc(m.competition) : ''}</div>
      <div class="m-title">${title(m)}</div><p><span class="score">${score(m)}</span>${r ? `<span class="res ${r}">${RES[r]}</span>` : ''}</p>
      ${st ? `<p class="me-line">Toi : <b>${+st.min ? esc(st.min) + "'" : 'pas joué'}</b>${+st.g ? ` · ⚽ ${esc(st.g)}` : ''}${+st.a ? ` · 🅿️ ${esc(st.a)}` : ''}</p>` : ''}
      ${rows.length ? `<details><summary class="muted small">Temps de jeu de l'équipe</summary><div class="grid2">${rows.map(x => `<span class="${x.id === mine ? 'mine' : ''}">${esc(x.name)}</span><b>${+x.min ? esc(x.min) + "'" : '–'}${+x.g ? ' ⚽' + (x.g > 1 ? '×' + esc(x.g) : '') : ''}${+x.a ? ' 🅿️' : ''}</b>`).join('')}</div></details>` : ''}</article>`;
  }

  function render() {
    const d = new Date(), now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.title = `${data.team} · ${club()} · Joueurs`;
    $('#club').textContent = `${club()} · Espace joueurs`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now && !m.exempt), past = ms.filter(m => m.played).reverse();
    const s = season(), mine = me(), my = s[mine], roster = data.roster || [];
    const top = k => Object.values(s).filter(x => x[k] > 0 && nameOf(x.id)).sort((a, b) => b[k] - a[k]).slice(0, 5);
    const board = (k, lab, unit = '') => { const l = top(k); return l.length ? `<div class="board"><h3>${lab}</h3>${l.map((x, i) => `<p class="${x.id === mine ? 'mine' : ''}"><span>${i + 1}. ${esc(nameOf(x.id))}</span><b>${x[k]}${unit}</b></p>`).join('')}</div>` : ''; };
    $('#page').innerHTML = `
      <div class="card who">${mine && nameOf(mine) ? `<span>Salut <b>${esc(nameOf(mine))}</b> 👋</span><button class="b small" data-who="">Ce n'est pas moi</button>`
        : `<label><span>Qui es-tu ? (pour voir ta convocation et ta saison)</span><select id="whoSel"><option value="">Choisis ton nom</option>${roster.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.number ? ' · n°' + esc(p.number) : ''}</option>`).join('')}</select></label>`}</div>
      ${my ? `<h2>Ma saison</h2><div class="tiles"><div><b>${my.mp}</b><span>matchs joués</span></div><div><b>${my.min}'</b><span>temps de jeu</span></div><div><b>${my.mp ? Math.round(my.min / my.mp) : 0}'</b><span>par match</span></div><div><b>${my.g}</b><span>buts</span></div><div><b>${my.a}</b><span>passes déc.</span></div></div>` : ''}
      <h2>Prochain match</h2>${up.length ? nextCard(up[0]) : '<p class="tip">Pas de match prévu pour l\'instant.</p>'}
      ${up.length > 1 ? `<h2>Ensuite</h2><div class="card">${up.slice(1, 6).map(m => `<div class="tr"><span class="d">${esc(fmt(m.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${m.home ? 'contre' : 'chez'} ${esc(m.opponent || '?')}${m.time ? ' · ' + esc(hh(m.time)) : ''}</span></div>`).join('')}</div>` : ''}
      ${(data.trainings || []).length ? `<h2>Entraînements (2 semaines)</h2><div class="card">${data.trainings.map(t => `<div class="tr"><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}</span></div>`).join('')}</div>` : ''}
      ${Object.keys(s).length ? `<h2>Classements de la saison</h2><div class="boards">${board('g', '⚽ Buteurs')}${board('a', '🅿️ Passeurs')}${board('min', '⏱️ Temps de jeu', "'")}</div>` : ''}
      ${past.length ? `<h2>Résultats</h2>${past.slice(0, 12).map(pastCard).join('')}` : ''}
      ${(data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : ''}
      <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil »). Elle est réservée aux joueurs de l'équipe : ne la transfère pas.</p>`;
    const sel = $('#whoSel'); if (sel) sel.onchange = () => { setMe(sel.value); render(); };
  }

  async function load(quiet) {
    if (!token) { $('#team').textContent = 'Lien incomplet'; $('#page').innerHTML = '<p class="tip">Ce lien est incomplet. Ouvre le lien envoyé par le coach dans le groupe des joueurs.</p>'; return; }
    try { data = await rpc('player_view', { p_token: token }); render(); }
    catch (e) { if (quiet && data) return; $('#team').textContent = 'Espace joueurs'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`; const a = $('#again'); if (a) a.onclick = () => load(); }
  }
  async function answer(matchId, playerId, status) {
    const m = data.matches.find(x => x.id === matchId), k = m && (m.players || []).find(x => x.id === playerId); if (!k) return;
    const before = k.answer; k.answer = status; render();
    try { await rpc('player_answer', { p_token: token, p_match: matchId, p_player: playerId, p_status: status }); toast(status === 'oui' ? 'C\'est noté : présent 💪' : 'C\'est noté : absent. Préviens le coach si besoin.'); }
    catch (e) { k.answer = before; render(); toast(e.message, true); }
  }
  const icsDate = (d, t) => d.replace(/-/g, '') + 'T' + (t || '10:00').replace(':', '') + '00';
  function ics(m) {
    const e2 = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'), start = m.rdv || m.time || '10:00', [h, mi] = (m.time || start).split(':').map(Number);
    const end = String(Math.min(23, h + 2)).padStart(2, '0') + ':' + String(mi || 0).padStart(2, '0');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Raincy Coach//Joueurs//FR', 'BEGIN:VEVENT', 'UID:raincy-j-' + m.id + '@raincy-coach', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + icsDate(m.date, start), 'DTEND:' + icsDate(m.date, end), 'SUMMARY:' + e2(`⚽ ${data.team} ${m.home ? 'contre' : 'chez'} ${m.opponent || '?'}`),
      'LOCATION:' + e2(m.place || (m.home ? (data.club && data.club.fieldName) || '' : '')), 'DESCRIPTION:' + e2(`${m.rdv ? 'Rendez-vous ' + hh(m.rdv) : ''}${m.time ? ' · coup d\'envoi ' + hh(m.time) : ''}`),
      'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Match', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cal]');
    if (c) { const m = data.matches.find(x => x.id === c.dataset.cal); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics(m)], { type: 'text/calendar;charset=utf-8' })); a.download = `match-${m.date}.ics`; document.body.appendChild(a); a.click(); a.remove(); return; }
    const w = e.target.closest('[data-who]'); if (w) { setMe(''); render(); return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    answer(b.closest('[data-m]').dataset.m, b.dataset.p, b.dataset.ans);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(true); });
  load();
})();
