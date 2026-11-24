-- =====================================================================
-- Kappiness — patient registration schema
-- Sensitive personal data. Every table has RLS enabled. Patients never
-- talk to these tables directly: inserts happen only through the
-- `submit-registration` Edge Function using the service role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Consent versions: the exact wording each registration accepted.
-- Never UPDATE a row here; add a new version instead.
-- ---------------------------------------------------------------------
create table public.consent_versions (
  version        text primary key,
  content        jsonb not null,
  effective_from timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

insert into public.consent_versions (version, content) values (
  'KAP-CONSENT-2026-01',
  jsonb_build_object(
    'source', 'Kappiness paper registration form',
    'therapy', jsonb_build_object(
      'title', 'Consent for Psychological Examination',
      'statement', 'I, [full name], voluntarily consent to undergo psychological evaluation and/or therapy provided by the clinic. I understand that:',
      'understandings', jsonb_build_array(
        'The therapy sessions will involve discussions of personal and sensitive topics.',
        'The information shared will be kept confidential, except in cases where disclosure is required by law (e.g., risk of harm to self/others, abuse reporting).',
        'Therapy outcomes may vary depending on individual circumstances.'
      )
    ),
    'research', 'I also grant permission to the clinic to: Use anonymous, non-identifiable data for research or educational purposes. [Yes / No]',
    'fees', jsonb_build_array(
      'Standard Fee per Session is ₹1800/-.',
      'If the session time exceeds 1 hour, an additional charge of ₹500 per 30 minutes will apply.'
    ),
    'declaration', 'By submitting this form, I confirm that I understand the nature of the services and consent to proceed.',
    'initial_agreement', 'I have read and understood the terms and conditions and agree to proceed with registration.'
  )
);

create or replace function public.prevent_consent_version_change()
returns trigger language plpgsql as $$
begin
  raise exception 'consent_versions rows are immutable; insert a new version instead';
end $$;

create trigger consent_versions_immutable
  before update or delete on public.consent_versions
  for each row execute function public.prevent_consent_version_change();

-- ---------------------------------------------------------------------
-- Registration IDs: KAP-2026-00001, one counter row per year.
-- The upsert takes a row lock, so concurrent inserts are serialised and
-- can never receive the same number. (A failed insert may leave a gap.)
-- ---------------------------------------------------------------------
create table public.registration_counters (
  year       integer primary key,
  last_value integer not null default 0
);

create or replace function public.next_registration_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := extract(year from (now() at time zone 'Asia/Kolkata'))::integer;
  n integer;
begin
  insert into public.registration_counters (year, last_value)
  values (y, 1)
  on conflict (year) do update set last_value = public.registration_counters.last_value + 1
  returning last_value into n;
  return 'KAP-' || y || '-' || case when n < 100000 then lpad(n::text, 5, '0') else n::text end;
end $$;

-- ---------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------
create table public.patient_registrations (
  id                              uuid primary key default gen_random_uuid(),
  registration_id                 text not null unique default public.next_registration_id(),
  created_at                      timestamptz not null default now(),
  submission_key                  uuid not null unique,

  -- Personal information
  full_name                       text not null check (char_length(btrim(full_name)) between 2 and 120),
  date_of_birth                   date not null check (date_of_birth >= date '1900-01-01'),
  age                             smallint not null check (age between 0 and 130),
  gender                          text not null check (gender in ('Female','Male','Non-binary','Transgender','Other','Prefer not to say')),
  gender_self_description         text check (char_length(gender_self_description) <= 120),

  -- Contact information
  mobile_phone                    text not null check (char_length(mobile_phone) between 8 and 20),
  email                           text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),
  present_address                 text not null check (char_length(present_address) between 1 and 500),
  present_pincode                 text not null check (present_pincode ~ '^[1-9][0-9]{5}$'),
  permanent_same_as_present       boolean not null default false,
  permanent_address               text not null check (char_length(permanent_address) between 1 and 500),
  permanent_pincode               text not null check (permanent_pincode ~ '^[1-9][0-9]{5}$'),

  -- Personal background
  marital_status                  text not null check (char_length(marital_status) <= 60),
  educational_level               text not null check (char_length(educational_level) <= 60),
  occupation                      text not null check (char_length(occupation) between 1 and 120),

  -- Emergency contact
  emergency_contact_name          text not null check (char_length(emergency_contact_name) between 1 and 120),
  emergency_contact_relationship  text not null check (char_length(emergency_contact_relationship) between 1 and 120),
  emergency_contact_number        text not null check (char_length(emergency_contact_number) between 8 and 20),

  -- History & referral
  previously_registered           boolean not null,
  referral_source                 text not null check (referral_source in ('friends_family','social_media','internet','healthcare_professional','other')),
  referral_other                  text check (char_length(referral_other) <= 120),

  -- Consent
  terms_accepted_at               timestamptz not null,
  psychological_consent           boolean not null check (psychological_consent = true),
  research_permission             boolean not null,
  signature_method                text not null check (signature_method in ('checkbox','typed','drawn')),
  digital_signature               text not null check (char_length(digital_signature) between 2 and 250000),
  consent_date                    date not null,
  consent_version                 text not null references public.consent_versions (version),

  constraint referral_other_required check (referral_source <> 'other' or char_length(btrim(coalesce(referral_other, ''))) > 0)
);

comment on table public.patient_registrations is 'Sensitive personal data. Insert only via the submit-registration Edge Function. Readable only by staff (RLS).';

create index patient_registrations_created_at_idx on public.patient_registrations (created_at desc);
create index patient_registrations_full_name_idx on public.patient_registrations (lower(full_name));

-- ---------------------------------------------------------------------
-- Staff (clinic personnel allowed to view registrations)
-- Rows are created only by a database owner (SQL editor / migration),
-- never from the app, so nobody can grant themselves access.
-- ---------------------------------------------------------------------
create table public.staff_members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin','staff')),
  full_name  text,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Abuse protection: per-client submission attempts (hashed IPs only)
-- ---------------------------------------------------------------------
create table public.submission_attempts (
  id         bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);
create index submission_attempts_lookup_idx on public.submission_attempts (client_key, created_at desc);

create or replace function public.record_submission_attempt(p_client_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  -- housekeeping: keep the table small
  delete from public.submission_attempts where created_at < now() - interval '1 day';

  select count(*) into recent
  from public.submission_attempts
  where client_key = p_client_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if recent >= p_max then
    return false;
  end if;

  insert into public.submission_attempts (client_key) values (p_client_key);
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Admin audit log (exports)
-- ---------------------------------------------------------------------
create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  action     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Dashboard RPCs (staff only)
-- ---------------------------------------------------------------------
create or replace function public.registration_stats()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.is_staff() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return json_build_object(
    'total', (select count(*) from public.patient_registrations),
    'today', (select count(*) from public.patient_registrations where created_at >= today_start),
    'this_month', (select count(*) from public.patient_registrations where created_at >= month_start)
  );
end $$;

create or replace function public.export_registrations(p_from date default null, p_to date default null)
returns setof public.patient_registrations
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  insert into public.admin_audit_log (user_id, action, detail)
  values (auth.uid(), 'export_csv', jsonb_build_object('from', p_from, 'to', p_to));
  return query
    select * from public.patient_registrations r
    where (p_from is null or r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata'))
      and (p_to is null or r.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata'))
    order by r.created_at desc;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.consent_versions      enable row level security;
alter table public.registration_counters enable row level security;
alter table public.patient_registrations enable row level security;
alter table public.staff_members         enable row level security;
alter table public.submission_attempts   enable row level security;
alter table public.admin_audit_log       enable row level security;

-- Staff can read registrations. No insert/update/delete policies exist for
-- anon or authenticated users, so those operations are always denied.
create policy "staff read registrations" on public.patient_registrations
  for select to authenticated using (public.is_staff());

create policy "staff read consent versions" on public.consent_versions
  for select to authenticated using (public.is_staff());

create policy "users read own staff row" on public.staff_members
  for select to authenticated using (user_id = auth.uid());

create policy "admins read audit log" on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- Defence in depth: strip default table privileges from client roles.
revoke all on public.patient_registrations, public.consent_versions, public.registration_counters,
              public.staff_members, public.submission_attempts, public.admin_audit_log
  from anon, authenticated;
grant select on public.patient_registrations, public.consent_versions, public.staff_members, public.admin_audit_log
  to authenticated;

-- Function privileges
revoke execute on function public.next_registration_id()                         from public, anon, authenticated;
revoke execute on function public.record_submission_attempt(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.registration_stats()                           from public, anon;
revoke execute on function public.export_registrations(date, date)               from public, anon;
revoke execute on function public.is_staff()                                     from public, anon;
revoke execute on function public.is_admin()                                     from public, anon;
grant  execute on function public.registration_stats()             to authenticated;
grant  execute on function public.export_registrations(date, date) to authenticated;
grant  execute on function public.is_staff()                       to authenticated;
grant  execute on function public.is_admin()                       to authenticated;
grant  execute on function public.next_registration_id()                          to service_role;
grant  execute on function public.record_submission_attempt(text, integer, integer) to service_role;
grant  all on public.patient_registrations, public.registration_counters, public.submission_attempts,
              public.consent_versions to service_role;
