/* Small UI helpers: escaping, toasts, modal sheets, confirmations, thumbnails. */
const UI = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = 'toast', 2600);
  }

  // modal({title, body, actions:[{label, kind:'primary'|'danger'|'', onClick(close, root) -> false keeps it open}] , onOpen(root)})
  function modal(o) {
    const root = $('#modal');
    root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
      <div class="sheet-head"><h2 id="mTitle">${esc(o.title || '')}</h2><button class="icon-btn" data-close aria-label="Fermer">${I.x}</button></div>
      <div class="sheet-body">${o.body || ''}</div>
      ${o.actions && o.actions.length ? `<div class="sheet-foot">${o.actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-i="${i}">${a.icon || ''}<span>${esc(a.label)}</span></button>`).join('')}</div>` : ''}
    </div>`;
    root.hidden = false;
    const close = () => { root.hidden = true; root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.onclick = e => {
      if (e.target === root || e.target.closest('[data-close]')) return close();
      const b = e.target.closest('.sheet-foot [data-i]');
      if (b) { const a = o.actions[+b.dataset.i]; if (!a.onClick || a.onClick(close, root) !== false) close(); }
    };
    if (o.onOpen) o.onOpen(root, close);
    const first = root.querySelector('input,select,textarea'); if (first && !o.noFocus) setTimeout(() => first.focus(), 60);
    return close;
  }
  function confirmBox(text, okLabel = 'Supprimer') {
    return new Promise(res => modal({ title: 'Es-tu sûr ?', body: `<p class="lead">${esc(text)}</p>`, noFocus: true,
      actions: [{ label: 'Annuler', onClick: () => res(false) }, { label: okLabel, kind: 'danger', onClick: () => res(true) }] }));
  }
  function busy(text) {
    const root = $('#busy'); root.hidden = false;
    root.innerHTML = `<div class="busy-card"><div class="spinner"></div><p>${esc(text)}</p><div class="bar"><i></i></div></div>`;
    return { progress: p => { const i = root.querySelector('.bar i'); if (i) i.style.width = Math.round(p * 100) + '%'; }, done: () => { root.hidden = true; root.innerHTML = ''; } };
  }

  // Thumbnails of schemas, cached per update
  const thumbCache = new Map();
  function thumb(sc, w = 480, h = 312) {
    const key = sc.id + ':' + (sc.updatedAt || 0) + ':' + w;
    if (thumbCache.has(key)) return thumbCache.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    Board.drawFrame(c.getContext('2d'), w, h, sc, 0, 0, { homeBib: Store.state.club.homeBib });
    const url = c.toDataURL('image/jpeg', .8); thumbCache.set(key, url); return url;
  }

  const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', opts) : '';
  const today = () => new Date().toISOString().slice(0, 10);
  const accentFor = bib => ({ jaune: '#a16207', blanc: '#13245a', vert: '#3f7d0a', orange: '#c2410c' }[bib] || (Board.BIBS[bib] || Board.BIBS.bleu)[0]);

  return { esc, $, $$, toast, modal, confirmBox, busy, thumb, fmtDate, today, accentFor };
})();
