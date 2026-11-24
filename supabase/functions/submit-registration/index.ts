/**
 * submit-registration — the ONLY way a patient registration reaches the database.
 *
 * 1. CORS / origin check      5. Server-side validation (shared rules)
 * 2. Size + shape checks       6. Consent checks (mandatory consent, version)
 * 3. Rate limiting (hashed IP) 7. Insert with service role → DB generates KAP-YYYY-NNNNN
 * 4. CAPTCHA (Turnstile)       8. Respond with the registration ID only
 *
 * Retries are idempotent: the client sends the same `submissionKey` for every
 * attempt of one registration; a repeat returns the original registration ID.
 *
 * Never log request bodies or patient details from this function.
 *
 * Secrets (supabase secrets set ...):
 *   ALLOWED_ORIGINS        e.g. https://register.kappiness.in,http://localhost:5173
 *   TURNSTILE_SECRET_KEY   Cloudflare Turnstile secret (required in production)
 *   RATE_LIMIT_SALT        random string used to hash client IPs
 * Provided automatically by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, isOriginAllowed } from '../_shared/cors.ts';
import {
  calculateAge,
  CONSENT_VERSION,
  type RegistrationValues,
  type SubmissionRequest,
  todayInZone,
  validateAll,
} from '../_shared/registration.ts';

const MAX_BODY_BYTES = 300_000;
const RATE_LIMIT_MAX = 5; // submissions…
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // …per client per hour
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY not set — CAPTCHA disabled. Set it before going live.');
    return true;
  }
  if (!token || token.length > 4096) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({ success: false }));
  return data.success === true;
}

/** Strictly pick and type-check the expected fields; anything else is dropped. */
function coerceValues(raw: unknown): RegistrationValues | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
  const bool = (k: string) => r[k] === true;
  return {
    fullName: str('fullName'),
    dateOfBirth: str('dateOfBirth'),
    gender: str('gender'),
    genderOther: str('genderOther'),
    mobilePhone: str('mobilePhone'),
    email: str('email'),
    presentAddress: str('presentAddress'),
    presentPincode: str('presentPincode'),
    permanentSameAsPresent: bool('permanentSameAsPresent'),
    permanentAddress: str('permanentAddress'),
    permanentPincode: str('permanentPincode'),
    maritalStatus: str('maritalStatus'),
    educationalLevel: str('educationalLevel'),
    occupation: str('occupation'),
    emergencyName: str('emergencyName'),
    emergencyRelationship: str('emergencyRelationship'),
    emergencyNumber: str('emergencyNumber'),
    previouslyRegistered: str('previouslyRegistered') as RegistrationValues['previouslyRegistered'],
    referralSource: str('referralSource') as RegistrationValues['referralSource'],
    referralOther: str('referralOther'),
    psychologicalConsent: bool('psychologicalConsent'),
    researchPermission: str('researchPermission') as RegistrationValues['researchPermission'],
    signatureMethod: str('signatureMethod') === 'drawn' ? 'drawn' : str('signatureMethod') === 'typed' ? 'typed' : 'checkbox',
    signatureTyped: str('signatureTyped'),
    signatureDrawn: str('signatureDrawn'),
    consentDate: str('consentDate'),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!isOriginAllowed(origin)) return json(403, { error: 'forbidden' }, origin);

  const length = Number(req.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return json(413, { error: 'too_large' }, origin);

  let body: SubmissionRequest;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' }, origin);
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'invalid_request' }, origin);
  }

  // Honeypot: real people never fill this hidden field.
  if (typeof body.website === 'string' && body.website.length > 0) return json(400, { error: 'invalid_request' }, origin);

  if (typeof body.submissionKey !== 'string' || !UUID_RE.test(body.submissionKey)) {
    return json(400, { error: 'invalid_request' }, origin);
  }

  try {
    // ---- Idempotent retry: already saved? return the same ID. ----
    const existing = await supabase
      .from('patient_registrations')
      .select('registration_id')
      .eq('submission_key', body.submissionKey)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return json(200, { registrationId: existing.data.registration_id, duplicate: true }, origin);

    // ---- Rate limit (hashed IP, never stored in clear) ----
    const ip = clientIp(req);
    const clientKey = await sha256(`${Deno.env.get('RATE_LIMIT_SALT') ?? ''}:${ip}`);
    const rl = await supabase.rpc('record_submission_attempt', {
      p_client_key: clientKey,
      p_max: RATE_LIMIT_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (rl.error) throw rl.error;
    if (rl.data !== true) return json(429, { error: 'rate_limited' }, origin);

    // ---- CAPTCHA ----
    if (!(await verifyTurnstile(body.captchaToken, ip))) return json(400, { error: 'captcha_failed' }, origin);

    // ---- Consent version & validation ----
    if (body.consentVersion !== CONSENT_VERSION) return json(409, { error: 'consent_version_mismatch' }, origin);
    const termsAt = new Date(typeof body.termsAcceptedAt === 'string' ? body.termsAcceptedAt : '');
    if (Number.isNaN(termsAt.getTime()) || termsAt.getTime() > Date.now() + 5 * 60_000) {
      return json(422, { error: 'validation', fields: ['termsAcceptedAt'] }, origin);
    }

    const v = coerceValues(body.values);
    if (!v) return json(400, { error: 'invalid_request' }, origin);

    // Allow one day of clock/time-zone skew for "not in the future" checks.
    const tomorrowIst = todayInZone('Asia/Kolkata', new Date(Date.now() + 24 * 3600_000));
    const errors = validateAll(v, tomorrowIst);
    if (Object.keys(errors).length) {
      // Field names only — never echo submitted values.
      return json(422, { error: 'validation', fields: Object.keys(errors) }, origin);
    }

    const age = calculateAge(v.dateOfBirth, todayInZone('Asia/Kolkata')) ?? 0;
    const permanentAddress = v.permanentSameAsPresent ? v.presentAddress : v.permanentAddress;
    const permanentPincode = v.permanentSameAsPresent ? v.presentPincode : v.permanentPincode;

    // ---- Insert (registration_id is generated inside the database) ----
    const insert = await supabase
      .from('patient_registrations')
      .insert({
        submission_key: body.submissionKey,
        full_name: v.fullName.trim(),
        date_of_birth: v.dateOfBirth,
        age,
        gender: v.gender,
        gender_self_description: v.gender === 'Other' && v.genderOther.trim() ? v.genderOther.trim() : null,
        mobile_phone: v.mobilePhone.trim(),
        email: v.email.trim().toLowerCase(),
        present_address: v.presentAddress.trim(),
        present_pincode: v.presentPincode.trim(),
        permanent_same_as_present: v.permanentSameAsPresent,
        permanent_address: permanentAddress.trim(),
        permanent_pincode: permanentPincode.trim(),
        marital_status: v.maritalStatus,
        educational_level: v.educationalLevel,
        occupation: v.occupation.trim(),
        emergency_contact_name: v.emergencyName.trim(),
        emergency_contact_relationship: v.emergencyRelationship.trim(),
        emergency_contact_number: v.emergencyNumber.trim(),
        previously_registered: v.previouslyRegistered === 'yes',
        referral_source: v.referralSource,
        referral_other: v.referralSource === 'other' ? v.referralOther.trim() : null,
        terms_accepted_at: termsAt.toISOString(),
        psychological_consent: true,
        research_permission: v.researchPermission === 'yes',
        signature_method: v.signatureMethod,
        // 'checkbox': the person's full name is recorded alongside the ticked consent.
        digital_signature:
          v.signatureMethod === 'drawn' ? v.signatureDrawn : v.signatureMethod === 'typed' ? v.signatureTyped.trim() : v.fullName.trim(),
        consent_date: v.consentDate,
        consent_version: CONSENT_VERSION,
      })
      .select('registration_id')
      .single();

    if (insert.error) {
      // Lost a race with a concurrent retry of the same submission.
      if (insert.error.code === '23505' && insert.error.message.includes('submission_key')) {
        const again = await supabase
          .from('patient_registrations')
          .select('registration_id')
          .eq('submission_key', body.submissionKey)
          .single();
        if (!again.error) return json(200, { registrationId: again.data.registration_id, duplicate: true }, origin);
      }
      throw insert.error;
    }

    return json(201, { registrationId: insert.data.registration_id }, origin);
  } catch (err) {
    // Log only a code — never the payload.
    const code = (err as { code?: string })?.code ?? 'unknown';
    console.error('submit-registration failed', { code });
    return json(500, { error: 'server_error' }, origin);
  }
});
