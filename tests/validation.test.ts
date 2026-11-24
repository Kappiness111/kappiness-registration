/**
 * Tests for the shared validation used by both the browser and the Edge Function.
 *   npm run test:validation
 */
import assert from 'node:assert/strict';
import {
  calculateAge,
  isValidPhone,
  todayInZone,
  validateAll,
  validateStep,
  type RegistrationValues,
} from '../supabase/functions/_shared/registration.ts';

const TODAY = '2026-11-23';
const valid: RegistrationValues = {
  fullName: 'Test Person',
  dateOfBirth: '1995-11-24',
  gender: 'Female',
  genderOther: '',
  mobilePhone: '98765 43210',
  email: 'test@example.com',
  presentAddress: 'Jagathy, Thiruvananthapuram',
  presentPincode: '695014',
  permanentSameAsPresent: true,
  permanentAddress: 'Jagathy, Thiruvananthapuram',
  permanentPincode: '695014',
  maritalStatus: 'Single',
  educationalLevel: "Bachelor's degree",
  occupation: 'Designer',
  emergencyName: 'Friend',
  emergencyRelationship: 'Friend',
  emergencyNumber: '+91 91234 56789',
  previouslyRegistered: 'no',
  referralSource: 'social_media',
  referralOther: '',
  psychologicalConsent: true,
  researchPermission: '',
  signatureMethod: 'typed',
  signatureTyped: 'Test Person',
  signatureDrawn: '',
  consentDate: TODAY,
};

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n   ', (e as Error).message);
    process.exitCode = 1;
  }
};
const errorsFor = (over: Partial<RegistrationValues>) => validateAll({ ...valid, ...over }, TODAY);

test('a complete registration has no errors', () => assert.deepEqual(validateAll(valid, TODAY), {}));
test('age is calculated correctly around the birthday', () => {
  assert.equal(calculateAge('1995-11-24', TODAY), 30); // birthday tomorrow
  assert.equal(calculateAge('1995-11-23', TODAY), 31); // birthday today
  assert.equal(calculateAge('2024-02-29', '2025-02-28'), 0);
  assert.equal(calculateAge('2030-01-01', TODAY), null);
});
test('phone numbers', () => {
  for (const ok of ['9876543210', '+91 98765 43210', '098765-43210', '+44 7911 123456']) assert.ok(isValidPhone(ok), ok);
  for (const bad of ['12345', '5876543210', '+91 12345 67890', 'abcdefghij']) assert.ok(!isValidPhone(bad), bad);
});
test('email format', () => {
  assert.ok(errorsFor({ email: 'not-an-email' }).email);
  assert.ok(errorsFor({ email: 'a@b' }).email);
  assert.ok(!errorsFor({ email: 'A.Name+tag@Example.co.in' }).email);
});
test('date of birth cannot be in the future or invalid', () => {
  assert.ok(errorsFor({ dateOfBirth: '2027-01-01' }).dateOfBirth);
  assert.ok(errorsFor({ dateOfBirth: '2026-02-30' }).dateOfBirth);
});
test('pincodes must be 6 digits', () => {
  assert.ok(errorsFor({ presentPincode: '69501' }).presentPincode);
  assert.ok(errorsFor({ permanentSameAsPresent: false, permanentPincode: '095014' }).permanentPincode);
});
test('permanent address is only required when it differs from present', () => {
  assert.ok(!errorsFor({ permanentSameAsPresent: true, permanentAddress: '', permanentPincode: '' }).permanentAddress);
  assert.ok(errorsFor({ permanentSameAsPresent: false, permanentAddress: '' }).permanentAddress);
});
test('emergency number must differ from own number', () => {
  assert.ok(errorsFor({ emergencyNumber: '+91 98765 43210' }).emergencyNumber);
});
test('"Other" referral requires detail', () => {
  assert.ok(errorsFor({ referralSource: 'other' }).referralOther);
  assert.ok(!errorsFor({ referralSource: 'other', referralOther: 'Poster' }).referralOther);
});
test('psychological consent is mandatory', () => assert.ok(errorsFor({ psychologicalConsent: false }).psychologicalConsent));
test('research permission is optional (yes, no or unanswered)', () => {
  for (const r of ['', 'yes', 'no'] as const) assert.ok(!errorsFor({ researchPermission: r }).researchPermission);
  assert.ok(errorsFor({ researchPermission: 'maybe' as never }).researchPermission);
});
test('consent by ticking the box needs no separate signature', () => {
  assert.deepEqual(errorsFor({ signatureMethod: 'checkbox', signatureTyped: '' }), {});
});
test('signature: typed name or a PNG drawing (still accepted by the server)', () => {
  assert.ok(errorsFor({ signatureTyped: '' }).signatureTyped);
  assert.ok(errorsFor({ signatureMethod: 'drawn', signatureDrawn: '' }).signatureDrawn);
  assert.ok(errorsFor({ signatureMethod: 'drawn', signatureDrawn: 'javascript:alert(1)' }).signatureDrawn);
  assert.ok(!errorsFor({ signatureMethod: 'drawn', signatureDrawn: 'data:image/png;base64,iVBORw0KGgo=' }).signatureDrawn);
});
test('options must come from the list (server cannot be fed arbitrary values)', () => {
  assert.ok(errorsFor({ gender: 'Robot' }).gender);
  assert.ok(errorsFor({ maritalStatus: 'x' }).maritalStatus);
  assert.ok(errorsFor({ referralSource: 'tv' as never }).referralSource);
});
test('length limits', () => assert.ok(errorsFor({ presentAddress: 'x'.repeat(501) }).presentAddress));
test('step validation only reports that step', () => {
  const e = validateStep('personal', { ...valid, email: 'bad', fullName: '' }, TODAY);
  assert.deepEqual(Object.keys(e), ['fullName']);
});
test('todayInZone returns an ISO date', () => assert.match(todayInZone('Asia/Kolkata'), /^\d{4}-\d{2}-\d{2}$/));

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
