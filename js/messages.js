/* Messages: the coaches' internal messaging, through the club server.
   Channels: the whole club, one per category, and private conversations between two coaches. */
const Messages = (() => {
  const { esc, $, $$, toast, confirmBox } = UI;
  const S = () => Store.state;
  const CACHE = 'raincy-msgs', READ = 'raincy-msg-read';
  let msgs = [], last = '1970-01-01T00:00:00Z', timer = null, fast = false, busy = false;

  try { msgs = JSON.parse(localStorage.getItem(CACHE)) || []; if (msgs.length) last = msgs[msgs.length - 1].created_at; } catch (e) {}
  const reads = () => { try { return JSON.parse(localStorage.getItem(READ)) || {}; } catch (e) { return {}; } };
  const markRead = ch => { const r = reads(); r[ch] = new Date().toISOString(); try { localStorage.setItem(READ, JSON.stringify(r)); } catch (e) {} };
  const me = () => Auth.current();
  const dmKey = (a, b) => 'dm:' + [a, b].sort().join(':');
  const isMineDm = ch => ch.startsWith('dm:') && me() && ch.split(':').includes(me().id);
  function visible(ch) {
    if (ch === 'general') return true;
    if (ch.startsWith('team:')) return true; // every coach can talk in every category
    return isMineDm(ch);
  }
  // In the messaging everybody is « Coach » + first name (« Coach Karim »); « Giova (Christian) » shows as « Coach Giova »
  function coachName(s) {
    const f = String(s.firstName || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0];
    return 'Coach ' + (f ? f.charAt(0).toUpperCase() + f.slice(1) : String(s.lastName || '').charAt(0) + String(s.lastName || '').slice(1).toLowerCase());
  }
  const staffOf = m => m.author_id && Store.get('staff', m.author_id);
  const redraw = () => { if (location.hash.startsWith('#/messages')) App.route(true); };
  const crestOf = s => s && s.club ? Clubs.crest(s.club, 18, redraw) : '';
  function authorName(m) {
    const s = m.author_id && Store.get('staff', m.author_id);
    if (s) return coachName(s);
    const n = String(m.author_name || '').trim(), first = n.split(/\s+/).find(w => w !== w.toUpperCase());
    return first ? 'Coach ' + first : n || '?';
  }
  function channelName(ch) {
    if (ch === 'general') return 'Tout le club · tous les coachs';
    if (ch.startsWith('team:')) { const t = Store.get('teams', ch.slice(5)); return t ? t.name : 'Catégorie'; }
    const other = ch.split(':').slice(1).find(id => id !== (me() || {}).id), s = Store.get('staff', other);
    return s ? coachName(s) : 'Message privé';
  }
  const unread = ch => { const r = reads()[ch] || '1970'; return msgs.filter(m => m.channel === ch && m.created_at > r && m.author_id !== (me() || {}).id).length; };
  const totalUnread = () => [...new Set(msgs.map(m => m.channel))].filter(visible).reduce((a, ch) => a + unread(ch), 0);

  async function fetchNew() {
    if (busy || !Cloud.ready() || !me()) return false;
    busy = true;
    try {
      const fresh = await Cloud.messages(last);
      if (fresh && fresh.length) {
        const ids = new Set(msgs.map(m => m.id));
        fresh.forEach(m => { if (!ids.has(m.id)) msgs.push(m); });
        msgs.sort((a, b) => a.created_at.localeCompare(b.created_at)); msgs = msgs.slice(-800);
        last = msgs[msgs.length - 1].created_at;
        try { localStorage.setItem(CACHE, JSON.stringify(msgs)); } catch (e) {}
        return true;
      }
    } catch (e) {} finally { busy = false; }
    return false;
  }
  function badge() {
    const n = totalUnread(), a = document.querySelector('#nav a[href="#/messages"]'); if (!a) return;
    let b = a.querySelector('.nav-badge'); if (!b) { b = document.createElement('i'); b.className = 'nav-badge'; a.appendChild(b); }
    b.textContent = n > 9 ? '9+' : n; b.hidden = !n;
  }
  function start() {
    clearInterval(timer);
    const tick = async () => { const changed = await fetchNew(); badge(); if (changed && fast && onNew) onNew(); };
    tick(); timer = setInterval(tick, fast ? 6000 : 45000);
  }
  let onNew = null;

  /* ---------- page ---------- */
  function page(root, chParam) {
    if (!Cloud.ready()) {
      root.innerHTML = `<header class="page-head"><div><h1>Messages</h1><p class="sub">La messagerie des éducateurs du club</p></div></header>
        <div class="empty"><p>La messagerie passe par le serveur du club, qui n'est pas encore connecté sur cet appareil.</p>
        ${Auth.isAdmin() ? `<a class="btn primary" href="#/reglages">${I.settings}<span>Configurer le serveur</span></a>` : '<p class="muted">Déconnecte-toi puis reconnecte-toi avec ton nom et ton mot de passe. Si ça ne marche pas, préviens le responsable.</p>'}</div>`;
      return;
    }
    const ch = chParam && visible(decodeURIComponent(chParam)) ? decodeURIComponent(chParam) : '';
    const mineTeams = new Set((me().teamIds || []));
    const teams = S().teams.slice(); // club order: U6 … Vétérans
    const dms = [...new Set(msgs.map(m => m.channel).filter(isMineDm))];
    const item = c => `<a class="ch ${c === ch ? 'on' : ''}" href="#/messages/${encodeURIComponent(c)}"><span class="ch-ic">${c === 'general' ? I.team : c.startsWith('team:') ? I.whistle : (crestOf(Store.get('staff', c.split(':').slice(1).find(id => id !== (me() || {}).id))) || I.edit)}</span>
      <span class="ch-name">${esc(channelName(c))}</span>${unread(c) ? `<i class="ch-badge">${unread(c)}</i>` : ''}</a>`;
    root.innerHTML = `<div class="msg-layout ${ch ? 'has-ch' : ''}">
      <aside class="ch-list">
        <header class="page-head"><div><h1>Messages</h1><p class="sub">Entre éducateurs du club</p></div></header>
        ${item('general')}
        ${mineTeams.size ? `<div class="ch-sec">Mes catégories</div>${teams.filter(t => mineTeams.has(t.id)).map(t => item('team:' + t.id)).join('')}` : ''}
        <div class="ch-sec">${mineTeams.size ? 'Les autres catégories' : 'Catégories'}</div>${teams.filter(t => !mineTeams.has(t.id)).map(t => item('team:' + t.id)).join('')}
        <div class="ch-sec">Messages privés</div>${dms.map(item).join('')}
        <button class="btn soft wide" id="newDm">${I.plus}<span>Écrire à un éducateur</span></button>
      </aside>
      <section class="conv">${ch ? `
        <header class="conv-head"><a class="icon-btn conv-back" href="#/messages" aria-label="Retour">${I.back}</a><b>${esc(channelName(ch))}</b></header>
        <div class="conv-body" id="convBody"></div>
        <form class="composer" id="composer"><textarea id="msgText" rows="1" maxlength="2000" placeholder="Écris ton message…" aria-label="Message"></textarea>
          <button class="btn primary" type="submit" aria-label="Envoyer">${I.upload}</button></form>`
        : '<div class="conv-empty"><p class="muted">Choisis une conversation.</p></div>'}</section></div>`;
    $('#newDm', root).onclick = pickCoach;
    if (!ch) { fast = false; onNew = () => page(root); start(); return; }
    markRead(ch); badge();
    const body = $('#convBody', root);
    const draw = () => {
      const list = msgs.filter(m => m.channel === ch);
      let day = '';
      body.innerHTML = list.length ? list.map(m => {
        const d = new Date(m.created_at), ds = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const sep = ds !== day ? `<div class="day-sep">${esc(ds)}</div>` : ''; day = ds;
        const mine = m.author_id === me().id;
        return `${sep}<div class="bubble ${mine ? 'mine' : ''}" data-m="${m.id}">${mine ? '' : `<b class="author">${crestOf(staffOf(m))}${esc(authorName(m))}</b>`}<p>${esc(m.body).replace(/\n/g, '<br>')}</p>
          <span class="time">${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${mine || Auth.isAdmin() ? ` · <button class="linkish" data-delm="${m.id}">supprimer</button>` : ''}</span></div>`;
      }).join('') : '<p class="muted conv-hint">Pas encore de message. Écris le premier !</p>';
      body.scrollTop = body.scrollHeight;
    };
    draw();
    const ta = $('#msgText', root);
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); $('#composer', root).requestSubmit(); } };
    $('#composer', root).onsubmit = async e => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      ta.value = ''; ta.oninput();
      try { const m = await Cloud.post(ch, text); if (m && !msgs.some(x => x.id === m.id)) { msgs.push(m); last = m.created_at > last ? m.created_at : last; try { localStorage.setItem(CACHE, JSON.stringify(msgs)); } catch (e2) {} } markRead(ch); draw(); }
      catch (err) { ta.value = text; toast(err.message, 'err'); }
    };
    body.onclick = async e => {
      const b = e.target.closest('[data-delm]'); if (!b) return;
      if (!(await confirmBox('Supprimer ce message pour tout le monde ?'))) return;
      try { await Cloud.deleteMessage(b.dataset.delm); msgs = msgs.filter(m => m.id !== b.dataset.delm); try { localStorage.setItem(CACHE, JSON.stringify(msgs)); } catch (e2) {} draw(); }
      catch (err) { toast(err.message, 'err'); }
    };
    fast = true; onNew = () => { if (location.hash.startsWith('#/messages/')) { markRead(ch); draw(); badge(); } }; start();
    setTimeout(() => ta.focus(), 100);
  }
  function pickCoach() {
    const others = S().staff.filter(s => s.id !== me().id).sort(Store.byName);
    const close = UI.modal({ title: 'Écrire à un éducateur', noFocus: true,
      body: others.length ? `<div class="people">${others.map(s => `<button class="person-main" data-to="${s.id}"><span class="pnum role">${I.whistle}</span><span class="pmain"><b class="author">${crestOf(s)}${esc(coachName(s))}</b><span class="muted">${esc([s.role, (s.teamIds || []).map(id => (Store.get('teams', id) || {}).name).filter(Boolean).join(', '), s.club ? 'club de cœur : ' + Clubs.name(s.club) : ''].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>` : '<p class="muted">Aucun autre dirigeant dans l\'appli.</p>',
      onOpen: r => $$('[data-to]', r).forEach(b => b.onclick = () => { close(); location.hash = '#/messages/' + encodeURIComponent(dmKey(me().id, b.dataset.to)); }) });
  }
  function leave() { fast = false; onNew = null; start(); }

  return { page, start, badge, leave };
})();
