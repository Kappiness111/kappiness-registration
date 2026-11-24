/**
 * Database tests: runs the real migration in an embedded PostgreSQL (PGlite)
 * with minimal stand-ins for Supabase's `auth` schema and API roles, then
 * verifies constraints, ID generation, RLS and RPC permissions.
 *
 *   npm run test:db
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const db = new PGlite();
let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n   ', e.message);
    process.exitCode = 1;
  }
};
const rejects = async (p, re) => {
  try {
    await p;
  } catch (e) {
    if (re && !re.test(e.message)) throw new Error(`unexpected error: ${e.message}`);
    return;
  }
  throw new Error('expected an error');
};

// --- Supabase stand-ins -------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase grants table privileges to API roles by default; mimic that.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

const migDir = resolve(import.meta.dirname, '../supabase/migrations');
for (const f of readdirSync(migDir).sort()) await db.exec(readFileSync(resolve(migDir, f), 'utf8'));
console.log('migrations applied');

const STAFF = '00000000-0000-0000-0000-00000000000a';
const ADMIN = '00000000-0000-0000-0000-00000000000b';
const PATIENTLIKE = '00000000-0000-0000-0000-00000000000c';
await db.exec(`
  insert into auth.users values ('${STAFF}', 'staff@x.test'), ('${ADMIN}', 'admin@x.test'), ('${PATIENTLIKE}', 'nobody@x.test');
  insert into public.staff_members (user_id, role) values ('${STAFF}', 'staff'), ('${ADMIN}', 'admin');
`);

/** Run statements as a given API role (and optional user id). */
async function as(role, uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

let n = 0;
const row = (over = {}) => ({
  submission_key: crypto.randomUUID(),
  full_name: `Test Patient ${++n}`,
  date_of_birth: '1995-06-15',
  age: 31,
  gender: 'Prefer not to say',
  mobile_phone: '9876543210',
  email: 'p@example.com',
  present_address: '12 Garden Lane',
  present_pincode: '695014',
  permanent_same_as_present: true,
  permanent_address: '12 Garden Lane',
  permanent_pincode: '695014',
  marital_status: 'Single',
  educational_level: "Master's degree",
  occupation: 'Designer',
  emergency_contact_name: 'Friend',
  emergency_contact_relationship: 'Friend',
  emergency_contact_number: '9123456789',
  previously_registered: false,
  referral_source: 'internet',
  referral_other: null,
  terms_accepted_at: new Date().toISOString(),
  psychological_consent: true,
  research_permission: false,
  signature_method: 'typed',
  digital_signature: 'Test Patient',
  consent_date: '2026-11-23',
  consent_version: 'KAP-CONSENT-2026-01',
  ...over,
});
const insertSql = (r) => {
  const cols = Object.keys(r);
  return {
    sql: `insert into public.patient_registrations (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning registration_id`,
    params: Object.values(r),
  };
};
const insertAs = (role, uid, r) => {
  const { sql, params } = insertSql(r);
  return as(role, uid, sql, params);
};

console.log('\nRegistration IDs');
const year = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric' });
await test('service role inserts get sequential unique KAP-YYYY-NNNNN ids', async () => {
  const ids = [];
  for (let i = 0; i < 25; i++) ids.push((await insertAs('service_role', null, row())).rows[0].registration_id);
  assert.equal(new Set(ids).size, 25);
  assert.equal(ids[0], `KAP-${year}-00001`);
  assert.equal(ids[24], `KAP-${year}-00025`);
});
// Note: PGlite executes queries one at a time; on real Postgres, concurrency
// safety comes from the row lock taken by the counter upsert.
await test('parallel insert requests never collide', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => insertAs('service_role', null, row())));
  const ids = results.map((r) => r.rows[0].registration_id);
  assert.equal(new Set(ids).size, 10);
});
await test('duplicate submission_key is rejected (idempotency)', async () => {
  const r = row();
  await insertAs('service_role', null, r);
  await rejects(insertAs('service_role', null, { ...r, full_name: 'Someone Else' }), /submission_key/);
});

console.log('\nConstraints');
await test('consent by checkbox is a valid signature method', async () => {
  const r = await insertAs('service_role', null, row({ signature_method: 'checkbox', digital_signature: 'Checkbox Person' }));
  assert.match(r.rows[0].registration_id, /^KAP-/);
});
await test('psychological consent must be true', () => rejects(insertAs('service_role', null, row({ psychological_consent: false })), /check/));
await test('"other" referral requires detail', () => rejects(insertAs('service_role', null, row({ referral_source: 'other' })), /referral_other_required/));
await test('invalid pincode rejected', () => rejects(insertAs('service_role', null, row({ present_pincode: '12345' })), /check/));
await test('unknown consent version rejected', () => rejects(insertAs('service_role', null, row({ consent_version: 'nope' })), /foreign key/));
await test('consent versions are immutable', async () => {
  await rejects(db.query(`update public.consent_versions set content = '{}'::jsonb`), /immutable/);
});

console.log('\nRow Level Security — public (anon)');
await test('anon cannot read registrations', () => rejects(as('anon', null, 'select * from public.patient_registrations'), /permission denied/));
await test('anon cannot insert registrations', () => rejects(insertAs('anon', null, row()), /permission denied/));
await test('anon cannot call stats', () => rejects(as('anon', null, 'select public.registration_stats()'), /permission denied/));
await test('anon cannot mint registration ids', () => rejects(as('anon', null, 'select public.next_registration_id()'), /permission denied/));
await test('anon cannot touch rate-limit function', () =>
  rejects(as('anon', null, `select public.record_submission_attempt('x', 5, 60)`), /permission denied/));

console.log('\nRow Level Security — signed-in non-staff');
await test('non-staff user sees zero registrations', async () => {
  const r = await as('authenticated', PATIENTLIKE, 'select count(*)::int c from public.patient_registrations');
  assert.equal(r.rows[0].c, 0);
});
await test('non-staff cannot read stats', () => rejects(as('authenticated', PATIENTLIKE, 'select public.registration_stats()'), /not authorised/));
await test('authenticated users cannot insert/update/delete registrations', async () => {
  await rejects(insertAs('authenticated', STAFF, row()), /permission denied/);
  await rejects(as('authenticated', ADMIN, `update public.patient_registrations set full_name = 'x'`), /permission denied/);
  await rejects(as('authenticated', ADMIN, `delete from public.patient_registrations`), /permission denied/);
});
await test('users cannot grant themselves staff access', () =>
  rejects(as('authenticated', PATIENTLIKE, `insert into public.staff_members (user_id, role) values ('${PATIENTLIKE}', 'admin')`), /permission denied/));

console.log('\nStaff & admin');
await test('staff can read all registrations', async () => {
  const r = await as('authenticated', STAFF, 'select count(*)::int c from public.patient_registrations');
  assert.equal(r.rows[0].c, 37);
});
await test('staff can read dashboard stats', async () => {
  const r = await as('authenticated', STAFF, 'select public.registration_stats() s');
  const s = r.rows[0].s;
  assert.equal(s.total, 37);
  assert.equal(s.today, 37);
  assert.equal(s.this_month, 37);
});
await test('staff (non-admin) cannot export CSV', () => rejects(as('authenticated', STAFF, 'select * from public.export_registrations()'), /not authorised/));
await test('admin can export, and the export is audit-logged', async () => {
  const r = await as('authenticated', ADMIN, 'select count(*)::int c from public.export_registrations()');
  assert.equal(r.rows[0].c, 37);
  const log = await as('authenticated', ADMIN, `select action from public.admin_audit_log`);
  assert.equal(log.rows[0].action, 'export_csv');
});
await test('staff can only see their own staff row', async () => {
  const r = await as('authenticated', STAFF, 'select user_id from public.staff_members');
  assert.deepEqual(r.rows.map((x) => x.user_id), [STAFF]);
});

console.log('\nRate limiting');
await test('record_submission_attempt enforces the limit per client key', async () => {
  const call = () => as('service_role', null, `select public.record_submission_attempt('ip-hash-1', 3, 3600) ok`);
  const results = [];
  for (let i = 0; i < 5; i++) results.push((await call()).rows[0].ok);
  assert.deepEqual(results, [true, true, true, false, false]);
  const other = await as('service_role', null, `select public.record_submission_attempt('ip-hash-2', 3, 3600) ok`);
  assert.equal(other.rows[0].ok, true);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
