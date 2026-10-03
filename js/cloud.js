/* Cloud: the club's shared server (Supabase) for the accounts, the data, the messaging and the pitch planning.
   Since 3.70, FA Le Raincy is a club of the Clubbo server (js/config.js : « club »). Tables are closed (row level security,
   no policy): everything goes through SQL functions (supabase/ea-schema.sql in the Clubbo app) that check the dirigeant's login.
   The tools of the old Raincy server (setup script, « Mettre à jour le serveur », responsable code) were removed in 3.76. */
const Cloud = (() => {
  const builtIn = () => (typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER.url && CLUB_SERVER.key ? CLUB_SERVER : null);
  const session = () => (Store.state.auth && Store.state.auth.session) || null;
  const token = () => { const s = session(); return (s && s.token) || ''; };
  const platform = () => !!(builtIn() || {}).club;
  // Server address (built into the app); the invitation code of the club while a dirigeant joins it
  function cfg() {
    const c = Store.state.club.cloud || {}, b = builtIn() || {};
    return b.url && b.key ? { url: b.url, key: b.key, clubKey: c.clubKey || '' } : null;
  }
  const canLogin = () => !!cfg();
  const access = () => token() || (cfg() || {}).clubKey;
  const ready = () => !!(cfg() && access());
  // A responsable's login is his « responsable code »
  const adminKey = () => (session() && session().admin ? token() : '');
  const ERRORS = {
    COMPTE_INCONNU: 'Aucun compte à ce nom sur le serveur du club.',
    MOT_DE_PASSE: 'Mot de passe incorrect.',
    BLOQUE: 'Trop d\'essais : attends 5 minutes avant de réessayer.',
    DEJA_INSCRIT: 'Ce dirigeant a déjà un mot de passe : connecte-toi, ou demande au responsable de le réinitialiser.',
    ACCES_RETIRE: 'Ton accès à l\'appli du club a été retiré par un responsable.',
    SESSION: 'Ta connexion a expiré : reconnecte-toi.',
    DONNEES: 'Informations incomplètes.',
    CRENEAU_PRIS: 'Ce créneau est déjà pris sur cette partie du terrain. Choisis un autre horaire ou l\'autre moitié.',
    HORS_CRENEAU: 'Cet horaire est en dehors des créneaux disponibles du terrain.',
    CLE_CLUB: 'Ce lien d\'invitation n\'est plus valable : demande le nouveau lien au responsable du club.',
    ADMIN: 'Réservé à un responsable du club.',
    HORAIRE: 'L\'heure de fin doit être après l\'heure de début.',
    LIEN_PARENTS: 'Ce lien n\'est plus valable : demande le nouveau lien au coach.',
    MATCH_PASSE: 'Ce match est passé : les réponses sont fermées.',
    PHOTOS_MAX: '12 photos au plus par match pour les parents.',
    DONNEES_PUSH: 'Abonnement aux notifications refusé par le serveur.',
  };
  function nice(msg) {
    const k = Object.keys(ERRORS).find(x => String(msg).includes(x));
    return k ? ERRORS[k] : 'Le serveur ne répond pas : vérifie la connexion internet.';
  }
  async function rpc(name, args = {}, c = cfg()) {
    if (!c || !c.url) throw new Error('Serveur non configuré');
    const headers = { apikey: c.key, 'Content-Type': 'application/json' };
    if (!String(c.key).startsWith('sb_')) headers.Authorization = 'Bearer ' + c.key;
    let r;
    const body = name in NO_K ? args : Object.assign({ k: access() }, args);
    try { r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch (e) { const err = new Error('Pas de connexion internet.'); err.offline = true; throw err; }
    const txt = await r.text();
    if (!r.ok) {
      let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) {}
      const err = new Error(nice(m)); err.code = Object.keys(ERRORS).find(x => String(m).includes(x)) || '';
      if (r.status === 404 || /could not find the function/i.test(m)) { err.code = 'MISE_A_JOUR'; err.message = 'Le serveur Clubbo est en cours de mise à jour : réessaie dans quelques minutes.'; }
      throw err;
    }
    return txt ? JSON.parse(txt) : null;
  }
  // Functions that identify the dirigeant by his login instead of the club code
  const NO_K = { club_login: 1, club_me: 1, club_teams_done: 1, club_change_pw: 1, club_logout: 1 };
  function genKey(n = 24) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(r, x => a[x % a.length]).join('');
  }
  // Dates always as YYYY-MM-DD, whatever the server sends
  const normDate = b => (b && b.date ? Object.assign(b, { date: String(b.date).slice(0, 10) }) : b);


  /* ---------- API ---------- */
  const api = {
    ping: c => rpc('club_ping', {}, c),
    adminPing: () => rpc('club_admin_ping', { admin_k: adminKey() }),
    messages: since => rpc('club_messages', { since: since || '1970-01-01T00:00:00Z' }),
    post: (channel, body) => { const u = Auth.current(); return rpc('club_post', { p_channel: channel, p_author_id: u.id, p_author_name: Store.fullName(u), p_body: body }); },
    deleteMessage: id => rpc('club_delete_message', { p_id: id, p_author: Auth.current().id, admin_k: adminKey() || null }),
    slots: () => rpc('club_slots'),
    setSlots: list => rpc('club_set_slots', { admin_k: adminKey(), p: list }),
    bookings: async (from, to) => ((await rpc('club_bookings', { d_from: from, d_to: to })) || []).map(normDate),
    book: async b => normDate(await rpc('club_book', { p: b })),
    unbook: id => rpc('club_unbook', { p_id: id, p_author: Auth.current().id, admin_k: adminKey() || null }),
    unbookSeries: series => rpc('club_unbook_series', { p_series: series, p_author: Auth.current().id, admin_k: adminKey() || null }),
    // accounts
    login: (last, first, h) => rpc('club_login', { p_club: (builtIn() || {}).club || null, p_last: last, p_first: first, p_h: h }),
    register: (p, admK) => rpc('club_register', { admin_k: admK || adminKey() || null, p }),
    accounts: () => rpc('club_accounts'),
    accountSet: p => rpc('club_account_set', { admin_k: adminKey(), p }),
    me: () => rpc('club_me', { t: token() }),
    teamsDone: () => rpc('club_teams_done', { t: token() }),
    changePw: (oldH, newH) => rpc('club_change_pw', { t: token(), p_old: oldH, p_new: newH }),
    logout: t => rpc('club_logout', { t }),
    invite: renew => rpc('club_invite', { admin_k: adminKey(), p_new: !!renew }),
    // shared club data
    pull: since => rpc('club_pull', { p_since: since || 0 }),
    push: list => rpc('club_push', { p: list }),
    // parents (3.8)
    memberCodes: (ids, renew) => rpc('club_member_codes', { admin_k: adminKey() || null, p_players: ids, p_renew: renew || [] }),
    memberGiven: (id, given) => rpc('club_member_given', { admin_k: adminKey() || null, p_player: id, p_given: !!given }),
    answers: matchIds => rpc('club_answers', { p_matches: matchIds }),
    // notifications and read receipts (3.15)
    pushKey: () => rpc('club_push_key'),
    pushSub: (endpoint, prefs) => rpc('club_push_sub', { k: token(), p_endpoint: endpoint, p_prefs: prefs }),
    pushUnsub: endpoint => rpc('club_push_unsub', { k: token(), p_endpoint: endpoint }),
    pushTest: () => rpc('club_push_test', { k: token() }),
    markRead: (channel, at) => rpc('club_mark_read', { k: token(), p_channel: channel, p_at: at }),
    reads: channel => rpc('club_reads', { p_channel: channel }),
    photoAdd: (matchId, src, data) => rpc('club_photo_add', { p_match: matchId, p_src: src, p_data: data, p_by: Auth.current() ? Store.fullName(Auth.current()) : '' }),
    photos: matchId => rpc('club_photos', { p_match: matchId }),
    photoGet: id => rpc('club_photo_get', { p_id: id }),
    photoDel: id => rpc('club_photo_del', { p_id: id }),
    setAnswer: (matchId, playerId, status) => rpc('club_set_answer', { p_match: matchId, p_player: playerId, p_status: status || '' }),
    // backups (3.8)
    backups: () => rpc('club_backups', { admin_k: adminKey() }),
    backupNow: () => rpc('club_backup_now', { admin_k: adminKey() }),
    backupGet: id => rpc('club_backup_get', { admin_k: adminKey(), p_id: id }),
    backupAuto: () => rpc('club_backup_auto'),
  };
  const inviteLink = code => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#rejoindre=${encodeURIComponent(code)}`;
  // (3.69) the link of one person: his name is already chosen when he opens it
  async function invitePerson(p) {
    let code;
    try { code = await api.invite(false); } catch (e) { return toast(e.message, 'err'); }
    const link = inviteLink(code) + '&qui=' + encodeURIComponent(p.id), first = p.firstName || '';
    const text = `Bonjour ${first}, voici ton accès à l'appli du club ${Store.state.club.name || ''} : ouvre ce lien, ton nom est déjà choisi, il te reste à créer ton mot de passe. Ensuite, ajoute l'appli à ton écran d'accueil.\n${link}`;
    const ph = String(p.phone || '').replace(/[^\d+]/g, ''), intl = ph.startsWith('+') ? ph.slice(1) : ph.startsWith('0') ? '33' + ph.slice(1) : ph;
    modal({ title: `Le lien de ${first || 'ce dirigeant'}`, noFocus: true, body: `<p class="muted small">Envoie-le à lui seulement : en l'ouvrant, son nom est déjà choisi.</p><textarea id="invTxt" rows="6">${esc(text)}</textarea>`,
      actions: [
        { label: 'WhatsApp', kind: 'primary', icon: I.share, onClick: (c, r) => { window.open(`https://wa.me/${intl}?text=${encodeURIComponent($('#invTxt', r).value)}`, '_blank'); return false; } },
        ...(navigator.share ? [{ label: 'Autre appli', icon: I.share, onClick: (c, r) => { navigator.share({ text: $('#invTxt', r).value }).catch(() => {}); return false; } }] : []),
        { label: 'Copier', icon: I.copy, onClick: (c, r) => { navigator.clipboard.writeText($('#invTxt', r).value).then(() => toast('Message copié')).catch(() => toast('Sélectionne le texte et copie-le')); return false; } }] });
  }
  async function shareInvite(renew) {
    let code;
    try { code = await api.invite(renew); } catch (e) { return toast(e.message, 'err'); }
    const link = inviteLink(code), text = `Raincy Coach : ouvre ce lien pour créer ton mot de passe (première connexion), puis ajoute l'appli à ton écran d'accueil.\n${link}`;
    Store.state.ui.invited = true; Store.save();
    modal({ title: 'Inviter les éducateurs', body: `<p>Envoie ce lien aux dirigeants (WhatsApp, SMS, e-mail). En l'ouvrant, chacun choisit son nom et crée son mot de passe. Ensuite, ils se connectent partout avec <b>nom, prénom et mot de passe</b>.</p>
      <label class="fld"><span>Lien d'invitation</span><input id="invLink" value="${esc(link)}" readonly></label>
      <p class="muted small">Garde ce lien dans le groupe des éducateurs : il donne accès aux données du club. « Nouveau lien » annule l'ancien.</p>`,
      onOpen: r => { const i = $('#invLink', r); i.onclick = () => i.select(); },
      actions: [{ label: 'Nouveau lien', onClick: () => { setTimeout(() => shareInvite(true), 60); } },
        { label: 'Copier', icon: I.copy, onClick: () => { navigator.clipboard.writeText(link).then(() => toast('Lien copié')).catch(() => toast('Sélectionne le lien et copie-le')); return false; } },
        ...(navigator.share ? [{ label: 'Envoyer', kind: 'primary', icon: I.share, onClick: () => { navigator.share({ title: 'Raincy Coach', text }).catch(() => {}); return false; } }] : [])] });
  }

  /* ---------- Réglages → Serveur du club (responsable) ---------- */
  const { esc, $, toast, modal } = UI;
  function settingsSection() {
    const c = cfg(), admin = Auth.isAdmin(), sync = typeof Sync !== 'undefined' ? Sync.status() : '';
    return `<section class="card"><h2>${I.share}Serveur du club (comptes, données, messagerie, planning)</h2>
      <p>${ready() ? `<span class="res res-V">Connecté</span> ${esc(c.url.replace(/^https?:\/\//, ''))}` : '<span class="res res-D">Non connecté</span> Les comptes, le partage des données, la messagerie et le planning ont besoin du serveur du club.'}</p>
      ${sync ? `<p class="muted small">${esc(sync)}</p>` : ''}
      ${admin ? `<div class="chips">${ready() ? `<button class="btn primary" data-cloud="invite">${I.share}<span>Inviter les éducateurs</span></button>` : ''}
        ${!ready() && builtIn() ? `<button class="btn primary" data-cloud="connect">${I.check}<span>Me connecter au serveur du club</span></button>` : ''}
        ${ready() ? `<button class="btn" data-cloud="test">${I.check}<span>Tester</span></button>` : ''}</div>
        ${ready() ? Notify.adminCard() : ''}
        <p class="muted small">Les éducateurs rejoignent le club avec le lien d'invitation, puis se connectent sur n'importe quel appareil avec leur nom et leur mot de passe.</p>`
      : !ready() && builtIn() ? `<div class="chips"><button class="btn primary" data-cloud="connect">${I.check}<span>Me connecter au serveur du club</span></button></div>`
      : `<p class="muted small">${ready() ? 'Tes données sont enregistrées sur le serveur du club : tu les retrouves en te connectant sur un autre appareil.' : 'Demande au responsable le lien d\'invitation du club.'}</p>`}
    </section>`;
  }
  async function onSettingsClick(b, rerender) {
    if (b.dataset.cloud === 'connect') return Auth.connectServer();
    if (b.dataset.cloud === 'invite') return shareInvite(false);
    if (b.dataset.cloud === 'test') {
      try { await api.ping(); toast('Connexion au serveur du club : OK'); } catch (e) { toast(e.message, 'err'); }
    }
  }

  return Object.assign(api, { platform, ready, invitePerson, canLogin, cfg, adminKey, token, genKey, settingsSection, onSettingsClick, shareInvite });
})();
