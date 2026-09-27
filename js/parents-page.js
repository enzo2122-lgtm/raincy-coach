/* Page for the parents (parents.html#t=LINK): read only, one category, no account.
   Shows the matches (time, place, convocation, car sharing), the next sessions, and lets a parent answer
   « présent » or « absent » for a convoked child. It only talks to the club server through parent_view / parent_answer. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hh = x => String(x || '').replace(':', 'h');
  const fmt = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', o) : '';
  const KIDS = 'raincy-parent-kids';
  const token = (location.hash.match(/t=([A-Za-z0-9]+)/) || [])[1] || '';
  let data = null;

  const mine = () => { try { return JSON.parse(localStorage.getItem(KIDS)) || []; } catch (e) { return []; } };
  const remember = id => { try { const l = mine(); if (!l.includes(id)) localStorage.setItem(KIDS, JSON.stringify([...l, id].slice(-6))); } catch (e) {} };

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
      if (/LIEN_PARENTS/.test(m)) throw new Error('Ce lien n\'est plus valable : demande le nouveau lien au coach de l\'équipe.');
      if (/MATCH_PASSE/.test(m)) throw new Error('Ce match est passé : les réponses sont fermées.');
      if (r.status === 404 || /could not find the function/i.test(m)) throw new Error('La page des parents n\'est pas encore prête : le club doit mettre à jour son serveur.');
      throw new Error('Le serveur ne répond pas. Réessaie dans un instant.');
    }
    return txt ? JSON.parse(txt) : null;
  }

  const result = m => !m.played ? '' : +m.gf > +m.ga ? 'V' : +m.gf < +m.ga ? 'D' : 'N';
  const RES = { V: 'Gagné', D: 'Perdu', N: 'Nul' };
  const mapLink = place => `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener noreferrer">${esc(place)}</a>`;

  // A calendar file (.ics) for one match or all of them: the phone offers to add it to its agenda
  const icsDate = (d, t) => d.replace(/-/g, '') + 'T' + (t || '10:00').replace(':', '') + '00';
  function ics(list) {
    const club = (data.club && data.club.name) || 'FA Le Raincy', esc2 = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const ev = m => { const start = m.rdv || m.time || '10:00', [h, mi] = (m.time || start).split(':').map(Number), end = String(Math.min(23, h + 2)).padStart(2, '0') + ':' + String(mi || 0).padStart(2, '0');
      return ['BEGIN:VEVENT', 'UID:raincy-' + m.id + '@raincy-coach', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + icsDate(m.date, start), 'DTEND:' + icsDate(m.date, end),
        'SUMMARY:' + esc2(`⚽ ${data.team} : ${m.home ? club + ' – ' + (m.opponent || '?') : (m.opponent || '?') + ' – ' + club}`),
        'LOCATION:' + esc2(m.place || (m.home ? (data.club && data.club.fieldName) || '' : '')),
        'DESCRIPTION:' + esc2(`${m.home ? 'À domicile' : 'À l\'extérieur'}${m.rdv ? ' · rendez-vous ' + hh(m.rdv) : ''}${m.time ? ' · coup d\'envoi ' + hh(m.time) : ''}\nInfos et réponses : ${location.href}`),
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Match', 'END:VALARM', 'END:VEVENT'].join('\r\n'); };
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Raincy Coach//Parents//FR', 'CALSCALE:GREGORIAN', ...list.map(ev), 'END:VCALENDAR'].join('\r\n');
  }
  function download(text, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  // photos shared by the coach (loaded when the card is shown)
  const photoData = {};
  async function loadPhotos() {
    for (const el of document.querySelectorAll('[data-photo]')) {
      const id = el.dataset.photo;
      if (!photoData[id]) { try { photoData[id] = await rpc('parent_photo', { p_token: token, p_id: id }); } catch (e) { continue; } }
      if (photoData[id]) el.innerHTML = `<img alt="Photo du match" src="${photoData[id]}" loading="lazy">`;
    }
  }

  function matchCard(m) {
    const club = (data.club && data.club.name) || 'FA Le Raincy', us = `<b>${esc(club)}</b>`, them = esc(m.opponent || '?');
    if (m.exempt) return `<article class="card"><div class="m-date">${esc(fmt(m.date))}</div><div class="m-title">Exempt · pas de match</div></article>`;
    const place = m.place || (m.home ? (data.club && data.club.fieldName) || '' : '');
    const kids = m.players || [], me = mine(), r = result(m);
    const yes = kids.filter(k => k.answer === 'oui').length, no = kids.filter(k => k.answer === 'non').length;
    const seatSel = k => m.home ? '' : `<select class="seats" data-seats="${esc(k.id)}" aria-label="Places libres dans ma voiture">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${+k.seats === n ? 'selected' : ''}>${n ? `🚗 ${n} place${n > 1 ? 's' : ''} libre${n > 1 ? 's' : ''}` : '🚗 pas de place'}</option>`).join('')}</select>`;
    return `<article class="card ${m.home ? 'home' : 'away'}" data-m="${esc(m.id)}">
      <div class="m-date">${esc(fmt(m.date))}${m.team && m.team !== data.team ? ` · ${esc(m.team)}` : ''}</div>
      <div class="m-title">${m.home ? `${us} <i>contre</i> ${them}` : `${them} <i>contre</i> ${us}`}</div>
      <span class="tag">${m.home ? '🏠 À domicile' : '🚌 À l\'extérieur'}</span>${m.competition ? `<span class="tag">${esc(m.competition)}</span>` : ''}
      ${m.played ? `<p><span class="score">${m.home ? `${esc(m.gf)} – ${esc(m.ga)}` : `${esc(m.ga)} – ${esc(m.gf)}`}</span>${r ? `<span class="res ${r}">${RES[r]}</span>` : ''}</p>` : `
        <p class="info">${m.rdv ? `🕘 Rendez-vous <b>${esc(hh(m.rdv))}</b>` : ''}${m.rdv && m.time ? ' · ' : ''}${m.time ? `coup d'envoi <b>${esc(hh(m.time))}</b>` : ''}${!m.rdv && !m.time ? '🕘 Horaire à confirmer' : ''}</p>
        ${place ? `<p class="info">📍 ${mapLink(place)}</p>` : ''}`}
      ${m.open && kids.length ? `<p class="info"><b>Convoqués (${kids.length})</b> · touche « Présent » ou « Absent » pour ton enfant.</p>
        <ul class="kids">${kids.map(k => `<li class="kid ${me.includes(k.id) ? 'mine' : ''}"><span class="nm">${esc(k.name)}</span>
          <span class="st ${esc(k.answer || '')}">${k.answer === 'oui' ? '✓ présent' : k.answer === 'non' ? '✗ absent' : 'pas de réponse'}</span>
          <span class="btns"><button class="b yes ${k.answer === 'oui' ? 'on' : ''}" data-ans="oui" data-p="${esc(k.id)}">Présent</button><button class="b no ${k.answer === 'non' ? 'on' : ''}" data-ans="non" data-p="${esc(k.id)}">Absent</button>${k.answer === 'oui' ? seatSel(k) : ''}</span></li>`).join('')}</ul>
        <p class="sum">✓ ${yes} présent${yes > 1 ? 's' : ''} · ✗ ${no} absent${no > 1 ? 's' : ''} · ${kids.length - yes - no} sans réponse</p>` : m.open ? '<p class="info">La liste des convoqués n\'est pas encore publiée.</p>' : ''}
      ${!m.played && !m.exempt && m.date >= new Date().toISOString().slice(0, 10) ? `<p><button class="b cal" data-cal="${esc(m.id)}">📅 Ajouter à mon agenda</button></p>` : ''}
      ${(m.photos || []).length ? `<div class="photos">${m.photos.map(id => `<a class="ph" data-photo="${esc(id)}" href="#" role="button" aria-label="Voir la photo"><span class="muted small">Photo…</span></a>`).join('')}</div>` : ''}
      ${!m.home && (m.carpool || []).length && !m.played ? `<div class="car-list"><p class="info"><b>🚗 Covoiturage</b></p>${m.carpool.map(c => `<div class="car"><b>${esc(c.driver || 'Voiture')}</b>
        <span class="muted small">${c.time ? `départ ${esc(hh(c.time))}` : ''}${c.from ? ` · ${esc(c.from)}` : ''} · ${(c.kids || []).length}/${esc(c.seats || '?')} places</span>
        ${(c.kids || []).length ? `<div class="small">${c.kids.map(esc).join(', ')}</div>` : ''}</div>`).join('')}</div>` : ''}
    </article>`;
  }

  function render() {
    const d = new Date(), now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const club = (data.club && data.club.name) || 'FA Le Raincy';
    document.title = `${data.team} · ${club} · Parents`;
    $('#club').textContent = `${club} · Espace parents`; $('#team').textContent = data.team || 'Équipe';
    const ms = data.matches || [], up = ms.filter(m => !m.played && m.date >= now), past = ms.filter(m => m.played || m.date < now).reverse();
    const trs = data.trainings || [];
    $('#page').innerHTML = `
      ${(data.coaches || []).length ? `<h2>Les coachs</h2><div class="card">${data.coaches.map(c => `<div class="tr"><span class="d">${esc(c.name)}</span><span>${c.role ? esc(c.role) + ' · ' : ''}<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a></span></div>`).join('')}</div>` : ''}
      <h2>Prochains matchs</h2>${up.length > 1 ? '<p><button class="b cal" data-calall>📅 Ajouter tous les matchs à mon agenda</button></p>' : ''}${up.length ? up.map(matchCard).join('') : '<p class="tip">Pas de match prévu pour l\'instant.</p>'}
      ${trs.length ? `<h2>Entraînements (2 semaines)</h2><div class="card">${trs.map(t => `<div class="tr"><span class="d">${esc(fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span>${t.time ? esc(hh(t.time)) + ' · ' : ''}${esc(t.title || 'Entraînement')}</span></div>`).join('')}</div>` : ''}
      ${past.length ? `<h2>Derniers résultats</h2>${past.map(matchCard).join('')}` : ''}
      <div id="phView" class="ph-view" hidden></div>
      <p class="tip">Ajoute cette page à ton écran d'accueil (Partager → « Sur l'écran d'accueil ») pour la retrouver. Ne la transfère pas en dehors des parents de l'équipe. Une question ? Écris au coach.</p>`;
  }

  async function load(quiet) {
    if (!token) { $('#team').textContent = 'Lien incomplet'; $('#page').innerHTML = '<p class="tip">Ce lien est incomplet. Ouvre le lien envoyé par le coach dans le groupe des parents.</p>'; return; }
    try { data = await rpc('parent_view', { p_token: token }); render(); loadPhotos(); }
    catch (e) { if (quiet && data) return; $('#team').textContent = 'Espace parents'; $('#page').innerHTML = `<p class="tip">${esc(e.message)}</p><p><button class="b" id="again">Réessayer</button></p>`; const a = $('#again'); if (a) a.onclick = () => load(); }
  }

  async function answer(matchId, playerId, status, seats) {
    const m = data.matches.find(x => x.id === matchId), k = m && (m.players || []).find(x => x.id === playerId); if (!k) return;
    const before = { answer: k.answer, seats: k.seats };
    Object.assign(k, { answer: status, seats: seats || 0 }); remember(playerId); render();
    try { await rpc('parent_answer', { p_token: token, p_match: matchId, p_player: playerId, p_status: status, p_seats: seats || 0 }); toast(status === 'oui' ? `Merci ! ${k.name} est noté présent.` : `Merci ! ${k.name} est noté absent.`); }
    catch (e) { Object.assign(k, before); render(); toast(e.message, true); }
  }

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-cal], [data-calall]');
    if (c) { const now = new Date().toISOString().slice(0, 10), list = c.dataset.cal ? data.matches.filter(m => m.id === c.dataset.cal) : data.matches.filter(m => !m.played && !m.exempt && m.date >= now);
      download(ics(list), c.dataset.cal ? `match-${list[0].date}.ics` : `matchs-${data.team}.ics`); return; }
    const ph = e.target.closest('[data-photo]');
    if (ph) { e.preventDefault(); const v = $('#phView'), src = photoData[ph.dataset.photo]; if (src) { v.innerHTML = `<img alt="Photo du match" src="${src}"><p>Touche pour fermer</p>`; v.hidden = false; } return; }
    if (e.target.closest('#phView')) { $('#phView').hidden = true; return; }
    const b = e.target.closest('[data-ans]'); if (!b) return;
    const card = b.closest('[data-m]'), m = data.matches.find(x => x.id === card.dataset.m), k = (m.players || []).find(x => x.id === b.dataset.p);
    answer(card.dataset.m, b.dataset.p, b.dataset.ans, b.dataset.ans === 'oui' ? (k && k.seats) || 0 : 0);
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-seats]'); if (!s) return;
    answer(s.closest('[data-m]').dataset.m, s.dataset.seats, 'oui', +s.value);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(true); });
  load();
})();
