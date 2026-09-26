/* Cloud: the club's shared server (Supabase) for the messaging and the pitch planning.
   Tables are closed (row level security, no policy). Everything goes through SQL functions that check the club code;
   managing the available slots also needs the responsable code, which only stays on responsables' devices. */
const Cloud = (() => {
  const cfg = () => Store.state.club.cloud || null;
  const ready = () => { const c = cfg(); return !!(c && c.url && c.key && c.clubKey); };
  const adminKey = () => (Store.state.auth && Store.state.auth.cloudAdminKey) || '';
  const ERRORS = {
    CRENEAU_PRIS: 'Ce créneau est déjà pris sur cette partie du terrain. Choisis un autre horaire ou l\'autre moitié.',
    HORS_CRENEAU: 'Cet horaire est en dehors des créneaux disponibles du terrain.',
    CLE_CLUB: 'Le code du club est incorrect : demande au responsable de te renvoyer le fichier du club.',
    ADMIN: 'Réservé à un responsable (code responsable manquant ou incorrect).',
    HORAIRE: 'L\'heure de fin doit être après l\'heure de début.',
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
    try { r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(Object.assign({ k: c.clubKey }, args)) }); }
    catch (e) { throw new Error('Pas de connexion internet.'); }
    const txt = await r.text();
    if (!r.ok) { let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) {} throw new Error(nice(m)); }
    return txt ? JSON.parse(txt) : null;
  }
  function genKey(n = 24) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(r, x => a[x % a.length]).join('');
  }
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";

  /* The script the responsable pastes once in Supabase (SQL Editor → New query → Run) */
  function sql(clubKey, admKey) {
    return `-- Raincy Coach : messagerie et planning des terrains
create table if not exists club_config (id int primary key default 1, club_key_hash text not null, admin_key_hash text not null);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  channel text not null, author_id text, author_name text, body text not null check (length(body) between 1 and 2000));
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  date date not null, start_min int not null, end_min int not null, field text not null default 'T1',
  part text not null check (part in ('full','A','B')), kind text not null default 'entrainement',
  team_id text, team_name text, author_id text, author_name text, note text, series text);
alter table bookings add column if not exists series text;
create table if not exists slots (id uuid primary key default gen_random_uuid(), weekday int not null, start_min int not null, end_min int not null, field text not null default 'T1');
alter table club_config enable row level security;
alter table messages enable row level security;
alter table bookings enable row level security;
alter table slots enable row level security;
insert into club_config (id, club_key_hash, admin_key_hash)
  values (1, encode(sha256(convert_to(${q(clubKey)}, 'UTF8')), 'hex'), encode(sha256(convert_to(${q(admKey)}, 'UTF8')), 'hex'))
  on conflict (id) do update set club_key_hash = excluded.club_key_hash, admin_key_hash = excluded.admin_key_hash;

create or replace function club_ok(k text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_config where id = 1 and club_key_hash = encode(sha256(convert_to(coalesce(k, ''), 'UTF8')), 'hex')) $$;
create or replace function admin_ok(k text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_config where id = 1 and admin_key_hash = encode(sha256(convert_to(coalesce(k, ''), 'UTF8')), 'hex')) $$;
create or replace function club_ping(k text) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; return true; end $$;
create or replace function club_admin_ping(k text, admin_k text) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; return admin_ok(admin_k); end $$;

create or replace function club_messages(k text, since timestamptz default '1970-01-01') returns setof messages language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return query select * from messages where created_at > since order by created_at asc limit 500; end $$;
create or replace function club_post(k text, p_channel text, p_author_id text, p_author_name text, p_body text) returns messages language plpgsql security definer set search_path = public as $$
declare r messages;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  insert into messages (channel, author_id, author_name, body) values (p_channel, p_author_id, p_author_name, p_body) returning * into r; return r; end $$;
create or replace function club_delete_message(k text, p_id uuid, p_author text, admin_k text default null) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  delete from messages where id = p_id and (author_id = p_author or admin_ok(admin_k)); return found; end $$;

create or replace function club_slots(k text) returns setof slots language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; return query select * from slots order by weekday, start_min; end $$;
create or replace function club_set_slots(k text, admin_k text, p jsonb) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  delete from slots where true;
  insert into slots (weekday, start_min, end_min, field) select x.weekday, x.start_min, x.end_min, coalesce(x.field, 'T1') from jsonb_to_recordset(p) as x(weekday int, start_min int, end_min int, field text);
  return true; end $$;

create or replace function club_bookings(k text, d_from date, d_to date) returns setof bookings language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return query select * from bookings where date between d_from and d_to order by date, start_min; end $$;
-- Books a slot. A full pitch blocks everything; two half pitches (A and B) can be used at the same time.
create or replace function club_book(k text, p jsonb) returns bookings language plpgsql security definer set search_path = public as $$
declare r bookings; d date := (p->>'date')::date; s int := (p->>'start_min')::int; e int := (p->>'end_min')::int;
  f text := coalesce(p->>'field', 'T1'); want text := p->>'part'; chosen text;
begin
  if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if e <= s then raise exception 'HORAIRE'; end if;
  perform pg_advisory_xact_lock(hashtext(f || d::text));
  if exists (select 1 from slots where field = f) and not exists (select 1 from slots x where x.field = f and x.weekday = extract(dow from d)::int and x.start_min <= s and x.end_min >= e) then
    raise exception 'HORS_CRENEAU'; end if;
  foreach chosen in array (case when want = 'half' then array['A','B'] else array[want] end) loop
    if not exists (select 1 from bookings b where b.field = f and b.date = d and b.start_min < e and s < b.end_min
                   and (b.part = 'full' or chosen = 'full' or b.part = chosen)) then
      insert into bookings (date, start_min, end_min, field, part, kind, team_id, team_name, author_id, author_name, note, series)
        values (d, s, e, f, chosen, coalesce(p->>'kind', 'entrainement'), p->>'team_id', p->>'team_name', p->>'author_id', p->>'author_name', p->>'note', p->>'series')
        returning * into r;
      return r;
    end if;
  end loop;
  raise exception 'CRENEAU_PRIS';
end $$;
create or replace function club_unbook(k text, p_id uuid, p_author text, admin_k text default null) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  delete from bookings where id = p_id and (author_id = p_author or admin_ok(admin_k)); return found; end $$;
-- Frees every future booking of a weekly series (its author or a responsable)
create or replace function club_unbook_series(k text, p_series text, p_author text, admin_k text default null) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  delete from bookings where series = p_series and date >= current_date and (author_id = p_author or admin_ok(admin_k));
  get diagnostics n = row_count; return n; end $$;
grant execute on function club_unbook_series(text, text, text, text) to anon, authenticated;
grant execute on function club_ping(text), club_admin_ping(text, text), club_messages(text, timestamptz), club_post(text, text, text, text, text),
  club_delete_message(text, uuid, text, text), club_slots(text), club_set_slots(text, text, jsonb), club_bookings(text, date, date),
  club_book(text, jsonb), club_unbook(text, uuid, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
`;
  }

  // Dates always as YYYY-MM-DD, whatever the server sends
  const normDate = b => (b && b.date ? Object.assign(b, { date: String(b.date).slice(0, 10) }) : b);

  // Same script without the codes: safe to run again after an app update (tables and functions are only added or replaced)
  const sqlUpdate = () => sql('x', 'x').replace(/insert into club_config[\s\S]*?excluded\.admin_key_hash;\n/, '-- (codes du club inchangés)\n');

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
  };

  /* ---------- setup (Réglages, responsable) ---------- */
  const { esc, $, toast, modal } = UI;
  function settingsSection() {
    const c = cfg(), admin = Auth.isAdmin();
    return `<section class="card"><h2>${I.share}Serveur du club (messagerie et planning)</h2>
      <p>${ready() ? `<span class="res res-V">Connecté</span> ${esc(c.url.replace(/^https?:\/\//, ''))}` : '<span class="res res-D">Non connecté</span> La messagerie et le planning des terrains ont besoin du serveur du club.'}</p>
      ${admin ? `<div class="chips"><button class="btn primary" data-cloud="setup">${I.edit}<span>${ready() ? 'Reconfigurer' : 'Configurer le serveur'}</span></button>
        ${ready() ? `<button class="btn" data-cloud="test">${I.check}<span>Tester</span></button><button class="btn" data-cloud="update">${I.rotate}<span>Mettre à jour le serveur</span></button><button class="btn" data-cloud="adminkey">${I.whistle}<span>Code responsable</span></button>` : ''}</div>
        <p class="muted small">Les autres éducateurs reçoivent la connexion avec « Envoyer toutes mes données » (le fichier du club).</p>`
      : `<p class="muted small">${ready() ? 'La connexion vient du fichier du club.' : 'Demande au responsable de t\'envoyer le fichier du club (Réglages → Envoyer toutes mes données), puis fais Recevoir un fichier.'}</p>`}
    </section>`;
  }
  function wizard(rerender) {
    const clubKey = genKey(), admKey = genKey(), script = sql(clubKey, admKey);
    modal({ title: 'Configurer le serveur du club', body: `
      <ol class="wizard">
        <li><b>Crée un compte gratuit</b> sur <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a>, puis un <b>New project</b> (nom : raincy-coach, région : Europe). Note le mot de passe de la base, il ne sert qu'à Supabase.</li>
        <li>Dans le projet : <b>SQL Editor → New query</b>. Copie le script ci-dessous, colle-le, puis touche <b>Run</b>. Il doit afficher « Success ».
          <textarea id="cloudSql" rows="5" readonly>${esc(script)}</textarea>
          <button class="btn" id="copySql">${I.copy}<span>Copier le script</span></button></li>
        <li>Dans <b>Project Settings → API</b> (ou <b>Connect</b>) : copie la <b>Project URL</b> et la clé publique (<b>anon</b> ou <b>publishable</b>, jamais la clé « secret » ou « service_role »), puis colle-les ici.
          <label class="fld"><span>Project URL</span><input id="cUrl" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off"></label>
          <label class="fld"><span>Clé publique (anon / publishable)</span><input id="cKey" autocapitalize="off" autocorrect="off"></label></li>
      </ol>
      <p class="tip">Le script contient deux codes générés pour ton club : le <b>code du club</b> (partagé avec les éducateurs dans le fichier du club) et le <b>code responsable</b> (gardé seulement sur ton appareil, pour gérer les créneaux).</p>`,
      onOpen: r => { $('#copySql', r).onclick = async () => { try { await navigator.clipboard.writeText(script); toast('Script copié'); } catch (e) { const t = $('#cloudSql', r); t.focus(); t.select(); toast('Sélectionne le texte et copie-le'); } }; },
      actions: [{ label: 'Annuler' }, { label: 'Tester et enregistrer', kind: 'primary', onClick: (close, r) => {
        const url = $('#cUrl', r).value.trim().replace(/\/+$/, ''), key = $('#cKey', r).value.trim();
        if (!/^https:\/\/.+/.test(url) || !key) { toast('Colle la Project URL et la clé publique', 'err'); return false; }
        if (/service_role|sb_secret_/.test(key)) { toast('Cette clé est secrète : utilise la clé publique (anon ou publishable)', 'err'); return false; }
        const c = { url, key, clubKey };
        (async () => {
          const b = UI.busy('Test de la connexion…');
          try {
            await api.ping(c);
            Store.state.club.cloud = c; Store.state.auth.cloudAdminKey = admKey; Store.save();
            close(); toast('Serveur connecté !'); rerender && rerender();
          } catch (e) { toast(e.message.includes('code du club') ? 'Le script n\'a pas été exécuté (ou pas en entier) dans Supabase' : e.message, 'err'); }
          finally { b.done(); }
        })();
        return false;
      } }] });
  }
  async function onSettingsClick(b, rerender) {
    if (b.dataset.cloud === 'setup') return wizard(rerender);
    if (b.dataset.cloud === 'test') {
      try { await api.ping(); const adm = adminKey() ? await api.adminPing() : false; toast(`Connexion OK${adm ? ' · code responsable valide' : ''}`); } catch (e) { toast(e.message, 'err'); }
    }
    if (b.dataset.cloud === 'update') {
      const script = sqlUpdate();
      return modal({ title: 'Mettre à jour le serveur', body: `
        <p>Après une mise à jour de l'appli, le serveur a parfois besoin de nouvelles fonctions. Ce script les ajoute <b>sans changer les codes du club</b> ni effacer les messages et réservations.</p>
        <ol class="wizard"><li>Touche <b>Copier le script</b>.</li>
        <li>Ouvre <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com/dashboard</a>, puis ton projet <b>raincy-coach</b>.</li>
        <li>Dans le menu de gauche : <b>SQL Editor</b> → <b>New query</b>. Colle le script, puis touche <b>Run</b>. Il doit afficher « Success ».</li>
        <li>Reviens ici et touche <b>Tester</b>.</li></ol>
        <textarea id="updSql" rows="4" readonly>${esc(script)}</textarea>`,
        onOpen: r => {},
        actions: [{ label: 'Fermer' }, { label: 'Copier le script', kind: 'primary', icon: I.copy, onClick: (c, r) => {
          navigator.clipboard.writeText(script).then(() => toast('Script copié : colle-le dans Supabase')).catch(() => { const t = $('#updSql', r); t.focus(); t.select(); toast('Sélectionne le texte et copie-le'); });
          return false; } }] });
    }
    if (b.dataset.cloud === 'adminkey') {
      modal({ title: 'Code responsable', body: `<p>Ce code permet de gérer les créneaux disponibles du terrain. Pour l'utiliser sur un autre appareil de responsable, recopie-le là-bas.</p>
        <label class="fld"><span>Code responsable</span><input id="admKey" value="${esc(adminKey())}" autocapitalize="off" autocorrect="off"></label>`,
        actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { Store.state.auth.cloudAdminKey = $('#admKey', r).value.trim(); Store.save(); toast('Code enregistré'); } }] });
    }
  }

  return Object.assign(api, { ready, cfg, adminKey, settingsSection, onSettingsClick });
})();
