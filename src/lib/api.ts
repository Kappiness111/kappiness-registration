/**
 * Patient-side API. The browser never writes to the database directly:
 * registrations go to the `submit-registration` Edge Function, which validates,
 * rate-limits, verifies CAPTCHA and inserts using a server-only key.
 */
import { CONSENT_VERSION, type RegistrationValues, type SubmissionRequest } from '@shared/registration.ts';
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

/** Shown in preview mode only; never a real registration. */
export const PREVIEW_ID = 'KAP-2026-00000';
export const isPreviewMode = !isSupabaseConfigured;

export class SubmissionError extends Error {
  constructor(
    message: string,
    public readonly kind: 'config' | 'network' | 'validation' | 'rate_limited' | 'captcha' | 'server',
    public readonly fields: string[] = [],
  ) {
    super(message);
  }
}

export async function submitRegistration(args: {
  submissionKey: string;
  termsAcceptedAt: string;
  values: RegistrationValues;
  captchaToken?: string;
  honeypot: string;
}): Promise<{ registrationId: string; preview?: boolean }> {
  if (!isSupabaseConfigured) {
    // PREVIEW MODE: no backend connected. Nothing is sent or stored anywhere;
    // the thank-you page says so clearly. Set the VITE_SUPABASE_* variables to go live.
    void args;
    await new Promise((r) => setTimeout(r, 700));
    return { registrationId: PREVIEW_ID, preview: true };
  }

  const body: SubmissionRequest = {
    submissionKey: args.submissionKey,
    consentVersion: CONSENT_VERSION,
    termsAcceptedAt: args.termsAcceptedAt,
    values: args.values,
    captchaToken: args.captchaToken,
    website: args.honeypot,
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY };
  // Legacy anon keys are JWTs and may also be sent as a bearer token.
  if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/submit-registration`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } catch {
    throw new SubmissionError(
      "We couldn't reach the registration service. Please check your internet connection and try again — your answers are still here.",
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => ({}))) as { registrationId?: string; error?: string; fields?: string[] };

  if (res.ok && typeof data.registrationId === 'string') return { registrationId: data.registrationId };

  switch (data.error) {
    case 'validation':
      throw new SubmissionError('Some details need another look. Please check the highlighted sections.', 'validation', data.fields ?? []);
    case 'rate_limited':
      throw new SubmissionError('Too many attempts from this connection. Please wait a little while and try again.', 'rate_limited');
    case 'captcha_failed':
      throw new SubmissionError('We could not verify the security check. Please complete it again and resubmit.', 'captcha');
    case 'consent_version_mismatch':
      throw new SubmissionError('The consent wording has been updated. Please refresh the page and review it again.', 'server');
    default:
      throw new SubmissionError(
        'Something went wrong on our side and your registration was not saved. Please try again in a moment.',
        'server',
      );
  }
}
