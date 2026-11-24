/**
 * Shared registration contract — imported by BOTH the React app (via Vite)
 * and the `submit-registration` Edge Function (via Deno).
 *
 * Keep this file dependency-free and runtime-agnostic.
 *
 * Consent wording is transcribed from the clinic's paper registration form.
 * If the wording ever changes, DO NOT edit the existing text: add a new
 * CONSENT_VERSION, add the new text, and add a migration inserting it into
 * `public.consent_versions`, so every stored registration still points at
 * the exact wording that patient accepted.
 */

export const CONSENT_VERSION = 'KAP-CONSENT-2026-01';

export const CONSENT_TEXT = {
  therapy: {
    title: 'Consent for Psychological Examination',
    statement: 'voluntarily consent to undergo psychological evaluation and/or therapy provided by the clinic.',
    understandingIntro: 'I understand that:',
    understandings: [
      'The therapy sessions will involve discussions of personal and sensitive topics.',
      'The information shared will be kept confidential, except in cases where disclosure is required by law (e.g., risk of harm to self/others, abuse reporting).',
      'Therapy outcomes may vary depending on individual circumstances.',
    ],
  },
  research: {
    title: 'Permission for Research or Educational Purposes',
    intro: 'I also grant permission to the clinic to:',
    statement: 'Use anonymous, non-identifiable data for research or educational purposes.',
  },
  fees: {
    title: 'Session Fees Agreement',
    items: [
      'Standard Fee per Session is ₹1800/-.',
      'If the session time exceeds 1 hour, an additional charge of ₹500 per 30 minutes will apply.',
    ],
  },
  declaration: 'By submitting this form, I confirm that I understand the nature of the services and consent to proceed.',
  initialAgreement: 'I have read and understood the terms and conditions and agree to proceed with registration.',
} as const;

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

export const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Transgender', 'Other', 'Prefer not to say'] as const;

export const MARITAL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Separated',
  'Divorced',
  'Widowed',
  'Other',
  'Prefer not to say',
] as const;

export const EDUCATION_OPTIONS = [
  'Below 10th standard',
  '10th standard / SSLC',
  '12th standard / Higher Secondary',
  'Diploma / ITI',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate / PhD',
  'Other',
] as const;

export const REFERRAL_OPTIONS = [
  { value: 'friends_family', label: 'Friends / Family' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'internet', label: 'Google / Internet' },
  { value: 'healthcare_professional', label: 'Doctor / Healthcare Professional' },
  { value: 'other', label: 'Other' },
] as const;

export type ReferralSource = (typeof REFERRAL_OPTIONS)[number]['value'];

export function referralLabel(value: string, other?: string | null): string {
  const label = REFERRAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return value === 'other' && other ? `Other: ${other}` : label;
}

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

export interface RegistrationValues {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: string;
  genderOther: string;
  mobilePhone: string;
  email: string;
  presentAddress: string;
  presentPincode: string;
  permanentSameAsPresent: boolean;
  permanentAddress: string;
  permanentPincode: string;
  maritalStatus: string;
  educationalLevel: string;
  occupation: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyNumber: string;
  previouslyRegistered: '' | 'yes' | 'no';
  referralSource: '' | ReferralSource;
  referralOther: string;
  psychologicalConsent: boolean;
  researchPermission: '' | 'yes' | 'no';
  /** 'checkbox' = consent given by ticking the consent box and submitting (no separate signature). */
  signatureMethod: 'checkbox' | 'typed' | 'drawn';
  signatureTyped: string;
  signatureDrawn: string; // PNG data URL
  consentDate: string; // YYYY-MM-DD
}

/** Body POSTed to the Edge Function. */
export interface SubmissionRequest {
  submissionKey: string; // client-generated UUID, makes retries idempotent
  consentVersion: string;
  termsAcceptedAt: string; // ISO timestamp of the initial T&C agreement
  values: RegistrationValues;
  captchaToken?: string;
  website?: string; // honeypot — must be empty
}

export type FieldErrors = Partial<Record<keyof RegistrationValues, string>>;

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

export type StepId = 'personal' | 'contact' | 'background' | 'emergency' | 'history' | 'referral' | 'consent';

export const STEPS: { id: StepId; title: string; short: string; fields: (keyof RegistrationValues)[] }[] = [
  { id: 'personal', title: 'Personal Information', short: 'Personal', fields: ['fullName', 'dateOfBirth', 'gender', 'genderOther'] },
  {
    id: 'contact',
    title: 'Contact Information',
    short: 'Contact',
    fields: ['mobilePhone', 'email', 'presentAddress', 'presentPincode', 'permanentAddress', 'permanentPincode'],
  },
  { id: 'background', title: 'Personal Background', short: 'Background', fields: ['maritalStatus', 'educationalLevel', 'occupation'] },
  { id: 'emergency', title: 'Emergency Contact', short: 'Emergency', fields: ['emergencyName', 'emergencyRelationship', 'emergencyNumber'] },
  { id: 'history', title: 'Registration History', short: 'History', fields: ['previouslyRegistered'] },
  { id: 'referral', title: 'Referral Information', short: 'Referral', fields: ['referralSource', 'referralOther'] },
  {
    id: 'consent',
    title: 'Final Consent',
    short: 'Consent',
    fields: ['psychologicalConsent', 'researchPermission', 'signatureTyped', 'signatureDrawn', 'consentDate'],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  name: 120,
  short: 120,
  address: 500,
  signatureDataUrl: 250_000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PINCODE_RE = /^[1-9]\d{5}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalisePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

/** Indian mobiles (optionally +91 / 91 / 0 prefixed) or international numbers starting with +. */
export function isValidPhone(value: string): boolean {
  const v = normalisePhone(value);
  if (/^(?:\+?91|0)?[6-9]\d{9}$/.test(v)) return true;
  return /^\+(?!91)[1-9]\d{7,14}$/.test(v);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Whole years between a YYYY-MM-DD date of birth and `today` (YYYY-MM-DD). */
export function calculateAge(dob: string, today: string): number | null {
  if (!isValidIsoDate(dob) || !isValidIsoDate(today) || dob > today) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

const filled = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : Boolean(v));
const tooLong = (v: string, max: number) => v.trim().length > max;

/* ------------------------------------------------------------------ */
/* Validation (used on every step in the browser and on the server)    */
/* ------------------------------------------------------------------ */

type Validator = (v: RegistrationValues, today: string) => FieldErrors;

const validators: Record<StepId, Validator> = {
  personal(v, today) {
    const e: FieldErrors = {};
    if (!filled(v.fullName)) e.fullName = 'Please enter your full name.';
    else if (v.fullName.trim().length < 2) e.fullName = 'Please enter your full name.';
    else if (tooLong(v.fullName, LIMITS.name)) e.fullName = 'Name is too long.';

    if (!filled(v.dateOfBirth)) e.dateOfBirth = 'Please enter your date of birth.';
    else if (!isValidIsoDate(v.dateOfBirth)) e.dateOfBirth = 'Please enter a valid date.';
    else if (v.dateOfBirth > today) e.dateOfBirth = 'Date of birth cannot be in the future.';
    else {
      const age = calculateAge(v.dateOfBirth, today);
      if (age === null || age > 120) e.dateOfBirth = 'Please check your date of birth.';
    }

    if (!filled(v.gender)) e.gender = 'Please select an option. “Prefer not to say” is available.';
    else if (!(GENDER_OPTIONS as readonly string[]).includes(v.gender)) e.gender = 'Please select an option from the list.';
    if (tooLong(v.genderOther, LIMITS.short)) e.genderOther = 'Please keep this shorter.';
    return e;
  },

  contact(v) {
    const e: FieldErrors = {};
    if (!filled(v.mobilePhone)) e.mobilePhone = 'Please enter your mobile number.';
    else if (!isValidPhone(v.mobilePhone)) e.mobilePhone = 'Enter a valid 10-digit mobile number, or an international number starting with +.';

    if (!filled(v.email)) e.email = 'Please enter your email ID.';
    else if (!EMAIL_RE.test(v.email.trim()) || tooLong(v.email, 254)) e.email = 'Please enter a valid email, e.g. name@example.com.';

    if (!filled(v.presentAddress)) e.presentAddress = 'Please enter your present address.';
    else if (tooLong(v.presentAddress, LIMITS.address)) e.presentAddress = 'Address is too long.';
    if (!filled(v.presentPincode)) e.presentPincode = 'Please enter the pincode.';
    else if (!PINCODE_RE.test(v.presentPincode.trim())) e.presentPincode = 'Pincode should be 6 digits.';

    // When "same as present" is ticked, the server copies the present address.
    if (!v.permanentSameAsPresent) {
      if (!filled(v.permanentAddress)) e.permanentAddress = 'Please enter your permanent address.';
      else if (tooLong(v.permanentAddress, LIMITS.address)) e.permanentAddress = 'Address is too long.';
      if (!filled(v.permanentPincode)) e.permanentPincode = 'Please enter the pincode.';
      else if (!PINCODE_RE.test(v.permanentPincode.trim())) e.permanentPincode = 'Pincode should be 6 digits.';
    }
    return e;
  },

  background(v) {
    const e: FieldErrors = {};
    if (!filled(v.maritalStatus)) e.maritalStatus = 'Please select your marital status.';
    else if (!(MARITAL_STATUS_OPTIONS as readonly string[]).includes(v.maritalStatus)) e.maritalStatus = 'Please select an option from the list.';
    if (!filled(v.educationalLevel)) e.educationalLevel = 'Please select your educational level.';
    else if (!(EDUCATION_OPTIONS as readonly string[]).includes(v.educationalLevel)) e.educationalLevel = 'Please select an option from the list.';
    if (!filled(v.occupation)) e.occupation = 'Please enter your occupation, e.g. Student, Homemaker, Retired.';
    else if (tooLong(v.occupation, LIMITS.short)) e.occupation = 'Please keep this shorter.';
    return e;
  },

  emergency(v) {
    const e: FieldErrors = {};
    if (!filled(v.emergencyName)) e.emergencyName = 'Please enter the name of your emergency contact.';
    else if (tooLong(v.emergencyName, LIMITS.name)) e.emergencyName = 'Name is too long.';
    if (!filled(v.emergencyRelationship)) e.emergencyRelationship = 'Please tell us how this person is related to you.';
    else if (tooLong(v.emergencyRelationship, LIMITS.short)) e.emergencyRelationship = 'Please keep this shorter.';
    if (!filled(v.emergencyNumber)) e.emergencyNumber = 'Please enter a contact number.';
    else if (!isValidPhone(v.emergencyNumber)) e.emergencyNumber = 'Enter a valid 10-digit mobile number, or an international number starting with +.';
    else if (v.mobilePhone && normalisePhone(v.emergencyNumber).slice(-10) === normalisePhone(v.mobilePhone).slice(-10)) {
      e.emergencyNumber = 'Please give a number different from your own.';
    }
    return e;
  },

  history(v) {
    const e: FieldErrors = {};
    if (v.previouslyRegistered !== 'yes' && v.previouslyRegistered !== 'no') e.previouslyRegistered = 'Please choose Yes or No.';
    return e;
  },

  referral(v) {
    const e: FieldErrors = {};
    if (!REFERRAL_OPTIONS.some((o) => o.value === v.referralSource)) e.referralSource = 'Please choose how you heard about Kappiness.';
    else if (v.referralSource === 'other' && !filled(v.referralOther)) e.referralOther = 'Please tell us where you heard about us.';
    if (tooLong(v.referralOther, LIMITS.short)) e.referralOther = 'Please keep this shorter.';
    return e;
  },

  consent(v, today) {
    const e: FieldErrors = {};
    if (v.psychologicalConsent !== true) e.psychologicalConsent = 'Your consent is required to complete registration.';
    // Optional: no answer is stored as "no permission".
    if (!['', 'yes', 'no'].includes(v.researchPermission)) e.researchPermission = 'Please choose Yes or No.';
    if (v.signatureMethod === 'checkbox') {
      // Consent is recorded by the ticked box above; nothing else to check.
    } else if (v.signatureMethod === 'typed') {
      if (!filled(v.signatureTyped) || v.signatureTyped.trim().length < 2) e.signatureTyped = 'Please type your full name as your signature.';
      else if (tooLong(v.signatureTyped, LIMITS.name)) e.signatureTyped = 'Signature is too long.';
    } else if (v.signatureMethod === 'drawn') {
      if (!v.signatureDrawn) e.signatureDrawn = 'Please draw your signature, or switch to typing your name.';
      else if (!v.signatureDrawn.startsWith('data:image/png;base64,') || v.signatureDrawn.length > LIMITS.signatureDataUrl) {
        e.signatureDrawn = 'Please clear and draw your signature again.';
      }
    } else {
      e.signatureTyped = 'Please add your signature.';
    }
    if (!filled(v.consentDate)) e.consentDate = 'Please enter the date.';
    else if (!isValidIsoDate(v.consentDate)) e.consentDate = 'Please enter a valid date.';
    else if (v.consentDate > today) e.consentDate = 'The date cannot be in the future.';
    return e;
  },
};

export function validateStep(step: StepId, values: RegistrationValues, today: string): FieldErrors {
  return validators[step](values, today);
}

export function validateAll(values: RegistrationValues, today: string): FieldErrors {
  return STEPS.reduce<FieldErrors>((acc, s) => ({ ...acc, ...validators[s.id](values, today) }), {});
}

/** Today's date (YYYY-MM-DD) in a given IANA time zone. */
export function todayInZone(timeZone = 'Asia/Kolkata', date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
