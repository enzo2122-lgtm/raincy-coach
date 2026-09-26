/* Cloud: the club's shared server (Supabase) for the messaging and the pitch planning.
   Tables are closed (row level security, no policy). Everything goes through SQL functions that check the club code;
   managing the available slots also needs the responsable code, which only stays on responsables' devices. */
const Cloud = (() => {
  const builtIn = () => (typeof CLUB_SERVER !== 'undefined' && CLUB_SERVER.url && CLUB_SERVER.key ? CLUB_SERVER : null);
  const session = () => (Store.state.auth && Store.state.auth.session) || null;
  const token = () => { const s = session(); return (s && s.token) || ''; };
  const ownAdminKey = () => (Store.state.auth && Store.state.auth.cloudAdminKey) || '';
  // Server address: the one of the club file / setup if any, otherwise the one built into the app
  function cfg() {
    const c = Store.state.club.cloud || {}, b = builtIn() || {};
    const url = c.url || b.url, key = c.url ? c.key : b.key;
    return url && key ? { url, key, clubKey: c.clubKey || '' } : null;
  }
  const canLogin = () => !!cfg();
  const access = () => token() || ownAdminKey() || (cfg() || {}).clubKey;
  const ready = () => !!(cfg() && access());
  // A responsable's login works as responsable code; the code itself stays only where it was created
  const adminKey = () => ownAdminKey() || (session() && session().admin ? token() : '');
  const ERRORS = {
    COMPTE_INCONNU: 'Aucun compte à ce nom sur le serveur du club.',
    MOT_DE_PASSE: 'Mot de passe incorrect.',
    BLOQUE: 'Trop d\'essais : attends 5 minutes avant de réessayer.',
    DEJA_INSCRIT: 'Ce dirigeant a déjà un mot de passe : connecte-toi, ou demande au responsable de le réinitialiser.',
    SESSION: 'Ta connexion a expiré : reconnecte-toi.',
    DONNEES: 'Informations incomplètes.',
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
    const body = name in NO_K ? args : Object.assign({ k: c.test ? c.clubKey : access() }, args);
    try { r = await fetch(`${c.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch (e) { const err = new Error('Pas de connexion internet.'); err.offline = true; throw err; }
    const txt = await r.text();
    if (!r.ok) {
      let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) {}
      const err = new Error(nice(m)); err.code = Object.keys(ERRORS).find(x => String(m).includes(x)) || '';
      if (r.status === 404 || /could not find the function/i.test(m)) { err.code = 'MISE_A_JOUR'; err.message = 'Le serveur du club doit être mis à jour (Réglages → Serveur du club → Mettre à jour le serveur).'; }
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
alter table club_config add column if not exists invite text;
-- Accounts of the dirigeants (nom + prénom + mot de passe), usable on any device
create table if not exists accounts (
  staff_id text primary key, last_key text not null, first_keys text[] not null default '{}', display text not null default '',
  salt text, pw_hash text, admin boolean not null default false, teams_set boolean not null default false,
  fails int not null default 0, locked_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists sessions (token_hash text primary key, staff_id text not null, created_at timestamptz not null default now(), expires_at timestamptz not null);
-- The club's data (licenciés, dirigeants, séances, matchs, schémas…), one row per item, shared by every device
create table if not exists items (col text not null, id text not null, data jsonb, updated_at bigint not null default 0,
  deleted boolean not null default false, rev bigint not null, primary key (col, id));
create sequence if not exists items_rev;
create index if not exists items_rev_idx on items (rev);
alter table club_config enable row level security;
alter table messages enable row level security;
alter table bookings enable row level security;
alter table slots enable row level security;
alter table accounts enable row level security;
alter table sessions enable row level security;
alter table items enable row level security;
insert into club_config (id, club_key_hash, admin_key_hash)
  values (1, encode(sha256(convert_to(${q(clubKey)}, 'UTF8')), 'hex'), encode(sha256(convert_to(${q(admKey)}, 'UTF8')), 'hex'))
  on conflict (id) do update set club_key_hash = excluded.club_key_hash, admin_key_hash = excluded.admin_key_hash;

create or replace function raincy_hash(t text) returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(t, ''), 'UTF8')), 'hex') $$;
create or replace function raincy_token() returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') $$;
-- Access: the club code, the responsable code, the invitation code, or a dirigeant's login
create or replace function club_ok(k text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(k, '') <> '' and (
    exists (select 1 from club_config where id = 1 and (club_key_hash = raincy_hash(k) or admin_key_hash = raincy_hash(k) or invite = k))
    or exists (select 1 from sessions where token_hash = raincy_hash(k) and expires_at > now())) $$;
create or replace function admin_ok(k text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(k, '') <> '' and (
    exists (select 1 from club_config where id = 1 and admin_key_hash = raincy_hash(k))
    or exists (select 1 from sessions s join accounts a on a.staff_id = s.staff_id where s.token_hash = raincy_hash(k) and s.expires_at > now() and a.admin)) $$;
create or replace function session_staff(t text) returns text language sql stable security definer set search_path = public as $$
  select staff_id from sessions where coalesce(t, '') <> '' and token_hash = raincy_hash(t) and expires_at > now() $$;

-- Accounts. The app never sends the password itself, only a slow hash of it; the server salts and hashes it again.
create or replace function raincy_new_session(p_staff text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t text := raincy_token(); a accounts;
begin
  select * into a from accounts where staff_id = p_staff;
  delete from sessions where expires_at < now();
  insert into sessions (token_hash, staff_id, expires_at) values (raincy_hash(t), p_staff, now() + interval '400 days');
  update accounts set fails = 0, locked_until = null where staff_id = p_staff;
  return jsonb_build_object('token', t, 'staff_id', a.staff_id, 'admin', a.admin, 'teams_set', a.teams_set, 'display', a.display, 'last_key', a.last_key);
end $$;
revoke all on function raincy_new_session(text) from public, anon, authenticated;
create or replace function club_login(p_last text, p_first text, p_h text) returns jsonb language plpgsql security definer set search_path = public as $$
declare a accounts; f1 text := split_part(coalesce(p_first, ''), ' ', 1);
begin
  select * into a from accounts where last_key = p_last and pw_hash is not null and (p_first = any(first_keys) or f1 = any(first_keys))
    order by (p_first = any(first_keys)) desc, updated_at desc limit 1;
  if a.staff_id is null then return jsonb_build_object('error', 'COMPTE_INCONNU'); end if;
  if a.locked_until > now() then return jsonb_build_object('error', 'BLOQUE'); end if;
  if raincy_hash(a.salt || coalesce(p_h, '')) <> a.pw_hash then
    update accounts set fails = case when fails >= 4 then 0 else fails + 1 end,
      locked_until = case when fails >= 4 then now() + interval '5 minutes' else locked_until end where staff_id = a.staff_id;
    return jsonb_build_object('error', 'MOT_DE_PASSE');
  end if;
  return raincy_new_session(a.staff_id);
end $$;
-- First connection (or new password after a reset). The responsable code also lets a responsable reset any password.
create or replace function club_register(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare is_adm boolean := admin_ok(admin_k); sid text := p->>'staff_id'; s text := raincy_token(); a accounts;
begin
  if not (is_adm or club_ok(k)) then raise exception 'CLE_CLUB'; end if;
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  select * into a from accounts where staff_id = sid;
  if a.pw_hash is not null and not is_adm then raise exception 'DEJA_INSCRIT'; end if;
  insert into accounts (staff_id, last_key, first_keys, display, salt, pw_hash, admin)
    values (sid, p->>'last_key', array(select jsonb_array_elements_text(coalesce(p->'first_keys', '[]'::jsonb))), coalesce(p->>'display', ''), s,
            raincy_hash(s || (p->>'h')), coalesce((p->>'admin')::boolean, false) and is_adm)
    on conflict (staff_id) do update set last_key = excluded.last_key, first_keys = excluded.first_keys, display = excluded.display, salt = excluded.salt,
      pw_hash = excluded.pw_hash, admin = accounts.admin or excluded.admin, updated_at = now();
  delete from sessions where staff_id = sid;
  return raincy_new_session(sid);
end $$;
create or replace function club_accounts(k text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('staff_id', staff_id, 'display', display, 'admin', admin, 'teams_set', teams_set, 'has_pw', pw_hash is not null)), '[]'::jsonb) from accounts); end $$;
create or replace function club_account_set(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text := p->>'staff_id';
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  if p ? 'admin' then update accounts set admin = (p->>'admin')::boolean, updated_at = now() where staff_id = sid; end if;
  if p ? 'teams_set' then update accounts set teams_set = (p->>'teams_set')::boolean, updated_at = now() where staff_id = sid; end if;
  if coalesce((p->>'reset')::boolean, false) then update accounts set pw_hash = null, salt = null, updated_at = now() where staff_id = sid; delete from sessions where staff_id = sid; end if;
  if coalesce((p->>'delete')::boolean, false) then delete from sessions where staff_id = sid; delete from accounts where staff_id = sid; end if;
  return to_jsonb(true); end $$;
create or replace function club_me(t text) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text := session_staff(t); a accounts;
begin if sid is null then return jsonb_build_object('error', 'SESSION'); end if;
  select * into a from accounts where staff_id = sid;
  if a.staff_id is null then return jsonb_build_object('error', 'SESSION'); end if;
  return jsonb_build_object('staff_id', a.staff_id, 'admin', a.admin, 'teams_set', a.teams_set, 'display', a.display, 'last_key', a.last_key); end $$;
create or replace function club_teams_done(t text) returns jsonb language plpgsql security definer set search_path = public as $$
begin update accounts set teams_set = true, updated_at = now() where staff_id = session_staff(t); return to_jsonb(found); end $$;
create or replace function club_change_pw(t text, p_old text, p_new text) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text := session_staff(t); a accounts; s text := raincy_token();
begin if sid is null then raise exception 'SESSION'; end if;
  select * into a from accounts where staff_id = sid;
  if raincy_hash(a.salt || coalesce(p_old, '')) <> a.pw_hash then return jsonb_build_object('error', 'MOT_DE_PASSE'); end if;
  if length(coalesce(p_new, '')) < 32 then raise exception 'DONNEES'; end if;
  update accounts set salt = s, pw_hash = raincy_hash(s || p_new), updated_at = now() where staff_id = sid;
  delete from sessions where staff_id = sid and token_hash <> raincy_hash(t);
  return to_jsonb(true); end $$;
create or replace function club_logout(t text) returns jsonb language plpgsql security definer set search_path = public as $$
begin delete from sessions where token_hash = raincy_hash(t); return to_jsonb(true); end $$;
-- Invitation link for new dirigeants (a responsable can make a new one, which cancels the old one)
create or replace function club_invite(k text, admin_k text, p_new boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text;
begin if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  select invite into c from club_config where id = 1;
  if c is null or p_new then c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)); update club_config set invite = c where id = 1; end if;
  return to_jsonb(c); end $$;

-- Shared club data: each device sends what changed and receives what the others changed
create or replace function club_pull(k text, p_since bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('col', col, 'id', id, 'data', data, 'u', updated_at, 'del', deleted, 'rev', rev) order by rev), '[]'::jsonb)
    from (select * from items where rev > coalesce(p_since, 0) order by rev limit 1000) x); end $$;
create or replace function club_push(k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  perform pg_advisory_xact_lock(4242);
  insert into items (col, id, data, updated_at, deleted, rev)
    select x.col, x.id, case when coalesce(x.del, false) then null else x.data end, coalesce(x.u, 0), coalesce(x.del, false), nextval('items_rev')
    from jsonb_to_recordset(p) as x(col text, id text, data jsonb, u bigint, del boolean)
    where x.col in ('teams', 'players', 'staff', 'schemas', 'trainings', 'matches', 'reports', 'club') and coalesce(x.id, '') <> ''
  on conflict (col, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev
    where excluded.updated_at >= items.updated_at;
  get diagnostics n = row_count; return to_jsonb(n); end $$;
grant execute on function club_login(text, text, text), club_register(text, text, jsonb), club_accounts(text), club_account_set(text, text, jsonb),
  club_me(text), club_teams_done(text), club_change_pw(text, text, text), club_logout(text), club_invite(text, text, boolean),
  club_pull(text, bigint), club_push(text, jsonb) to anon, authenticated;
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
    // accounts
    login: (last, first, h) => rpc('club_login', { p_last: last, p_first: first, p_h: h }),
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
  };
  const inviteLink = code => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#rejoindre=${encodeURIComponent(code)}`;
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

  /* ---------- setup (Réglages, responsable) ---------- */
  const { esc, $, toast, modal } = UI;
  function settingsSection() {
    const c = cfg(), admin = Auth.isAdmin(), sync = typeof Sync !== 'undefined' ? Sync.status() : '';
    return `<section class="card"><h2>${I.share}Serveur du club (comptes, données, messagerie, planning)</h2>
      <p>${ready() ? `<span class="res res-V">Connecté</span> ${esc(c.url.replace(/^https?:\/\//, ''))}` : '<span class="res res-D">Non connecté</span> Les comptes, le partage des données, la messagerie et le planning ont besoin du serveur du club.'}</p>
      ${sync ? `<p class="muted small">${esc(sync)}</p>` : ''}
      ${admin ? `<div class="chips">${ready() ? `<button class="btn primary" data-cloud="invite">${I.share}<span>Inviter les éducateurs</span></button>` : ''}
        ${!ready() || !builtIn() ? `<button class="btn" data-cloud="setup">${I.edit}<span>${ready() ? 'Reconfigurer' : 'Configurer le serveur'}</span></button>` : ''}
        ${ready() ? `<button class="btn" data-cloud="test">${I.check}<span>Tester</span></button><button class="btn" data-cloud="update">${I.rotate}<span>Mettre à jour le serveur</span></button><button class="btn" data-cloud="adminkey">${I.whistle}<span>Code responsable</span></button>` : ''}</div>
        <p class="muted small">Les éducateurs rejoignent le club avec le lien d'invitation, puis se connectent sur n'importe quel appareil avec leur nom et leur mot de passe.</p>`
      : `<p class="muted small">${ready() ? 'Tes données sont enregistrées sur le serveur du club : tu les retrouves en te connectant sur un autre appareil.' : 'Demande au responsable le lien d\'invitation du club.'}</p>`}
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
        const c = { url, key, clubKey, test: true };
        (async () => {
          const b = UI.busy('Test de la connexion…');
          try {
            await api.ping(c);
            delete c.test; Store.state.club.cloud = c; Store.state.auth.cloudAdminKey = admKey; Store.save();
            close(); toast('Serveur connecté !'); rerender && rerender();
          } catch (e) { toast(e.message.includes('code du club') ? 'Le script n\'a pas été exécuté (ou pas en entier) dans Supabase' : e.message, 'err'); }
          finally { b.done(); }
        })();
        return false;
      } }] });
  }
  async function onSettingsClick(b, rerender) {
    if (b.dataset.cloud === 'setup') return wizard(rerender);
    if (b.dataset.cloud === 'invite') return shareInvite(false);
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
      modal({ title: 'Code responsable', body: `<p>Ce code sert de <b>code de secours</b> : avec « Je suis le responsable » sur l'écran de connexion, il permet de retrouver l'accès responsable et de changer ton mot de passe. Note-le sur papier.</p>
        ${ownAdminKey() ? '' : '<p class="tip">Ce code n\'est pas sur cet appareil. Tu n\'en as pas besoin tant que tu te connectes avec ton compte responsable.</p>'}
        <label class="fld"><span>Code responsable</span><input id="admKey" value="${esc(ownAdminKey())}" autocapitalize="off" autocorrect="off"></label>`,
        actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: (c, r) => { Store.state.auth.cloudAdminKey = $('#admKey', r).value.trim(); Store.save(); toast('Code enregistré'); } }] });
    }
  }

  return Object.assign(api, { ready, canLogin, cfg, adminKey, token, genKey, sql, settingsSection, onSettingsClick, shareInvite });
})();
