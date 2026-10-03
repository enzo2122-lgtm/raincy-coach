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
    ACCES_RETIRE: 'Ton accès à l\'appli du club a été retiré par un responsable.',
    SESSION: 'Ta connexion a expiré : reconnecte-toi.',
    DONNEES: 'Informations incomplètes.',
    CRENEAU_PRIS: 'Ce créneau est déjà pris sur cette partie du terrain. Choisis un autre horaire ou l\'autre moitié.',
    HORS_CRENEAU: 'Cet horaire est en dehors des créneaux disponibles du terrain.',
    CLE_CLUB: 'Le code du club est incorrect : demande au responsable de te renvoyer le fichier du club.',
    ADMIN: 'Réservé à un responsable (code responsable manquant ou incorrect).',
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

-- Parents (version 3.8) : une page publique en lecture seule par catégorie (lien secret), et les réponses présent / absent aux convocations.
-- La page ne montre que le prénom et l'initiale du nom des enfants convoqués : jamais de date de naissance, de téléphone ni d'adresse.
create table if not exists parent_links (token text primary key, team_key text not null unique, team_ids text[] not null default '{}',
  team_name text not null default '', created_at timestamptz not null default now());
create table if not exists answers (match_id text not null, player_id text not null, status text not null check (status in ('oui', 'non')),
  seats int not null default 0, note text, by_coach boolean not null default false, updated_at timestamptz not null default now(), primary key (match_id, player_id));
alter table parent_links enable row level security;
alter table answers enable row level security;
-- (3.10) Photos d'un match que le coach partage avec les parents : réduites (moins de 400 Ko), 12 par match au plus, effacées après 90 jours
create table if not exists match_photos (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  match_id text not null, src text, by_name text, data text not null check (length(data) < 600000));
create index if not exists match_photos_match on match_photos (match_id);
alter table match_photos enable row level security;
-- Un coach récupère le lien de sa catégorie (toujours le même ; « nouveau lien » annule l'ancien)
create or replace function club_parent_link(k text, p_team_key text, p_team_ids text[], p_team_name text, p_new boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare t text;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if coalesce(p_team_key, '') = '' or coalesce(array_length(p_team_ids, 1), 0) = 0 then raise exception 'DONNEES'; end if;
  select token into t from parent_links where team_key = p_team_key;
  if t is null or p_new then
    t := substr(raincy_token(), 1, 24);
    insert into parent_links (token, team_key, team_ids, team_name) values (t, p_team_key, p_team_ids, coalesce(p_team_name, ''))
      on conflict (team_key) do update set token = excluded.token, team_ids = excluded.team_ids, team_name = excluded.team_name, created_at = now();
  else update parent_links set team_ids = p_team_ids, team_name = coalesce(p_team_name, team_name) where team_key = p_team_key;
  end if;
  return to_jsonb(t); end $$;
-- « Prénom N. » d'un licencié
create or replace function raincy_short(p jsonb) returns text language sql immutable as $$
  select trim(coalesce(p->>'firstName', '') || case when coalesce(p->>'lastName', '') <> '' then ' ' || upper(left(p->>'lastName', 1)) || '.' else '' end) $$;
-- La page des parents : matchs de la catégorie (3 semaines avant, 2 mois après), séances des 2 semaines à venir
create or replace function parent_view(p_token text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l parent_links; today text := to_char(current_date, 'YYYY-MM-DD');
begin
  select * into l from parent_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_PARENTS'; end if;
  return jsonb_build_object('team', l.team_name,
    'club', (select jsonb_build_object('name', data->>'name', 'fieldName', data->>'fieldName') from items where col = 'club' and id = 'club' and not deleted),
    -- (3.37) les tâches des bénévoles (buvette, arbitre de touche…) : la liste du club, ou celle de l'appli
    'volTasks', (select data->'volTasks' from items where col = 'club' and id = 'club' and not deleted),
    -- (3.9) les coachs de la catégorie qui ont choisi de donner leur numéro aux parents (Réglages → Mon compte)
    'coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), 'role', st.data->>'role', 'phone', st.data->>'phone')
        order by st.data->>'lastName'), '[]'::jsonb) from items st where st.col = 'staff' and not st.deleted and st.data->>'phoneShow' = 'parents' and coalesce(st.data->>'phone', '') <> ''
        and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end) x where x = any(l.team_ids))),
    'matches', (select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) from (
      select jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'rdv', i.data->>'rdv', 'opponent', i.data->>'opponent',
        'home', coalesce((i.data->>'home')::boolean, false), 'place', i.data->>'place', 'competition', i.data->>'competition',
        'exempt', coalesce((i.data->>'exempt')::boolean, false), 'played', coalesce((i.data->>'played')::boolean, false), 'gf', i.data->'gf', 'ga', i.data->'ga',
        'team', (select t.data->>'name' from items t where t.col = 'teams' and t.id = i.data->>'teamId'),
        'open', not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today,
        'photos', (select coalesce(jsonb_agg(ph.id order by ph.created_at), '[]'::jsonb) from match_photos ph where ph.match_id = i.id),
        'vol', case when i.data->>'date' >= today then coalesce(i.data->'vol', '{}'::jsonb) else '{}'::jsonb end,
        'players', case when not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today then (
          select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', raincy_short(p.data), 'answer', a.status, 'seats', coalesce(a.seats, 0)) order by p.data->>'firstName'), '[]'::jsonb)
          from items p left join answers a on a.match_id = i.id and a.player_id = p.id
          where p.col = 'players' and not p.deleted and p.id in (select jsonb_array_elements_text(coalesce(i.data->'convoked', '[]'::jsonb)))) else '[]'::jsonb end,
        'carpool', (select coalesce(jsonb_agg(jsonb_build_object('driver', c->>'driver', 'seats', coalesce((c->>'seats')::int, 0), 'from', c->>'from', 'time', c->>'time',
            'kids', (select coalesce(jsonb_agg(raincy_short(p.data)), '[]'::jsonb) from items p where p.col = 'players' and p.id in (select jsonb_array_elements_text(coalesce(c->'kids', '[]'::jsonb)))))), '[]'::jsonb)
          from jsonb_array_elements(case when jsonb_typeof(i.data->'carpool') = 'array' then i.data->'carpool' else '[]'::jsonb end) c)) x
      from items i where i.col = 'matches' and not i.deleted and i.data->>'teamId' = any(l.team_ids)
        and i.data->>'date' between to_char(current_date - 21, 'YYYY-MM-DD') and to_char(current_date + 60, 'YYYY-MM-DD')) s),
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title') order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i where i.col = 'trainings' and not i.deleted and i.data->>'teamId' = any(l.team_ids)
        and i.data->>'date' between today and to_char(current_date + 14, 'YYYY-MM-DD')));
end $$;
-- Un parent répond pour son enfant convoqué (présent / absent, et places libres dans sa voiture pour un match à l'extérieur)
create or replace function parent_answer(p_token text, p_match text, p_player text, p_status text, p_seats int default 0, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare l parent_links; m items;
begin
  select * into l from parent_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_PARENTS'; end if;
  select * into m from items where col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(l.team_ids)) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? p_player) then raise exception 'DONNEES'; end if;
  if coalesce((m.data->>'played')::boolean, false) or m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where match_id = p_match and player_id = p_player; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (match_id, player_id, status, seats, note, by_coach) values (p_match, p_player, p_status, greatest(0, least(coalesce(p_seats, 0), 8)), left(p_note, 200), false)
    on conflict (match_id, player_id) do update set status = excluded.status, seats = excluded.seats, note = excluded.note, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
-- Les coachs lisent les réponses, et peuvent répondre à la place d'un parent (appel, SMS)
create or replace function club_answers(k text, p_matches text[]) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('match_id', match_id, 'player_id', player_id, 'status', status, 'seats', seats, 'note', note, 'by_coach', by_coach, 'at', updated_at)), '[]'::jsonb)
    from answers where match_id = any(p_matches)); end $$;
create or replace function club_set_answer(k text, p_match text, p_player text, p_status text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if coalesce(p_status, '') = '' then delete from answers where match_id = p_match and player_id = p_player; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (match_id, player_id, status, by_coach) values (p_match, p_player, p_status, true)
    on conflict (match_id, player_id) do update set status = excluded.status, by_coach = true, updated_at = now();
  return to_jsonb(true); end $$;
-- Bénévoles (version 3.37) : un parent s'inscrit (ou se retire) pour une tâche d'un match de la catégorie (buvette, arbitre de touche…).
-- L'inscription est gardée avec le match : les coachs la voient aussitôt dans l'appli.
create or replace function parent_volunteer(p_token text, p_match text, p_task text, p_label text, p_name text, p_remove boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare l parent_links; m items; v jsonb; lst jsonb; nm text := left(trim(coalesce(p_name, '')), 40);
begin
  select * into l from parent_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_PARENTS'; end if;
  if coalesce(p_task, '') !~ '^[A-Za-z0-9_-]{1,30}$' or nm = '' then raise exception 'DONNEES'; end if;
  select * into m from items where col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(l.team_ids)) then raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  v := case when jsonb_typeof(m.data->'vol') = 'object' then m.data->'vol' else '{}'::jsonb end;
  lst := case when jsonb_typeof(v->p_task) = 'array' then v->p_task else '[]'::jsonb end;
  if coalesce(p_remove, false) then
    lst := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(lst) e where not (e->>'name' = nm and coalesce((e->>'parent')::boolean, false)));
  elsif not exists (select 1 from jsonb_array_elements(lst) e where lower(e->>'name') = lower(nm)) then
    if jsonb_array_length(lst) >= 8 then raise exception 'COMPLET'; end if;
    lst := lst || jsonb_build_array(jsonb_build_object('id', substr(md5(random()::text), 1, 12), 'name', nm, 'parent', true, 'label', left(coalesce(p_label, ''), 40)));
  end if;
  update items set data = jsonb_set(data, '{vol}', v || jsonb_build_object(p_task, lst)), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where col = 'matches' and id = p_match;
  return lst; end $$;
grant execute on function parent_volunteer(text, text, text, text, text, boolean) to anon, authenticated;
-- La veille d'un match, un rappel aux dirigeants inscrits comme bénévoles (tous les jours à 16 h UTC, 18 h en été à Paris)
create or replace function raincy_vol_remind() returns void language plpgsql security definer set search_path = public as $$
declare m items; k text; e jsonb; lbl text;
begin
  for m in select * from items where col = 'matches' and not deleted and data->>'date' = to_char(current_date + 1, 'YYYY-MM-DD') and jsonb_typeof(data->'vol') = 'object' loop
    for k in select jsonb_object_keys(m.data->'vol') loop
      for e in select * from jsonb_array_elements(case when jsonb_typeof(m.data->'vol'->k) = 'array' then m.data->'vol'->k else '[]'::jsonb end) loop
        if coalesce(e->>'staffId', '') = '' then continue; end if;
        lbl := coalesce((select t->>'label' from items c, jsonb_array_elements(case when jsonb_typeof(c.data->'volTasks') = 'array' then c.data->'volTasks' else '[]'::jsonb end) t
          where c.col = 'club' and c.id = 'club' and t->>'key' = k limit 1),
          case k when 'buvette' then 'Buvette' when 'touche' then 'Arbitre de touche' when 'delegue' then 'Délégué' when 'table' then 'Table de marque' when 'lavage' then 'Lavage des maillots' when 'accueil' then 'Accueil' when 'photos' then 'Photos' else 'Bénévole' end);
        perform raincy_notify(array[e->>'staffId'], 'planning', 'vol:' || m.id || ':' || k, '🙋 Demain : ' || lbl,
          coalesce((select data->>'name' from items where col = 'teams' and id = m.data->>'teamId'), '') || case when coalesce((m.data->>'home')::boolean, false) then ' contre ' else ' chez ' end
          || coalesce(m.data->>'opponent', '?') || coalesce(' · ' || raincy_hm(nullif(split_part(m.data->>'time', ':', 1), '')::int * 60 + coalesce(nullif(split_part(m.data->>'time', ':', 2), '')::int, 0)), ''), '#/benevoles');
      end loop;
    end loop;
  end loop;
exception when others then raise notice 'rappel des bénévoles : %', sqlerrm;
end $$;
revoke all on function raincy_vol_remind() from public, anon, authenticated;
do $vol$ begin
  begin
    perform cron.unschedule(jobid) from cron.job where jobname = 'raincy-benevoles';
    perform cron.schedule('raincy-benevoles', '0 16 * * *', 'select public.raincy_vol_remind()');
  exception when others then raise notice 'Rappel des bénévoles non programmé : %', sqlerrm;
  end;
end $vol$;
-- Joueurs (version 3.35) : la page des joueurs d'une catégorie (seniors, U17, U18…), avec son propre lien secret.
-- En plus de la page des parents : la causerie du prochain match (objectif, 3 clés, mot du coach, vidéo), et pour chaque match joué
-- le temps de jeu, les buts et les passes de chacun (prénom et initiale seulement), sur toute la saison.
create table if not exists player_links (token text primary key, team_key text not null unique, team_ids text[] not null default '{}',
  team_name text not null default '', created_at timestamptz not null default now());
alter table player_links enable row level security;
create or replace function club_player_link(k text, p_team_key text, p_team_ids text[], p_team_name text, p_new boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare t text;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if coalesce(p_team_key, '') = '' or coalesce(array_length(p_team_ids, 1), 0) = 0 then raise exception 'DONNEES'; end if;
  select token into t from player_links where team_key = p_team_key;
  if t is null or p_new then
    t := substr(raincy_token(), 1, 24);
    insert into player_links (token, team_key, team_ids, team_name) values (t, p_team_key, p_team_ids, coalesce(p_team_name, ''))
      on conflict (team_key) do update set token = excluded.token, team_ids = excluded.team_ids, team_name = excluded.team_name, created_at = now();
  else update player_links set team_ids = p_team_ids, team_name = coalesce(p_team_name, team_name) where team_key = p_team_key;
  end if;
  return to_jsonb(t); end $$;
create or replace function player_view(p_token text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l player_links; today text := to_char(current_date, 'YYYY-MM-DD');
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
begin
  select * into l from player_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_JOUEURS'; end if;
  return jsonb_build_object('team', l.team_name,
    'club', (select jsonb_build_object('name', data->>'name', 'fieldName', data->>'fieldName') from items where col = 'club' and id = 'club' and not deleted),
    'coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), 'role', st.data->>'role', 'phone', st.data->>'phone')
        order by st.data->>'lastName'), '[]'::jsonb) from items st where st.col = 'staff' and not st.deleted and st.data->>'phoneShow' = 'parents' and coalesce(st.data->>'phone', '') <> ''
        and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end) x where x = any(l.team_ids))),
    'roster', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', raincy_short(p.data), 'number', p.data->>'number',
        'wb', (select max(w->>'day') from jsonb_array_elements(case when jsonb_typeof(p.data->'wellness') = 'array' then p.data->'wellness' else '[]'::jsonb end) w)) order by p.data->>'firstName'), '[]'::jsonb)
      from items p where p.col = 'players' and not p.deleted
        and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p.data->'teamIds') = 'array' then p.data->'teamIds' else '[]'::jsonb end) x where x = any(l.team_ids))),
    'matches', (select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) from (
      select jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'rdv', i.data->>'rdv', 'opponent', i.data->>'opponent',
        'home', coalesce((i.data->>'home')::boolean, false), 'place', i.data->>'place', 'competition', i.data->>'competition',
        'exempt', coalesce((i.data->>'exempt')::boolean, false), 'played', coalesce((i.data->>'played')::boolean, false), 'gf', i.data->'gf', 'ga', i.data->'ga',
        'team', (select t.data->>'name' from items t where t.col = 'teams' and t.id = i.data->>'teamId'),
        'open', not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today,
        -- la causerie du match à venir : ce que le coach veut que les joueurs retiennent
        'talk', case when not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today then jsonb_build_object(
          'objective', i.data#>>'{prep,talk,objective}', 'keys', coalesce(i.data#>'{prep,talk,keys}', '[]'::jsonb), 'final', i.data#>>'{prep,talk,final}',
          'video', i.data#>>'{prep,talk,videoUrl}', 'system', i.data#>>'{prep,plan,system}') else null end,
        'players', case when not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today then (
          select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', raincy_short(p.data), 'answer', a.status) order by p.data->>'firstName'), '[]'::jsonb)
          from items p left join answers a on a.match_id = i.id and a.player_id = p.id
          where p.col = 'players' and not p.deleted and p.id in (select jsonb_array_elements_text(coalesce(i.data->'convoked', '[]'::jsonb)))) else '[]'::jsonb end,
        -- match joué : temps de jeu, buts, passes de chaque convoqué
        'stats', case when coalesce((i.data->>'played')::boolean, false) then (
          select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'min', i.data#>>array['minutes', p.id], 'g', i.data#>>array['stats', p.id, 'g'], 'a', i.data#>>array['stats', p.id, 'a'])), '[]'::jsonb)
          from items p where p.col = 'players' and p.id in (select jsonb_array_elements_text(coalesce(i.data->'convoked', '[]'::jsonb)))) else '[]'::jsonb end,
        'duration', i.data->'duration') x
      from items i where i.col = 'matches' and not i.deleted and i.data->>'teamId' = any(l.team_ids)
        and i.data->>'date' between season and to_char(current_date + 60, 'YYYY-MM-DD')) s),
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title') order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i where i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(l.team_ids)
        and i.data->>'date' between today and to_char(current_date + 14, 'YYYY-MM-DD')));
end $$;
-- Un joueur répond présent / absent à sa convocation (les coachs voient la réponse avec celles des parents)
create or replace function player_answer(p_token text, p_match text, p_player text, p_status text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare l player_links; m items;
begin
  select * into l from player_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_JOUEURS'; end if;
  select * into m from items where col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(l.team_ids)) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? p_player) then raise exception 'DONNEES'; end if;
  if coalesce((m.data->>'played')::boolean, false) or m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where match_id = p_match and player_id = p_player; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (match_id, player_id, status, seats, note, by_coach) values (p_match, p_player, p_status, 0, left(p_note, 200), false)
    on conflict (match_id, player_id) do update set status = excluded.status, note = excluded.note, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
grant execute on function club_player_link(text, text, text[], text, boolean), player_view(text), player_answer(text, text, text, text, text) to anon, authenticated;
-- (3.41) Le questionnaire de bien-être d'un joueur (ressenti, mental, sommeil, jambes, courbatures de 1 à 10), une fois par jour
create or replace function player_wellness(p_token text, p_player text, p_mood int, p_mental int, p_sleep int, p_legs int, p_sore int, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare l player_links; pl items; w jsonb; d text := to_char(current_date, 'YYYY-MM-DD');
begin
  select * into l from player_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_JOUEURS'; end if;
  select * into pl from items where col = 'players' and id = p_player and not deleted;
  if pl.id is null or not exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(pl.data->'teamIds') = 'array' then pl.data->'teamIds' else '[]'::jsonb end) x where x = any(l.team_ids)) then raise exception 'DONNEES'; end if;
  if least(p_mood, p_mental, p_sleep, p_legs, p_sore) < 1 or greatest(p_mood, p_mental, p_sleep, p_legs, p_sore) > 10 then raise exception 'DONNEES'; end if;
  w := (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) e where e->>'day' <> d order by e->>'day' desc limit 119) q)
    || jsonb_build_array(jsonb_build_object('day', d, 'mood', p_mood, 'mental', p_mental, 'sleep', p_sleep, 'legs', p_legs, 'sore', p_sore, 'note', left(coalesce(p_note, ''), 200), 'self', true));
  update items set data = jsonb_set(data, '{wellness}', w), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where col = 'players' and id = p_player;
  return to_jsonb(true); end $$;
grant execute on function player_wellness(text, text, int, int, int, int, int, text) to anon, authenticated;
grant execute on function club_parent_link(text, text, text[], text, boolean), parent_view(text), parent_answer(text, text, text, text, int, text),
  club_answers(text, text[]), club_set_answer(text, text, text, text) to anon, authenticated;
create or replace function club_photo_add(k text, p_match text, p_src text, p_data text, p_by text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r uuid;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if coalesce(p_data, '') not like 'data:image/jpeg;base64,%' or length(p_data) >= 600000 then raise exception 'DONNEES'; end if;
  delete from match_photos where created_at < now() - interval '90 days';
  if exists (select 1 from match_photos where match_id = p_match and src = p_src) then return to_jsonb((select id from match_photos where match_id = p_match and src = p_src limit 1)); end if;
  if (select count(*) from match_photos where match_id = p_match) >= 12 then raise exception 'PHOTOS_MAX'; end if;
  insert into match_photos (match_id, src, by_name, data) values (p_match, p_src, left(p_by, 80), p_data) returning id into r;
  return to_jsonb(r); end $$;
create or replace function club_photos(k text, p_match text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'src', src, 'by', by_name, 'at', created_at) order by created_at), '[]'::jsonb) from match_photos where match_id = p_match); end $$;
create or replace function club_photo_get(k text, p_id uuid) returns text language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; return (select data from match_photos where id = p_id); end $$;
create or replace function club_photo_del(k text, p_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; delete from match_photos where id = p_id; return found; end $$;
-- un parent ne voit que les photos des matchs de sa catégorie
create or replace function parent_photo(p_token text, p_id uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare l parent_links;
begin select * into l from parent_links where coalesce(p_token, '') <> '' and token = p_token;
  if l.token is null then raise exception 'LIEN_PARENTS'; end if;
  return (select ph.data from match_photos ph join items i on i.col = 'matches' and i.id = ph.match_id and not i.deleted where ph.id = p_id and i.data->>'teamId' = any(l.team_ids)); end $$;
grant execute on function club_photo_add(text, text, text, text, text), club_photos(text, text), club_photo_get(text, uuid), club_photo_del(text, uuid), parent_photo(text, uuid) to anon, authenticated;

-- (3.15) Notifications sur les téléphones, mentions « @ » et accusés de lecture.
-- La base prépare les notifications de chaque dirigeant (table notifs) puis appelle la fonction « raincy-push »
-- (Edge Function) qui réveille les téléphones ; chaque téléphone lit ensuite ses notifications ici.
do $pg$ begin
  begin create extension if not exists pg_net with schema extensions;
  exception when others then raise notice 'pg_net indisponible : %', sqlerrm; end;
end $pg$;
create table if not exists push_config (id int primary key default 1, secret text not null default replace(gen_random_uuid()::text, '-', ''),
  fn_url text, vapid_public text, vapid_private jsonb);
insert into push_config (id) values (1) on conflict (id) do nothing;
create table if not exists push_subs (id uuid primary key default gen_random_uuid(), staff_id text not null, endpoint text not null unique,
  prefs jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists notifs (id bigserial primary key, staff_id text not null, created_at timestamptz not null default now(),
  kind text, tag text, title text, body text, url text, n int not null default 1, delivered boolean not null default false);
create index if not exists notifs_staff on notifs (staff_id, delivered);
create table if not exists message_reads (channel text not null, staff_id text not null, at timestamptz not null, primary key (channel, staff_id));
alter table push_config enable row level security;
alter table push_subs enable row level security;
alter table notifs enable row level security;
alter table message_reads enable row level security;

-- Les dirigeants d'une catégorie (la catégorie et ses équipes A / B vont ensemble)
create or replace function raincy_team_staff(p_team text) returns text[] language sql stable security definer set search_path = public as $$
  with k as (select upper(replace(coalesce(data->>'category', data->>'name', ''), ' ', '')) as key from items where col = 'teams' and id = p_team),
  fam as (select t.id from items t, k where t.col = 'teams' and not t.deleted and upper(replace(coalesce(t.data->>'category', t.data->>'name', ''), ' ', '')) = k.key)
  select coalesce(array_agg(distinct st.id), '{}') from items st where st.col = 'staff' and not st.deleted
    and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end) x
                where x = p_team or x in (select id from fam)) $$;
create or replace function raincy_day(d date) returns text language sql immutable as $$
  select (array['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'])[extract(dow from d)::int + 1] || ' ' || to_char(d, 'DD/MM') $$;
create or replace function raincy_hm(m int) returns text language sql immutable as $$ select lpad((m / 60)::text, 2, '0') || 'h' || lpad((m % 60)::text, 2, '0') $$;
create or replace function raincy_coach(n text) returns text language sql immutable as $$
  select coalesce('Coach ' || (select w from regexp_split_to_table(coalesce(n, ''), '\\s+') w where w ~ '[a-zà-ÿ]' limit 1), nullif(n, ''), 'Un coach') $$;

-- Prépare une notification pour chaque dirigeant ; plusieurs de suite (série de créneaux, import de matchs) n'en font qu'une
create or replace function raincy_notify(p_staff text[], p_kind text, p_tag text, p_title text, p_body text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare s text; targets text[] := '{}'; cfg push_config; subs jsonb;
begin
  foreach s in array coalesce(p_staff, '{}'::text[]) loop
    if s is null or s = '' then continue; end if;
    -- grouped: a message not shown yet, or a burst of planning changes (weekly series, import of matches)
    if exists (select 1 from notifs where staff_id = s and tag = p_tag and created_at > now() - interval '2 minutes' and (not delivered or p_kind = 'planning')) then
      update notifs set n = n + 1, title = left(p_title, 120), body = left(p_body, 240), url = p_url, delivered = false where id = (select max(id) from notifs where staff_id = s and tag = p_tag);
    else
      insert into notifs (staff_id, kind, tag, title, body, url) values (s, p_kind, p_tag, left(p_title, 120), left(p_body, 240), p_url);
      targets := targets || s;
    end if;
  end loop;
  delete from notifs where created_at < now() - interval '30 days';
  select * into cfg from push_config where id = 1;
  if cfg.fn_url is null or coalesce(array_length(targets, 1), 0) = 0 then return; end if;
  -- a mention always goes through; the other kinds follow the dirigeant's choice (messages, planning)
  select jsonb_agg(jsonb_build_object('id', id, 'endpoint', endpoint)) into subs from push_subs
    where staff_id = any(targets) and (p_kind in ('mention', 'test') or coalesce((prefs->>p_kind)::boolean, true));
  if subs is null then return; end if;
  begin
    perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'envoi des notifications : %', sqlerrm; end;
end $$;
revoke all on function raincy_notify(text[], text, text, text, text, text) from public, anon, authenticated;

-- Un message : aux membres de la conversation ; « @Prénom » (marque [[tag:id]] ajoutée par l'appli) prévient la personne dans tous les cas
create or replace function raincy_on_message() returns trigger language plpgsql security definer set search_path = public as $$
declare t text[]; tagged text[]; who text := raincy_coach(new.author_name); title text; body text;
begin
  begin
    tagged := coalesce(string_to_array(substring(new.body from '\\[\\[tag:([\\w,-]+)\\]\\]'), ','), '{}');
    body := left(btrim(regexp_replace(regexp_replace(new.body, '\\[\\[[^\\]]*\\]\\]', '', 'g'), '#rappel-[\\w-]+', '', 'g'), ' ' || chr(10) || chr(13)), 200);
    if new.channel = 'general' then
      t := array(select distinct staff_id from push_subs); title := '💬 Tout le club · ' || who;
    elsif new.channel like 'team:%' then
      t := raincy_team_staff(substr(new.channel, 6));
      title := '💬 ' || coalesce((select data->>'name' from items where col = 'teams' and id = substr(new.channel, 6)), 'Catégorie') || ' · ' || who;
    elsif new.channel like 'dm:%' then
      t := string_to_array(substr(new.channel, 4), ':'); title := case when new.body like '🐞%' then '🐞 Signalement · ' else '✉️ ' end || who;
      tagged := array(select x from unnest(tagged) x where x = any(t)); -- a private conversation stays private
    end if;
    t := array(select x from unnest(t) x where x <> coalesce(new.author_id, '') and not x = any(tagged));
    tagged := array(select x from unnest(tagged) x where x <> coalesce(new.author_id, ''));
    perform raincy_notify(tagged, 'mention', 'tag:' || new.id, '📣 ' || who || ' t''a mentionné', body, '#/messages/' || new.channel);
    perform raincy_notify(t, 'messages', 'msg:' || new.channel, title, body, '#/messages/' || new.channel);
  exception when others then raise notice 'notification du message : %', sqlerrm; end;
  return new;
end $$;
drop trigger if exists raincy_msg_notify on messages;
create trigger raincy_msg_notify after insert on messages for each row execute function raincy_on_message();

-- Planning : un créneau réservé ou libéré pour une catégorie prévient ses dirigeants
create or replace function raincy_on_booking() returns trigger language plpgsql security definer set search_path = public as $$
declare b bookings; t text[];
begin
  if tg_op = 'DELETE' then b := old; else b := new; end if;
  begin
    if b.team_id is null or b.date < current_date or b.date > current_date + 60 then return null; end if;
    t := array(select x from unnest(raincy_team_staff(b.team_id)) x where tg_op = 'DELETE' or x <> coalesce(b.author_id, ''));
    if coalesce(b.field, 'T1') = 'T1' then
      perform raincy_notify(t, 'planning', 'plan:' || b.team_id, '📅 Planning · ' || coalesce(b.team_name, ''),
        case when tg_op = 'DELETE' then 'Créneau libéré : ' else 'Créneau réservé : ' end || raincy_day(b.date) || ' ' || raincy_hm(b.start_min) || '–' || raincy_hm(b.end_min)
          || case when b.part = 'full' then '' else ' (demi-terrain ' || b.part || ')' end || case when b.kind = 'match' then ' · match' else '' end, '#/planning');
    else -- (3.16) les vestiaires
      perform raincy_notify(t, 'planning', 'plan:' || b.team_id, '🚪 Vestiaires · ' || coalesce((select data->>'name' from items where col = 'teams' and id = b.team_id), b.team_name, ''),
        case b.field when 'V1' then 'Vestiaire 1' when 'V2' then 'Vestiaire 2' when 'VK1' then 'Vestiaire Karaté 1' when 'VK2' then 'Vestiaire Karaté 2' else b.field end
          || case when tg_op = 'DELETE' then ' libéré : ' else ' : ' end || case when b.kind = 'adversaire' then coalesce(b.team_name, 'adversaire') || ', ' else '' end
          || raincy_day(b.date) || ' ' || raincy_hm(b.start_min) || '–' || raincy_hm(b.end_min), '#/vestiaires');
    end if;
  exception when others then raise notice 'notification du planning : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists raincy_booking_notify on bookings;
create trigger raincy_booking_notify after insert or delete on bookings for each row execute function raincy_on_booking();

-- Matchs et séances : ajoutés, déplacés (date, heure, lieu) ou supprimés, dans les 30 jours
create or replace function raincy_on_item() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; o jsonb; t text[]; what text; team text; lbl text; ismatch boolean := new.col = 'matches'; dt date;
begin
  if new.col not in ('matches', 'trainings') then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then o := old.data; end if;
    if new.deleted then
      if o is null then return null; end if;
      d := o; what := case when ismatch then 'Match supprimé' else 'Séance supprimée' end;
    else
      d := new.data;
      if coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
      if o is null then what := case when ismatch then 'Nouveau match' else 'Nouvelle séance' end;
      elsif (d->>'date') is distinct from (o->>'date') then what := 'Nouvelle date';
      elsif (d->>'time') is distinct from (o->>'time') or (ismatch and (d->>'rdv') is distinct from (o->>'rdv')) then what := 'Nouvel horaire';
      elsif ismatch and (d->>'place') is distinct from (o->>'place') then what := 'Nouveau lieu';
      else return null; end if;
    end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    if dt is null or dt < current_date or dt > current_date + 30 then return null; end if;
    team := d->>'teamId'; if coalesce(team, '') = '' then return null; end if;
    t := array(select x from unnest(raincy_team_staff(team)) x where x <> coalesce(d->>'editedBy', ''));
    lbl := coalesce((select data->>'name' from items where col = 'teams' and id = team), '');
    perform raincy_notify(t, 'planning', 'plan:' || team, case when ismatch then '⚽ ' else '🏃 ' end || what || ' · ' || lbl,
      raincy_day(dt) || coalesce(' ' || replace(nullif(d->>'time', ''), ':', 'h'), '')
        || case when ismatch then ' · ' || case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end || coalesce(d->>'opponent', '?')
             || coalesce(' · ' || nullif(d->>'place', ''), '')
           else coalesce(' · ' || nullif(d->>'title', ''), '') end,
      case when new.deleted then case when ismatch then '#/matchs' else '#/entrainements' end
           else case when ismatch then '#/match/' else '#/entrainement/' end || new.id end);
  exception when others then raise notice 'notification du planning : %', sqlerrm; end;
  return null;
end $$;
drop trigger if exists raincy_item_notify on items;
create trigger raincy_item_notify after insert or update on items for each row execute function raincy_on_item();

-- L'appli : clé publique, abonnement d'un téléphone, test, notifications à afficher, accusés de lecture
create or replace function club_push_key(k text) returns text language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; return (select vapid_public from push_config where id = 1); end $$;
create or replace function club_push_setup(k text, admin_k text, p_url text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  update push_config set fn_url = nullif(p_url, '') where id = 1;
  return (select jsonb_build_object('secret', secret, 'public', vapid_public) from push_config where id = 1); end $$;
create or replace function club_push_sub(k text, p_endpoint text, p_prefs jsonb) returns boolean language plpgsql security definer set search_path = public as $$
declare sid text := session_staff(k);
begin if sid is null then raise exception 'SESSION'; end if;
  if coalesce(p_endpoint, '') not like 'https://%' then raise exception 'DONNEES'; end if;
  insert into push_subs (staff_id, endpoint, prefs) values (sid, p_endpoint, coalesce(p_prefs, '{}'::jsonb))
    on conflict (endpoint) do update set staff_id = excluded.staff_id, prefs = excluded.prefs;
  return true; end $$;
create or replace function club_push_unsub(k text, p_endpoint text) returns boolean language plpgsql security definer set search_path = public as $$
begin delete from push_subs where endpoint = p_endpoint and staff_id = session_staff(k); return found; end $$;
create or replace function club_push_test(k text) returns int language plpgsql security definer set search_path = public as $$
declare sid text := session_staff(k);
begin if sid is null then raise exception 'SESSION'; end if;
  perform raincy_notify(array[sid], 'test', 'test:' || now(), '🔔 Raincy Coach', 'Les notifications marchent sur ce téléphone !', '#/reglages');
  return (select count(*) from push_subs where staff_id = sid); end $$;
create or replace function club_notifs(k text) returns jsonb language plpgsql security definer set search_path = public as $$
declare sid text := session_staff(k); r jsonb;
begin if sid is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'body', body, 'url', url, 'n', n, 'tag', tag, 'kind', kind) order by id desc), '[]'::jsonb) into r
    from (select * from notifs where staff_id = sid and not delivered and created_at > now() - interval '2 days' order by id desc limit 10) x;
  update notifs set delivered = true where staff_id = sid and not delivered;
  return r; end $$;
create or replace function club_mark_read(k text, p_channel text, p_at timestamptz) returns boolean language plpgsql security definer set search_path = public as $$
declare sid text := session_staff(k);
begin if sid is null or coalesce(p_channel, '') = '' then return false; end if;
  insert into message_reads (channel, staff_id, at) values (p_channel, sid, coalesce(p_at, now()))
    on conflict (channel, staff_id) do update set at = greatest(message_reads.at, excluded.at);
  update notifs set delivered = true where staff_id = sid and tag = 'msg:' || p_channel and not delivered;
  return true; end $$;
create or replace function club_reads(k text, p_channel text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('staff_id', staff_id, 'at', at)), '[]'::jsonb) from message_reads where channel = p_channel); end $$;
grant execute on function club_push_key(text), club_push_setup(text, text, text), club_push_sub(text, text, jsonb), club_push_unsub(text, text),
  club_push_test(text), club_notifs(text), club_mark_read(text, text, timestamptz), club_reads(text, text) to anon, authenticated;

-- Sauvegardes du club (version 3.8) : une copie de toutes les données chaque lundi à 3 h, les 8 dernières sont gardées.
-- Elles restent sur le serveur (privé) ; seul un responsable peut les lister et les télécharger.
create table if not exists backups (id bigserial primary key, created_at timestamptz not null default now(), kind text not null default 'auto', size int, data jsonb not null);
alter table backups enable row level security;
create or replace function raincy_backup(p_kind text default 'auto') returns bigint language plpgsql security definer set search_path = public as $$
declare d jsonb; n bigint;
begin
  d := jsonb_build_object('app', 'raincy-coach', 'version', 1, 'exportedAt', now(), 'backup', true,
    'data', coalesce((select jsonb_object_agg(col, arr) from (select col, jsonb_agg(data - 'bgData') arr from items where not deleted and data is not null and col <> 'club' group by col) g), '{}'::jsonb)
      || jsonb_build_object('club', coalesce((select data - 'cloud' from items where col = 'club' and id = 'club' and not deleted), '{}'::jsonb)));
  insert into backups (kind, size, data) values (coalesce(p_kind, 'auto'), length(d::text), d) returning id into n;
  delete from backups where id not in (select id from backups order by created_at desc limit 8);
  return n; end $$;
revoke all on function raincy_backup(text) from public, anon, authenticated;
create or replace function club_backups(k text, admin_k text) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'kind', kind, 'size', size) order by created_at desc), '[]'::jsonb) from backups); end $$;
create or replace function club_backup_now(k text, admin_k text) returns bigint language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  return raincy_backup('manuel'); end $$;
create or replace function club_backup_get(k text, admin_k text, p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if; if not admin_ok(admin_k) then raise exception 'ADMIN'; end if;
  return (select data from backups where id = p_id); end $$;
create or replace function club_backup_auto(k text) returns boolean language plpgsql security definer set search_path = public as $$
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  return exists (select 1 from pg_extension where extname = 'pg_cron'); end $$;
grant execute on function club_backups(text, text), club_backup_now(text, text), club_backup_get(text, text, bigint), club_backup_auto(text) to anon, authenticated;
-- Programmation chaque lundi à 3 h (si l'extension pg_cron n'est pas disponible, la sauvegarde reste possible à la main)
do $cron$ begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.unschedule(jobid) from cron.job where jobname = 'raincy-backup';
    perform cron.schedule('raincy-backup', '0 3 * * 1', 'select public.raincy_backup(''auto'')');
  exception when others then raise notice 'Sauvegarde automatique non programmée : %', sqlerrm;
  end;
end $cron$;
-- (3.42) Un code personnel par licencié : le joueur (ou ses parents) n'y voit que ses propres informations, jamais celles des autres joueurs.
-- Seuls les responsables du club voient et impriment les codes. Les anciens liens d'équipe (parents, joueurs) ne donnent plus accès à rien.
create table if not exists member_codes (player_id text primary key, code text not null unique, created_at timestamptz not null default now(), used_at timestamptz);
alter table member_codes enable row level security;
-- 8 caractères sans I, L, O, 0, 1 (qu'on confond à la lecture)
create or replace function raincy_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), i) % 31, 1), '')
  from unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) i $$;
create or replace function raincy_member(p_code text) returns items language plpgsql stable security definer set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); pl items;
begin
  if length(c) <> 8 then raise exception 'CODE_PERSO'; end if;
  select i.* into pl from member_codes mc join items i on i.col = 'players' and i.id = mc.player_id and not i.deleted where mc.code = c;
  if pl.id is null then raise exception 'CODE_PERSO'; end if;
  return pl; end $$;
create or replace function raincy_member_teams(pl items) returns text[] language sql immutable as $$
  select array(select jsonb_array_elements_text(case when jsonb_typeof(pl.data->'teamIds') = 'array' then pl.data->'teamIds' else '[]'::jsonb end)) $$;
-- les codes des joueurs demandés (créés s'il le faut). Le responsable voit tous les codes et peut en refaire un (« p_renew » : l'ancien ne marche plus).
-- Un coach ne voit que les joueurs de ses catégories, et seulement les codes qu'il n'a pas encore remis (case « remis ») ; le responsable les garde tous.
alter table member_codes add column if not exists given_at timestamptz;
alter table member_codes add column if not exists given_by text;
alter table member_codes add column if not exists first_at timestamptz;
create or replace function club_member_codes(k text, admin_k text, p_players text[], p_renew text[] default '{}') returns jsonb language plpgsql security definer set search_path = public as $$
declare pid text; c text; adm boolean := admin_ok(admin_k); sid text := session_staff(k); st items; tids text[];
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if not adm then
    if sid is null then raise exception 'ADMIN'; end if;
    select * into st from items where col = 'staff' and id = sid and not deleted;
    tids := array(select jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end));
  end if;
  foreach pid in array coalesce(p_players, '{}') loop
    if not exists (select 1 from items where col = 'players' and id = pid and not deleted and (adm or raincy_member_teams(items) && tids)) then continue; end if;
    if adm and pid = any(coalesce(p_renew, '{}')) then delete from member_codes where player_id = pid; end if;
    if not exists (select 1 from member_codes where player_id = pid) then
      loop c := raincy_code(); exit when not exists (select 1 from member_codes where code = c); end loop;
      insert into member_codes (player_id, code) values (pid, c);
    end if;
  end loop;
  return (select coalesce(jsonb_object_agg(mc.player_id, jsonb_build_object('code', case when adm or mc.given_at is null then mc.code else null end, 'used', mc.used_at, 'first', mc.first_at,
      'given', mc.given_at, 'by', case when adm then mc.given_by else null end)), '{}'::jsonb)
    from member_codes mc join items i on i.col = 'players' and i.id = mc.player_id and not i.deleted
    where mc.player_id = any(coalesce(p_players, '{}')) and (adm or raincy_member_teams(i) && tids));
end $$;
-- « remis » : le coach a donné le code à la famille (le responsable seul peut revenir en arrière)
create or replace function club_member_given(k text, admin_k text, p_player text, p_given boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare adm boolean := admin_ok(admin_k); sid text := session_staff(k); st items; pl items;
begin if not club_ok(k) then raise exception 'CLE_CLUB'; end if;
  if not adm and sid is null then raise exception 'ADMIN'; end if;
  select * into pl from items where col = 'players' and id = p_player and not deleted;
  if pl.id is null then raise exception 'DONNEES'; end if;
  if not adm then
    select * into st from items where col = 'staff' and id = sid and not deleted;
    if not (raincy_member_teams(pl) && array(select jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end))) then raise exception 'DONNEES'; end if;
    if not coalesce(p_given, false) then raise exception 'ADMIN'; end if;
  end if;
  update member_codes set given_at = case when coalesce(p_given, false) then now() else null end,
    given_by = case when coalesce(p_given, false) then coalesce((select trim(coalesce(s.data->>'firstName', '') || ' ' || coalesce(s.data->>'lastName', '')) from items s where s.col = 'staff' and s.id = sid), 'Responsable') else null end
    where player_id = p_player;
  return to_jsonb(true); end $$;
-- ce que voit le licencié : ses matchs (sa convocation, sa réponse, son temps de jeu, ses buts), ses séances, les coachs ; rien sur les autres joueurs
drop function if exists member_view(text);
-- (« p_preview » : un responsable qui regarde la page « comme un parent » ne compte pas comme une activation)
create or replace function member_view(p_code text, p_preview boolean default false) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := raincy_member(p_code); tids text[] := raincy_member_teams(pl); today text := to_char(current_date, 'YYYY-MM-DD'); first boolean;
  season text := case when extract(month from current_date) >= 8 then to_char(current_date, 'YYYY') else to_char(current_date - interval '1 year', 'YYYY') end || '-08-01';
begin
  if not coalesce(p_preview, false) then
    select first_at is null into first from member_codes where player_id = pl.id;
    update member_codes set used_at = now(), first_at = coalesce(first_at, now()) where player_id = pl.id;
    -- la première fois : « code activé » pour les responsables et les coachs de la catégorie (pour savoir qui relancer)
    if first then begin
      perform raincy_notify(array(select distinct x from (select a.staff_id x from accounts a where a.admin
          union select st.id from items st join accounts a on a.staff_id = st.id where st.col = 'staff' and not st.deleted
            and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end) y where y = any(tids))) z),
        'codes', 'codes', '✅ Code activé', raincy_short(pl.data) || ' a ouvert son espace (joueur / parents)', '#/codes/' || coalesce(tids[1], ''));
    exception when others then raise notice 'notification code : %', sqlerrm; end; end if;
  end if;
  return jsonb_build_object(
    'team', coalesce((select string_agg(t.data->>'name', ' · ' order by t.data->>'name') from items t where t.col = 'teams' and not t.deleted and t.id = any(tids)), ''),
    'me', jsonb_build_object('id', pl.id, 'name', raincy_short(pl.data), 'firstName', pl.data->>'firstName', 'number', pl.data->>'number', 'birth', pl.data->>'birth',
      'wb', (select max(w->>'day') from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) w)),
    'club', (select jsonb_build_object('name', data->>'name', 'fieldName', data->>'fieldName') from items where col = 'club' and id = 'club' and not deleted),
    'volTasks', (select data->'volTasks' from items where col = 'club' and id = 'club' and not deleted),
    'coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', trim(coalesce(st.data->>'firstName', '') || ' ' || coalesce(st.data->>'lastName', '')), 'role', st.data->>'role', 'phone', st.data->>'phone')
        order by st.data->>'lastName'), '[]'::jsonb) from items st where st.col = 'staff' and not st.deleted and st.data->>'phoneShow' = 'parents' and coalesce(st.data->>'phone', '') <> ''
        and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(st.data->'teamIds') = 'array' then st.data->'teamIds' else '[]'::jsonb end) x where x = any(tids))),
    'matches', (select coalesce(jsonb_agg(x order by x->>'date', x->>'time'), '[]'::jsonb) from (
      select jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'rdv', i.data->>'rdv', 'opponent', i.data->>'opponent',
        'home', coalesce((i.data->>'home')::boolean, false), 'place', i.data->>'place', 'competition', i.data->>'competition',
        'exempt', coalesce((i.data->>'exempt')::boolean, false), 'played', coalesce((i.data->>'played')::boolean, false), 'gf', i.data->'gf', 'ga', i.data->'ga',
        'team', (select t.data->>'name' from items t where t.col = 'teams' and t.id = i.data->>'teamId'),
        'open', not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today,
        'convoked', coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id, 'published', jsonb_array_length(coalesce(i.data->'convoked', '[]'::jsonb)) > 0,
        'answer', (select a.status from answers a where a.match_id = i.id and a.player_id = pl.id),
        'seats', (select a.seats from answers a where a.match_id = i.id and a.player_id = pl.id),
        'talk', case when not coalesce((i.data->>'played')::boolean, false) and i.data->>'date' >= today then jsonb_build_object(
          'objective', i.data#>>'{prep,talk,objective}', 'keys', coalesce(i.data#>'{prep,talk,keys}', '[]'::jsonb), 'final', i.data#>>'{prep,talk,final}',
          'video', i.data#>>'{prep,talk,videoUrl}', 'system', i.data#>>'{prep,plan,system}') else null end,
        'my', case when coalesce((i.data->>'played')::boolean, false) and coalesce(i.data->'convoked', '[]'::jsonb) ? pl.id then jsonb_build_object(
          'min', i.data#>>array['minutes', pl.id], 'g', i.data#>>array['stats', pl.id, 'g'], 'a', i.data#>>array['stats', pl.id, 'a']) else null end,
        'photos', (select coalesce(jsonb_agg(ph.id order by ph.created_at), '[]'::jsonb) from match_photos ph where ph.match_id = i.id),
        -- bénévoles : combien sont inscrits à chaque tâche, et si c'est moi (sans les noms des autres familles)
        'vol', case when i.data->>'date' >= today and jsonb_typeof(i.data->'vol') = 'object' then (select coalesce(jsonb_object_agg(v.key,
            (select coalesce(jsonb_agg(jsonb_build_object('mine', coalesce(e->>'pid', '') = pl.id, 'name', case when coalesce(e->>'pid', '') = pl.id then e->>'name' else null end)), '[]'::jsonb)
             from jsonb_array_elements(case when jsonb_typeof(v.value) = 'array' then v.value else '[]'::jsonb end) e)), '{}'::jsonb) from jsonb_each(i.data->'vol') v) else '{}'::jsonb end,
        -- covoiturage : les voitures et leurs places ; le nom du conducteur seulement pour la voiture de mon enfant
        'carpool', (select coalesce(jsonb_agg(jsonb_build_object('seats', coalesce((c->>'seats')::int, 0), 'from', c->>'from', 'time', c->>'time',
            'n', jsonb_array_length(case when jsonb_typeof(c->'kids') = 'array' then c->'kids' else '[]'::jsonb end),
            'mine', coalesce(c->'kids', '[]'::jsonb) ? pl.id, 'driver', case when coalesce(c->'kids', '[]'::jsonb) ? pl.id then c->>'driver' else null end)), '[]'::jsonb)
          from jsonb_array_elements(case when jsonb_typeof(i.data->'carpool') = 'array' then i.data->'carpool' else '[]'::jsonb end) c)) x
      from items i where i.col = 'matches' and not i.deleted and i.data->>'teamId' = any(tids)
        and i.data->>'date' between season and to_char(current_date + 60, 'YYYY-MM-DD')) s),
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title') order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i where i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(tids)
        and i.data->>'date' between today and to_char(current_date + 14, 'YYYY-MM-DD')));
end $$;
-- présent / absent pour un match où il est convoqué (et les places libres dans la voiture)
create or replace function member_answer(p_code text, p_match text, p_status text, p_seats int default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := raincy_member(p_code); m items;
begin
  select * into m from items where col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(raincy_member_teams(pl))) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? pl.id) then raise exception 'DONNEES'; end if;
  if coalesce((m.data->>'played')::boolean, false) or m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where match_id = p_match and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (match_id, player_id, status, seats, by_coach) values (p_match, pl.id, p_status, greatest(0, least(coalesce(p_seats, 0), 8)), false)
    on conflict (match_id, player_id) do update set status = excluded.status, seats = excluded.seats, by_coach = false, updated_at = now();
  return to_jsonb(true); end $$;
-- le questionnaire de bien-être du jour
create or replace function member_wellness(p_code text, p_mood int, p_mental int, p_sleep int, p_legs int, p_sore int, p_note text) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := raincy_member(p_code); w jsonb; d text := to_char(current_date, 'YYYY-MM-DD');
begin
  if least(p_mood, p_mental, p_sleep, p_legs, p_sore) < 1 or greatest(p_mood, p_mental, p_sleep, p_legs, p_sore) > 10 then raise exception 'DONNEES'; end if;
  w := (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(case when jsonb_typeof(pl.data->'wellness') = 'array' then pl.data->'wellness' else '[]'::jsonb end) e where e->>'day' <> d order by e->>'day' desc limit 119) q)
    || jsonb_build_array(jsonb_build_object('day', d, 'mood', p_mood, 'mental', p_mental, 'sleep', p_sleep, 'legs', p_legs, 'sore', p_sore, 'note', left(coalesce(p_note, ''), 200), 'self', true));
  update items set data = jsonb_set(data, '{wellness}', w), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev') where col = 'players' and id = pl.id;
  return to_jsonb(true); end $$;
-- un parent s'inscrit (ou se retire) pour une tâche de bénévole d'un match de la catégorie de son enfant
create or replace function member_volunteer(p_code text, p_match text, p_task text, p_label text, p_name text, p_remove boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare pl items := raincy_member(p_code); m items; v jsonb; lst jsonb; nm text := left(trim(coalesce(p_name, '')), 40);
begin
  if coalesce(p_task, '') !~ '^[A-Za-z0-9_-]{1,30}$' or (nm = '' and not coalesce(p_remove, false)) then raise exception 'DONNEES'; end if;
  select * into m from items where col = 'matches' and id = p_match and not deleted;
  if m.id is null or not (m.data->>'teamId' = any(raincy_member_teams(pl))) then raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  v := case when jsonb_typeof(m.data->'vol') = 'object' then m.data->'vol' else '{}'::jsonb end;
  lst := case when jsonb_typeof(v->p_task) = 'array' then v->p_task else '[]'::jsonb end;
  if coalesce(p_remove, false) then
    lst := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(lst) e where coalesce(e->>'pid', '') <> pl.id);
  elsif not exists (select 1 from jsonb_array_elements(lst) e where coalesce(e->>'pid', '') = pl.id) then
    if jsonb_array_length(lst) >= 8 then raise exception 'COMPLET'; end if;
    lst := lst || jsonb_build_array(jsonb_build_object('id', substr(md5(random()::text), 1, 12), 'name', nm, 'parent', true, 'pid', pl.id, 'label', left(coalesce(p_label, ''), 40)));
  end if;
  update items set data = jsonb_set(data, '{vol}', v || jsonb_build_object(p_task, lst)), updated_at = (extract(epoch from now()) * 1000)::bigint, rev = nextval('items_rev')
    where col = 'matches' and id = p_match;
  return (select coalesce(jsonb_agg(jsonb_build_object('mine', coalesce(e->>'pid', '') = pl.id, 'name', case when coalesce(e->>'pid', '') = pl.id then e->>'name' else null end)), '[]'::jsonb) from jsonb_array_elements(lst) e); end $$;
create or replace function member_photo(p_code text, p_id uuid) returns text language plpgsql stable security definer set search_path = public as $$
declare pl items := raincy_member(p_code);
begin return (select ph.data from match_photos ph join items i on i.col = 'matches' and i.id = ph.match_id and not i.deleted where ph.id = p_id and i.data->>'teamId' = any(raincy_member_teams(pl))); end $$;
revoke all on function raincy_member(text), raincy_code() from public, anon, authenticated;

-- un joueur ou un parent (avec son code personnel) envoie un message aux coachs de sa catégorie : son entraînement perso, ses footings. 10 par jour au plus.
create or replace function member_message(p_code text, p_body text, p_parent boolean default false) returns boolean language plpgsql security definer set search_path = public as $fn$
declare pl items := raincy_member(p_code); tids text[] := raincy_member_teams(pl); who text;
begin
  if coalesce(trim(p_body), '') = '' or coalesce(array_length(tids, 1), 0) = 0 then raise exception 'DONNEES'; end if;
  if (select count(*) from messages where author_id = 'member:' || pl.id and created_at > now() - interval '1 day') >= 10 then raise exception 'LIMITE'; end if;
  who := trim(coalesce(pl.data->>'firstName', '') || ' ' || coalesce(pl.data->>'lastName', '')) || case when p_parent then ' (parent)' else ' (joueur)' end;
  insert into messages (channel, author_id, author_name, body) values ('team:' || tids[1], 'member:' || pl.id, who, left(p_body, 2000));
  return true; end $fn$;
grant execute on function member_message(text, text, boolean) to anon, authenticated;
grant execute on function club_member_codes(text, text, text[], text[]), club_member_given(text, text, text, boolean), member_view(text, boolean), member_answer(text, text, text, int), member_wellness(text, int, int, int, int, int, text),
  member_volunteer(text, text, text, text, text, boolean), member_photo(text, uuid) to anon, authenticated;
-- les anciens liens d'équipe montraient les noms, réponses et temps de jeu de toute l'équipe : ils sont fermés
revoke execute on function parent_view(text), parent_answer(text, text, text, text, int, text), parent_volunteer(text, text, text, text, text, boolean), parent_photo(text, uuid),
  player_view(text), player_answer(text, text, text, text, text), player_wellness(text, text, int, int, int, int, int, text) from public, anon, authenticated;
-- (3.65) un joueur ou un parent répond présent / absent à un match OU à un entraînement, avec la raison de l'absence (malade, blessé, vacances…)
create or replace function member_reply(p_code text, p_kind text, p_id text, p_status text, p_seats int default 0, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $
declare pl items := raincy_member(p_code); m items; r text := nullif(left(trim(coalesce(p_reason, '')), 120), '');
begin
  if p_kind = 'match' then
    select * into m from items where col = 'matches' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(raincy_member_teams(pl))) or not (coalesce(m.data->'convoked', '[]'::jsonb) ? pl.id) then raise exception 'DONNEES'; end if;
    if coalesce((m.data->>'played')::boolean, false) then raise exception 'MATCH_PASSE'; end if;
  elsif p_kind = 'training' then
    select * into m from items where col = 'trainings' and id = p_id and not deleted;
    if m.id is null or not (m.data->>'teamId' = any(raincy_member_teams(pl))) then raise exception 'DONNEES'; end if;
  else raise exception 'DONNEES'; end if;
  if m.data->>'date' < to_char(current_date, 'YYYY-MM-DD') then raise exception 'MATCH_PASSE'; end if;
  if coalesce(p_status, '') = '' then delete from answers where match_id = p_id and player_id = pl.id; return to_jsonb(true); end if;
  if p_status not in ('oui', 'non') then raise exception 'DONNEES'; end if;
  insert into answers (match_id, player_id, status, seats, note, by_coach)
    values (p_id, pl.id, p_status, case when p_kind = 'match' and p_status = 'oui' then greatest(0, least(coalesce(p_seats, 0), 8)) else 0 end, case when p_status = 'non' then r end, false)
    on conflict (match_id, player_id) do update set status = excluded.status, seats = excluded.seats, note = excluded.note, by_coach = false, updated_at = now();
  return to_jsonb(true); end $;
-- ses réponses : les entraînements des 2 semaines à venir (avec sa réponse) et les raisons de ses absences aux matchs
create or replace function member_replies(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $
declare pl items := raincy_member(p_code); tids text[] := raincy_member_teams(pl); d0 text := to_char(current_date, 'YYYY-MM-DD');
begin
  return jsonb_build_object(
    'trainings', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'date', i.data->>'date', 'time', i.data->>'time', 'title', i.data->>'title', 'answer', a.status, 'reason', a.note)
        order by i.data->>'date', i.data->>'time'), '[]'::jsonb)
      from items i left join answers a on a.match_id = i.id and a.player_id = pl.id
      where i.col = 'trainings' and not i.deleted and not coalesce((i.data->>'model')::boolean, false) and i.data->>'teamId' = any(tids)
        and i.data->>'date' between d0 and to_char(current_date + 14, 'YYYY-MM-DD')),
    'reasons', (select coalesce(jsonb_object_agg(a.match_id, a.note), '{}'::jsonb) from answers a where a.player_id = pl.id and a.status = 'non' and a.note is not null and a.updated_at > now() - interval '120 days'));
end $;
grant execute on function member_reply(text, text, text, text, int, text), member_replies(text) to anon, authenticated;
-- (3.68) les joueurs et les parents prévenus sur leur téléphone : convocation envoyée, changement d'horaire ou de lieu, match ou séance annulés
create table if not exists member_subs (id uuid primary key default gen_random_uuid(), player_id text not null,
  endpoint text not null, page text not null default 'parents.html', created_at timestamptz not null default now(), unique (endpoint, player_id));
create table if not exists member_notifs (id bigserial primary key, player_id text not null,
  title text, body text, created_at timestamptz not null default now(), delivered boolean not null default false);
create index if not exists member_notifs_player on member_notifs (player_id, delivered);
alter table member_subs enable row level security;
alter table member_notifs enable row level security;
create or replace function member_arr(j jsonb) returns text[] language sql immutable as $
  select array(select jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end)) $;
-- ce téléphone est prévenu (ou plus) pour ce joueur ; renvoie la clé publique des notifications
create or replace function member_push(p_code text, p_endpoint text default null, p_on boolean default null, p_page text default null) returns jsonb language plpgsql security definer set search_path = public as $
declare pl items := raincy_member(p_code);
begin
  if coalesce(p_endpoint, '') <> '' and p_on is not null then
    if p_on then insert into member_subs (player_id, endpoint, page) values (pl.id, left(p_endpoint, 1000), case when p_page = 'joueurs.html' then 'joueurs.html' else 'parents.html' end)
      on conflict (endpoint, player_id) do update set page = excluded.page;
    else delete from member_subs where endpoint = p_endpoint and player_id = pl.id; end if;
  end if;
  return jsonb_build_object('key', (select vapid_public from push_config where id = 1),
    'on', exists (select 1 from member_subs where endpoint = coalesce(p_endpoint, '') and player_id = pl.id)); end $;
-- le téléphone réveillé lit ses notifications (celles des joueurs suivis sur ce téléphone)
create or replace function member_news(p_endpoint text) returns jsonb language plpgsql security definer set search_path = public as $
declare r jsonb;
begin
  if coalesce(p_endpoint, '') = '' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', n.title, 'body', n.body, 'url', s.page, 'tag', 'm' || n.id) order by n.id desc), '[]'::jsonb) into r
    from member_notifs n join member_subs s on s.player_id = n.player_id and s.endpoint = p_endpoint
    where not n.delivered and n.created_at > now() - interval '2 days';
  update member_notifs n set delivered = true from member_subs s where s.player_id = n.player_id and s.endpoint = p_endpoint and not n.delivered;
  delete from member_notifs where created_at < now() - interval '30 days';
  return r; end $;
-- une notification pour ces joueurs (seulement ceux qui ont un téléphone abonné), puis les téléphones sont réveillés
create or replace function member_note(c text, p_players text[], p_title text, p_body text) returns void language plpgsql security definer set search_path = public as $
declare subs jsonb; cfg push_config;
begin
  if coalesce(array_length(p_players, 1), 0) = 0 then return; end if;
  insert into member_notifs (player_id, title, body)
    select distinct s.player_id, left(p_title, 120), left(p_body, 240) from member_subs s where s.player_id = any(p_players);
  select jsonb_agg(jsonb_build_object('id', x.id, 'endpoint', x.endpoint)) into subs
    from (select distinct on (endpoint) id, endpoint from member_subs where player_id = any(p_players)) x;
  select * into cfg from push_config where id = 1;
  if subs is null or cfg.fn_url is null then return; end if;
  begin perform net.http_post(url := cfg.fn_url, body := jsonb_build_object('subs', subs), headers := jsonb_build_object('Content-Type', 'application/json', 'x-raincy-secret', cfg.secret));
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
end $;
create or replace function raincy_on_item_members() returns trigger language plpgsql security definer set search_path = public as $
declare d jsonb; o jsonb; ismatch boolean := new.col = 'matches'; dt date; team text; lbl text; body text; conv text[]; added text[];
begin
  if new.col not in ('matches', 'trainings') then return null; end if;
  begin
    if tg_op = 'UPDATE' and not old.deleted then o := old.data; end if;
    d := case when new.deleted then o else new.data end;
    if d is null or coalesce((d->>'model')::boolean, false) or coalesce((d->>'exempt')::boolean, false) then return null; end if;
    begin dt := (d->>'date')::date; exception when others then return null; end;
    if dt is null or dt < current_date or dt > current_date + 30 then return null; end if;
    team := d->>'teamId'; if coalesce(team, '') = '' then return null; end if;
    lbl := coalesce((select data->>'name' from items where col = 'teams' and id = team), '');
    body := raincy_day(dt) || coalesce(' · ' || replace(nullif(d->>'time', ''), ':', 'h'), '');
    if ismatch then
      body := (case when coalesce((d->>'home')::boolean, false) then 'contre ' else 'chez ' end) || coalesce(d->>'opponent', '?') || ' · ' || body
        || coalesce(' · RDV ' || replace(nullif(d->>'rdv', ''), ':', 'h'), '') || coalesce(' · ' || nullif(d->>'place', ''), '');
      conv := member_arr(d->'convoked');
      if new.deleted then perform member_note(null, conv, '❌ Match annulé · ' || lbl, body); return null; end if;
      if (d->>'convSent') is null then return null; end if; -- la convocation n'est pas encore envoyée par le coach
      if o is null or (o->>'convSent') is distinct from (d->>'convSent') then perform member_note(null, conv, '📣 Convocation · ' || lbl, body); return null; end if;
      added := array(select x from unnest(conv) x where not (coalesce(o->'convoked', '[]'::jsonb) ? x));
      if coalesce(array_length(added, 1), 0) > 0 then perform member_note(null, added, '📣 Convocation · ' || lbl, body); end if;
      if (d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time') or (d->>'rdv') is distinct from (o->>'rdv') or (d->>'place') is distinct from (o->>'place') then
        perform member_note(null, array(select x from unnest(conv) x where not (x = any(added))), '🕘 Changement · match ' || lbl, body);
      end if;
    else
      if dt > current_date + 7 then return null; end if;
      body := body || coalesce(' · ' || nullif(d->>'title', ''), '');
      conv := array(select i.id from items i where i.col = 'players' and not i.deleted and coalesce(i.data->'teamIds', '[]'::jsonb) ? team);
      if new.deleted then perform member_note(null, conv, '❌ Séance annulée · ' || lbl, body);
      elsif o is not null and ((d->>'date') is distinct from (o->>'date') or (d->>'time') is distinct from (o->>'time')) then perform member_note(null, conv, '🕘 Changement · séance ' || lbl, body); end if;
    end if;
  exception when others then raise notice 'notification des familles : %', sqlerrm; end;
  return null;
end $;
drop trigger if exists raincy_item_members on items;
create trigger raincy_item_members after insert or update on items for each row execute function raincy_on_item_members();
revoke all on function member_note(text, text[], text, text), raincy_on_item_members() from public, anon, authenticated;
revoke all on function member_push(text, text, boolean, text), member_news(text) from public;
grant execute on function member_push(text, text, boolean, text), member_news(text) to anon, authenticated;
-- (3.69) « Retirer l'accès » : un dirigeant marqué « blocked » ne peut plus créer de compte (même avec le lien d'invitation)
create or replace function club_register(k text, admin_k text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $
declare is_adm boolean := admin_ok(admin_k); sid text := p->>'staff_id'; s text := raincy_token(); a accounts;
begin
  if not (is_adm or club_ok(k)) then raise exception 'CLE_CLUB'; end if;
  if coalesce(sid, '') = '' or coalesce(p->>'last_key', '') = '' or length(coalesce(p->>'h', '')) < 32 then raise exception 'DONNEES'; end if;
  if not is_adm and exists (select 1 from items where col = 'staff' and id = sid and not deleted and coalesce(data->>'blocked', '') not in ('', 'false', 'null')) then raise exception 'ACCES_RETIRE'; end if;
  select * into a from accounts where staff_id = sid;
  if a.pw_hash is not null and not is_adm then raise exception 'DEJA_INSCRIT'; end if;
  insert into accounts (staff_id, last_key, first_keys, display, salt, pw_hash, admin)
    values (sid, p->>'last_key', array(select jsonb_array_elements_text(coalesce(p->'first_keys', '[]'::jsonb))), coalesce(p->>'display', ''), s,
            raincy_hash(s || (p->>'h')), coalesce((p->>'admin')::boolean, false) and is_adm)
    on conflict (staff_id) do update set last_key = excluded.last_key, first_keys = excluded.first_keys, display = excluded.display, salt = excluded.salt,
      pw_hash = excluded.pw_hash, admin = accounts.admin or excluded.admin, updated_at = now();
  delete from sessions where staff_id = sid;
  return raincy_new_session(sid);
end $;
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
    // parents (3.8)
    memberCodes: (ids, renew) => rpc('club_member_codes', { admin_k: adminKey() || null, p_players: ids, p_renew: renew || [] }),
    memberGiven: (id, given) => rpc('club_member_given', { admin_k: adminKey() || null, p_player: id, p_given: !!given }),
    parentLink: (teamKey, teamIds, teamName, renew) => rpc('club_parent_link', { p_team_key: teamKey, p_team_ids: teamIds, p_team_name: teamName, p_new: !!renew }),
    playerLink: (teamKey, teamIds, teamName, renew) => rpc('club_player_link', { p_team_key: teamKey, p_team_ids: teamIds, p_team_name: teamName, p_new: !!renew }),
    answers: matchIds => rpc('club_answers', { p_matches: matchIds }),
    // notifications and read receipts (3.15)
    pushKey: () => rpc('club_push_key'),
    pushSetup: url => rpc('club_push_setup', { admin_k: adminKey(), p_url: url }),
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

  /* ---------- setup (Réglages, responsable) ---------- */
  const { esc, $, toast, modal } = UI;
  function settingsSection() {
    const c = cfg(), admin = Auth.isAdmin(), sync = typeof Sync !== 'undefined' ? Sync.status() : '';
    return `<section class="card"><h2>${I.share}Serveur du club (comptes, données, messagerie, planning)</h2>
      <p>${ready() ? `<span class="res res-V">Connecté</span> ${esc(c.url.replace(/^https?:\/\//, ''))}` : '<span class="res res-D">Non connecté</span> Les comptes, le partage des données, la messagerie et le planning ont besoin du serveur du club.'}</p>
      ${sync ? `<p class="muted small">${esc(sync)}</p>` : ''}
      ${admin ? `<div class="chips">${ready() ? `<button class="btn primary" data-cloud="invite">${I.share}<span>Inviter les éducateurs</span></button>` : ''}
        ${!ready() && builtIn() ? `<button class="btn primary" data-cloud="connect">${I.check}<span>Me connecter au serveur du club</span></button>` : ''}
        ${!builtIn() ? `<button class="btn" data-cloud="setup">${I.edit}<span>${ready() ? 'Reconfigurer' : 'Configurer le serveur'}</span></button>` : ''}
        ${ready() ? `<button class="btn" data-cloud="test">${I.check}<span>Tester</span></button><button class="btn" data-cloud="update">${I.rotate}<span>Mettre à jour le serveur</span></button><button class="btn" data-cloud="adminkey">${I.whistle}<span>Code responsable</span></button>` : ''}</div>
        ${ready() ? Notify.adminCard() : ''}
        <p class="muted small">Les éducateurs rejoignent le club avec le lien d'invitation, puis se connectent sur n'importe quel appareil avec leur nom et leur mot de passe.</p>`
      : !ready() && builtIn() ? `<div class="chips"><button class="btn primary" data-cloud="connect">${I.check}<span>Me connecter au serveur du club</span></button></div>`
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
    if (b.dataset.cloud === 'connect') return Auth.connectServer();
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

  return Object.assign(api, { ready, invitePerson, canLogin, cfg, adminKey, token, genKey, sql, settingsSection, onSettingsClick, shareInvite });
})();
