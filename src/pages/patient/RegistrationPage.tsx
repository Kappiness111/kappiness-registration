import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import Button from '../../components/ui/Button';
import Chips from '../../components/ui/Chips';
import { Checkbox, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import Turnstile from '../../components/Turnstile';
import {
  calculateAge,
  CONSENT_TEXT,
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  REFERRAL_OPTIONS,
  STEPS,
  validateAll,
  type FieldErrors,
  type RegistrationValues,
} from '@shared/registration.ts';
import { ML, type StringKey } from '../../features/registration/types';
import { submitRegistration, SubmissionError } from '../../lib/api';
import { TURNSTILE_SITE_KEY } from '../../lib/config';
import { formatDate, todayLocal } from '../../lib/format';

export interface FormState {
  values: RegistrationValues;
  submissionKey: string; // reused on retries so the server never creates duplicates
}

/** Field order, used to focus the first problem. */
const FIELD_ORDER = STEPS.flatMap((s) => s.fields);

function Section({ n, title, ml, children }: { n: number; title: string; ml?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-rule bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] leading-snug">
          {title}
          {ml && (
            <span lang="ml" className="ml-2 text-[12px] font-normal text-muted">
              {ml}
            </span>
          )}
        </h2>
        <span className="shrink-0 text-[13px] text-muted">{n} / 6</span>
      </div>
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

interface Props {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  termsAcceptedAt: string;
  onSubmitted: (registrationId: string, preview: boolean) => void;
  onReviewTerms: () => void;
}

export default function RegistrationPage({ form, setForm, termsAcceptedAt, onSubmitted, onReviewTerms }: Props) {
  const v = form.values;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [honeypot, setHoneypot] = useState('');
  const inFlight = useRef(false);

  // After the first attempt, errors update as people fix them.
  useEffect(() => {
    if (tried) setErrors(validateAll(v, todayLocal()));
  }, [v, tried]);

  const set = <K extends keyof RegistrationValues>(key: K, value: RegistrationValues[K]) =>
    setForm((f) => ({ ...f, values: { ...f.values, [key]: value } }));

  const bind = (key: StringKey) => ({
    id: key,
    value: v[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
    error: errors[key],
  });

  const age = calculateAge(v.dateOfBirth, todayLocal());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return; // no double submits
    setTried(true);
    const today = todayLocal();
    const values = { ...v, consentDate: today };
    const errs = validateAll(values, today);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = FIELD_ORDER.find((f) => errs[f]);
      const el = first && ((document.getElementById(first) ?? document.querySelector(`[name="${first}"]`)) as HTMLElement | null);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setSubmitError('Please complete the quick security check above.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { registrationId, preview } = await submitRegistration({
        submissionKey: form.submissionKey,
        termsAcceptedAt,
        values,
        captchaToken: captchaToken || undefined,
        honeypot,
      });
      onSubmitted(registrationId, Boolean(preview));
    } catch (err) {
      setSubmitError(err instanceof SubmissionError ? err.message : 'Something went wrong. Please try again.');
      if (TURNSTILE_SITE_KEY) setCaptchaReset((n) => n + 1);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const errorCount = tried ? Object.keys(errors).length : 0;

  return (
    <div className="animate-rise">
      <form noValidate onSubmit={submit} className="-mt-7 grid gap-4 sm:-mt-9">
        <Section n={1} title="About you">
          <TextField {...bind('fullName')} label="Full name" ml={ML.fullName} required autoComplete="name" autoCapitalize="words" />
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <TextField {...bind('dateOfBirth')} type="date" label="Date of birth" ml={ML.dateOfBirth} required max={todayLocal()} min="1900-01-01" autoComplete="bday" />
            <TextField id="age" label="Age" ml={ML.age} value={age === null ? '' : String(age)} readOnly placeholder="–" aria-live="polite" />
          </div>
          <Chips name="gender" label="Gender" ml={ML.gender} required options={GENDER_OPTIONS} value={v.gender} onChange={(x) => set('gender', x)} error={errors.gender} />
          {v.gender === 'Other' && <TextField {...bind('genderOther')} label="Your gender, in your own words" optional />}
        </Section>

        <Section n={2} title="Contact">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField {...bind('mobilePhone')} type="tel" inputMode="tel" label="Mobile phone" ml={ML.mobilePhone} required autoComplete="tel" placeholder="98765 43210" />
            <TextField {...bind('email')} type="email" inputMode="email" label="Email ID" ml={ML.email} required autoComplete="email" autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <TextAreaField {...bind('presentAddress')} rows={2} label="Present address" ml={ML.presentAddress} required autoComplete="street-address" />
            <TextField
              {...bind('presentPincode')}
              onChange={(e) => set('presentPincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
              label="Pincode"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
            />
          </div>
          <Checkbox id="permanentSameAsPresent" checked={v.permanentSameAsPresent} onChange={(c) => set('permanentSameAsPresent', c)}>
            Permanent address is the same as present address
          </Checkbox>
          {!v.permanentSameAsPresent && (
            <div className="grid animate-fade grid-cols-[1fr_110px] gap-3">
              <TextAreaField {...bind('permanentAddress')} rows={2} label="Permanent address" ml={ML.permanentAddress} required />
              <TextField
                {...bind('permanentPincode')}
                onChange={(e) => set('permanentPincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                label="Pincode"
                required
                inputMode="numeric"
                maxLength={6}
              />
            </div>
          )}
        </Section>

        <Section n={3} title="Background">
          <Chips name="maritalStatus" label="Marital status" ml={ML.maritalStatus} required options={MARITAL_STATUS_OPTIONS} value={v.maritalStatus} onChange={(x) => set('maritalStatus', x)} error={errors.maritalStatus} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField {...bind('educationalLevel')} label="Educational level" ml={ML.educationalLevel} required options={EDUCATION_OPTIONS} placeholder="Choose" />
            <TextField {...bind('occupation')} label="Occupation" ml={ML.occupation} required placeholder="e.g. Student, Teacher, Homemaker" />
          </div>
        </Section>

        <Section n={4} title="Emergency contact" ml={ML.emergency}>
          <TextField {...bind('emergencyName')} label="Name" ml={ML.emergencyName} required autoCapitalize="words" />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField {...bind('emergencyRelationship')} label="Relationship" ml={ML.emergencyRelationship} required placeholder="e.g. Mother, Friend" />
            <TextField {...bind('emergencyNumber')} type="tel" inputMode="tel" label="Contact number" ml={ML.emergencyNumber} required />
          </div>
        </Section>

        <Section n={5} title="Two quick questions">
          <Chips
            name="previouslyRegistered"
            label="Have you registered at Kappiness before?"
            ml={ML.previouslyRegistered}
            required
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={v.previouslyRegistered}
            onChange={(x) => set('previouslyRegistered', x as 'yes' | 'no')}
            error={errors.previouslyRegistered}
          />
          <Chips
            name="referralSource"
            label="How did you get to know about Kappiness?"
            ml={ML.referral}
            required
            options={REFERRAL_OPTIONS}
            value={v.referralSource}
            onChange={(x) => set('referralSource', x as RegistrationValues['referralSource'])}
            error={errors.referralSource}
          />
          {v.referralSource === 'other' && <TextField {...bind('referralOther')} label="Please tell us where" required />}
        </Section>

        <Section n={6} title="Consent">
          <div className="rounded-xl bg-crema p-4 text-[15px] leading-relaxed">
            <p>
              I, <strong className="font-semibold">{v.fullName.trim() || '__________'}</strong>, {CONSENT_TEXT.therapy.statement} I understand
              that:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {CONSENT_TEXT.therapy.understandings.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ol>
            <p className="mt-3 text-[14px] text-stone">Fees: ₹1800 per session; ₹500 extra for each 30 minutes beyond an hour.</p>
            <button type="button" onClick={onReviewTerms} className="-mb-2 min-h-11 cursor-pointer text-[14px] text-stone underline underline-offset-4 hover:text-charcoal">
              Read the terms again
            </button>
          </div>
          <Checkbox id="psychologicalConsent" checked={v.psychologicalConsent} onChange={(c) => set('psychologicalConsent', c)} error={errors.psychologicalConsent}>
            I agree to the above and consent to psychological evaluation and/or therapy. <span className="text-clay">*</span>
          </Checkbox>
          <Chips
            name="researchPermission"
            label={`${CONSENT_TEXT.research.intro} ${CONSENT_TEXT.research.statement.charAt(0).toLowerCase()}${CONSENT_TEXT.research.statement.slice(1)}`}
            hint="Optional. It doesn’t affect your registration."
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={v.researchPermission}
            onChange={(x) => set('researchPermission', x as 'yes' | 'no')}
            error={errors.researchPermission}
          />
          <p className="text-[13.5px] leading-snug text-muted">
            {CONSENT_TEXT.declaration} Date: {formatDate(todayLocal())}.
          </p>
        </Section>

        <Turnstile onToken={setCaptchaToken} resetSignal={captchaReset} />
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        <div className="mt-2 grid gap-3">
          {errorCount > 0 && (
            <p role="alert" className="flex gap-2 rounded-xl bg-error-soft p-3 text-[14.5px] font-medium text-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {errorCount === 1 ? 'One thing needs fixing above.' : `${errorCount} things need fixing above.`}
            </p>
          )}
          {submitError && (
            <p role="alert" className="flex gap-2 rounded-xl bg-error-soft p-3 text-[14.5px] leading-relaxed text-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {submitError}
            </p>
          )}
          <Button type="submit" variant="honey" size="lg" icon={ArrowRight} loading={submitting} className="w-full sm:w-auto">
            {submitting ? 'Sending…' : submitError ? 'Try again' : 'Submit registration'}
          </Button>
          <p className="text-[13.5px] text-muted">Sent securely to the clinic.</p>
        </div>
      </form>
    </div>
  );
}
