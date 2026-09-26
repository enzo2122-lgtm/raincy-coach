/* Auth: each dirigeant picks his name and creates a password on first use.
   Passwords are never stored: only a PBKDF2 hash with a random salt, kept on this device (not in shared files). */
const Auth = (() => {
  const { esc, $, toast, modal, confirmBox } = UI;
  const KEY = 'raincy-session', ITER = 150000, MIN = 6;
  const enc = new TextEncoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
  async function derive(pw, salt, iter = ITER) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: iter }, key, 256));
  }
  const A = () => (Store.state.auth = Store.state.auth || { users: {} });
  const U = id => A().users[id];
  let user = null, resolveGate = null, fails = 0, lockedUntil = 0;

  const current = () => user;
  const isAdmin = () => !!(user && U(user.id) && U(user.id).admin);
  const hasAccounts = () => Object.values(A().users).some(u => u.hash);
  async function setPassword(id, pw, extra = {}) {
    const salt = newSalt(), hash = await derive(pw, salt);
    A().users[id] = Object.assign(U(id) || {}, { salt, hash, iter: ITER, setAt: Date.now() }, extra);
    Store.save();
  }
  async function check(id, pw) { const u = U(id); return !!(u && u.hash && (await derive(pw, u.salt, u.iter)) === u.hash); }
  async function newRecovery() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(10));
    const code = Array.from(r, x => alphabet[x % alphabet.length]).join('').replace(/(.{5})/, '$1-');
    const salt = newSalt(); A().recovery = { salt, hash: await derive(code, salt) }; Store.save();
    return code;
  }
  async function checkRecovery(code) {
    const r = A().recovery; if (!r) return false;
    return (await derive(code.trim().toUpperCase(), r.salt)) === r.hash;
  }
  function remember(id, keep) { try { sessionStorage.setItem(KEY, id); if (keep) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch (e) {} }
  function restore() {
    let id = null; try { id = sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) {}
    const s = id && Store.get('staff', id);
    if (s && U(id) && U(id).hash) { user = s; return true; }
    return false;
  }
  function logout() {
    try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {}
    user = null; App.refreshChrome(); gate().then(() => App.route());
  }

  /* ---------- lock screen ---------- */
  const lock = () => document.getElementById('lock');
  function frame(inner) {
    const el = lock(); el.hidden = false;
    el.innerHTML = `<div class="lock-card"><img src="icons/crest.png" alt="" class="lock-crest"><p class="eyebrow">Espace éducateurs</p><h1>${esc(Store.state.club.name)}</h1>${inner}</div>`;
    return el;
  }
  const pwFields = (label = 'Mot de passe') => `
    <label class="fld"><span>${label} (au moins ${MIN} caractères)</span><input id="pw1" type="password" autocomplete="new-password" minlength="${MIN}"></label>
    <label class="fld"><span>Retape le mot de passe</span><input id="pw2" type="password" autocomplete="new-password"></label>`;
  const keepBox = `<label class="switch"><input type="checkbox" id="keep" checked><span>Rester connecté sur cet appareil</span></label>`;
  function readNewPw(el) {
    const a = $('#pw1', el).value, b = $('#pw2', el).value;
    if (a.length < MIN) { toast(`Le mot de passe doit faire au moins ${MIN} caractères`, 'err'); return null; }
    if (a !== b) { toast('Les deux mots de passe ne sont pas pareils', 'err'); return null; }
    return a;
  }
  function done(id, keep) {
    user = Store.get('staff', id); remember(id, keep); fails = 0;
    lock().hidden = true; lock().innerHTML = '';
    App.refreshChrome(); toast(`Bonjour ${user.firstName || user.lastName} !`);
    if (resolveGate) { const r = resolveGate; resolveGate = null; r(); }
  }

  function setupScreen() {
    const el = frame(`<p class="lead">Première utilisation : crée le compte du responsable. Tu pourras ajouter les autres dirigeants ensuite.</p>
      <div class="row2"><label class="fld"><span>Nom</span><input id="ln" autocapitalize="characters" autocomplete="family-name"></label>
      <label class="fld"><span>Prénom</span><input id="fn" autocomplete="given-name"></label></div>
      ${pwFields()}${keepBox}
      <button class="btn primary wide" id="go">Créer mon compte</button>`);
    $('#go', el).onclick = async () => {
      const ln = $('#ln', el).value.trim().toUpperCase(), fn = $('#fn', el).value.trim();
      if (!ln && !fn) return toast('Écris ton nom et ton prénom', 'err');
      const pw = readNewPw(el); if (!pw) return;
      let s = Store.state.staff.find(x => (x.lastName || '').toUpperCase() === ln && (x.firstName || '').toLowerCase() === fn.toLowerCase());
      if (!s) s = Store.upsert('staff', { id: Store.uid(), lastName: ln, firstName: fn, role: 'Responsable de catégorie', phone: '', email: '', notes: '', teamIds: [] });
      await setPassword(s.id, pw, { admin: true });
      const code = await newRecovery(), keep = $('#keep', el).checked;
      const el2 = frame(`<p class="lead">Voici ton <b>code de secours</b>. Note-le sur papier et range-le bien : il permet de retrouver l'accès si un mot de passe est oublié.</p>
        <p class="code">${code}</p><button class="btn primary wide" id="ok">J'ai noté le code</button>`);
      $('#ok', el2).onclick = () => done(s.id, keep);
    };
  }

  function loginScreen(preset) {
    const staff = Store.state.staff.slice().sort(Store.byName);
    const el = frame(`<label class="fld"><span>Qui es-tu ?</span><select id="who"><option value="">Choisis ton nom…</option>
      ${staff.map(s => `<option value="${s.id}" ${s.id === preset ? 'selected' : ''}>${esc(Store.fullName(s))}${s.role ? ' · ' + esc(s.role) : ''}</option>`).join('')}</select></label>
      <div id="step"></div>
      <p class="muted small">Tu n'es pas dans la liste ? Demande à un responsable de t'ajouter dans Équipes → Dirigeants.</p>`);
    const step = $('#step', el);
    const render = () => {
      const id = $('#who', el).value;
      if (!id) { step.innerHTML = ''; return; }
      if (U(id) && U(id).hash) {
        step.innerHTML = `<label class="fld"><span>Mot de passe</span><input id="pw" type="password" autocomplete="current-password"></label>${keepBox}
          <button class="btn primary wide" id="go">Se connecter</button><button class="btn wide link" id="forgot">Mot de passe oublié ?</button>`;
        const go = async () => {
          if (Date.now() < lockedUntil) return toast(`Trop d'essais : attends ${Math.ceil((lockedUntil - Date.now()) / 1000)} secondes`, 'err');
          if (await check(id, $('#pw', el).value)) return done(id, $('#keep', el).checked);
          fails++; if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; }
          toast('Mot de passe incorrect', 'err'); $('#pw', el).select();
        };
        $('#go', el).onclick = go; $('#pw', el).onkeydown = e => { if (e.key === 'Enter') go(); };
        $('#forgot', el).onclick = () => forgotScreen(id);
        setTimeout(() => $('#pw', el).focus(), 50);
      } else {
        step.innerHTML = `<p class="tip">Première connexion : choisis ton mot de passe. Garde-le pour toi.</p>${pwFields('Nouveau mot de passe')}${keepBox}
          <button class="btn primary wide" id="go">Créer mon mot de passe</button>`;
        $('#go', el).onclick = async () => { const pw = readNewPw(el); if (!pw) return; await setPassword(id, pw); done(id, $('#keep', el).checked); };
      }
    };
    $('#who', el).onchange = render; render();
  }

  function forgotScreen(id) {
    const s = Store.get('staff', id);
    const el = frame(`<p class="lead">${esc(Store.fullName(s))} : demande à un responsable de réinitialiser ton mot de passe (Réglages → Comptes des dirigeants). Il pourra aussi utiliser le code de secours ici.</p>
      <label class="fld"><span>Code de secours</span><input id="code" autocapitalize="characters" placeholder="XXXXX-XXXXX"></label>
      ${pwFields('Nouveau mot de passe')}
      <button class="btn primary wide" id="go">Changer le mot de passe</button><button class="btn wide link" id="back">Retour</button>`);
    $('#back', el).onclick = () => loginScreen(id);
    $('#go', el).onclick = async () => {
      if (!(await checkRecovery($('#code', el).value))) return toast('Code de secours incorrect', 'err');
      const pw = readNewPw(el); if (!pw) return;
      await setPassword(id, pw); toast('Mot de passe changé'); done(id, false);
    };
  }

  function gate() {
    return new Promise(res => {
      if (restore()) return res();
      resolveGate = res;
      if (!hasAccounts()) setupScreen(); else loginScreen();
    });
  }

  /* ---------- settings section ---------- */
  function settingsSection() {
    if (!user) return '';
    const me = `<section class="card"><h2>${I.whistle}Mon compte</h2>
      <p>Connecté : <b>${esc(Store.fullName(user))}</b>${user.role ? ' · ' + esc(user.role) : ''}${isAdmin() ? ' · <span class="badge">Responsable</span>' : ''}</p>
      <div class="chips"><button class="btn" data-auth="pw">${I.edit}<span>Changer mon mot de passe</span></button>
      <button class="btn" data-auth="logout">${I.back}<span>Se déconnecter</span></button></div></section>`;
    if (!isAdmin()) return me;
    const rows = Store.state.staff.slice().sort(Store.byName).map(s => {
      const u = U(s.id) || {};
      return `<div class="acc-row"><span class="acc-name"><b>${esc(Store.fullName(s))}</b><span class="muted">${u.hash ? 'Mot de passe créé' : 'Pas encore connecté'}</span></span>
        <label class="switch small"><input type="checkbox" data-admin="${s.id}" ${u.admin ? 'checked' : ''} ${s.id === user.id ? 'disabled' : ''}><span>Responsable</span></label>
        <button class="btn" data-reset="${s.id}" ${u.hash && s.id !== user.id ? '' : 'disabled'}>Réinitialiser</button></div>`;
    }).join('');
    return me + `<section class="card"><h2>${I.team}Comptes des dirigeants</h2>
      <p class="muted">Un responsable peut réinitialiser le mot de passe d'un dirigeant : il en recréera un à sa prochaine connexion.</p>
      <div class="acc-list">${rows || '<p class="muted">Ajoute les dirigeants dans Équipes → Dirigeants.</p>'}</div>
      <button class="btn" data-auth="recovery">${I.rotate}<span>Nouveau code de secours</span></button></section>`;
  }
  async function onSettingsClick(b, rerender) {
    if (b.dataset.auth === 'logout') return logout();
    if (b.dataset.auth === 'pw') return modal({ title: 'Changer mon mot de passe', body: `<label class="fld"><span>Mot de passe actuel</span><input id="old" type="password" autocomplete="current-password"></label>${pwFields('Nouveau mot de passe')}`,
      actions: [{ label: 'Annuler' }, { label: 'Changer', kind: 'primary', onClick: (c, r) => {
        (async () => {
          if (!(await check(user.id, $('#old', r).value))) return toast('Mot de passe actuel incorrect', 'err');
          const pw = readNewPw(r); if (!pw) return;
          await setPassword(user.id, pw); c(); toast('Mot de passe changé');
        })(); return false;
      } }] });
    if (b.dataset.auth === 'recovery') {
      if (!(await confirmBox("L'ancien code de secours ne marchera plus. Continuer ?", 'Créer un nouveau code'))) return;
      const code = await newRecovery();
      return modal({ title: 'Nouveau code de secours', body: `<p>Note ce code sur papier et range-le bien.</p><p class="code">${code}</p>`, actions: [{ label: "J'ai noté le code", kind: 'primary' }] });
    }
    if (b.dataset.reset) {
      const s = Store.get('staff', b.dataset.reset);
      if (await confirmBox(`Réinitialiser le mot de passe de ${Store.fullName(s)} ? Il en créera un nouveau à sa prochaine connexion.`, 'Réinitialiser')) {
        const u = U(s.id); delete u.hash; delete u.salt; Store.save(); toast('Mot de passe réinitialisé'); rerender();
      }
    }
  }
  function onSettingsChange(t) {
    if (!t.dataset.admin) return;
    const id = t.dataset.admin; A().users[id] = Object.assign(U(id) || {}, { admin: t.checked }); Store.save();
  }
  function forget(staffId) { delete A().users[staffId]; Store.save(); }

  return { gate, current, isAdmin, logout, settingsSection, onSettingsClick, onSettingsChange, forget };
})();
