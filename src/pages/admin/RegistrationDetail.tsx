import { useEffect, useState, type ReactNode } from 'react';
import { CircleAlert, FileText } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { referralLabel } from '@shared/registration.ts';
import { getSupabase, type RegistrationRow } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white/60 p-4 sm:p-5">
      <h3 className="font-sans text-[15px] font-semibold text-charcoal">{title}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}
function Row({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[12.5px] text-stone">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-charcoal">{value === '' || value === null || value === undefined ? '—' : value}</dd>
    </div>
  );
}
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

export default function RegistrationDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [row, setRow] = useState<RegistrationRow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    setRow(null);
    setError('');
    getSupabase()
      .from('patient_registrations')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError('Could not load this registration.');
        else setRow(data as RegistrationRow);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Modal open={Boolean(id)} onClose={onClose} size="xl" icon={FileText} eyebrow={row?.registration_id ?? 'Registration'} title={row?.full_name ?? 'Loading…'}>
      {error && (
        <p className="flex gap-2 rounded-2xl bg-clay-soft p-4 text-clay">
          <CircleAlert className="size-5" aria-hidden="true" />
          {error}
        </p>
      )}
      {!row && !error && <div className="h-64 animate-pulse rounded-2xl bg-ivory" />}
      {row && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-stone">
            <span>
              Registration ID <strong className="font-semibold text-forest">{row.registration_id}</strong>
            </span>
            <span>Submitted {formatDateTime(row.created_at)}</span>
          </div>

          <Section title="Personal information">
            <Row label="Full name" value={row.full_name} />
            <Row label="Date of birth" value={formatDate(row.date_of_birth)} />
            <Row label="Age (at registration)" value={row.age} />
            <Row label="Gender" value={row.gender_self_description ? `${row.gender} (${row.gender_self_description})` : row.gender} />
          </Section>

          <Section title="Contact information">
            <Row label="Mobile phone" value={<a className="underline decoration-olive underline-offset-4" href={`tel:${row.mobile_phone}`}>{row.mobile_phone}</a>} />
            <Row label="Email ID" value={<a className="underline decoration-olive underline-offset-4" href={`mailto:${row.email}`}>{row.email}</a>} />
            <Row label="Present address" value={`${row.present_address}\n${row.present_pincode}`} />
            <Row label="Permanent address" value={row.permanent_same_as_present ? 'Same as present address' : `${row.permanent_address}\n${row.permanent_pincode}`} />
          </Section>

          <Section title="Personal background">
            <Row label="Marital status" value={row.marital_status} />
            <Row label="Educational level" value={row.educational_level} />
            <Row label="Occupation" value={row.occupation} />
          </Section>

          <Section title="Emergency contact">
            <Row label="Name" value={row.emergency_contact_name} />
            <Row label="Relationship" value={row.emergency_contact_relationship} />
            <Row label="Contact number" value={row.emergency_contact_number} />
          </Section>

          <Section title="Registration history & referral">
            <Row label="Registered at Kappiness before" value={yesNo(row.previously_registered)} />
            <Row label="How they heard about Kappiness" value={referralLabel(row.referral_source, row.referral_other)} />
          </Section>

          <Section title="Consent">
            <Row label="Psychological examination consent" value={yesNo(row.psychological_consent)} />
            <Row label="Research / educational permission" value={yesNo(row.research_permission)} />
            <Row label="Terms accepted" value={formatDateTime(row.terms_accepted_at)} />
            <Row label="Consent date" value={formatDate(row.consent_date)} />
            <Row label="Consent wording version" value={row.consent_version} />
            <Row
              label={row.signature_method === 'checkbox' ? 'Consent given by' : `Signature (${row.signature_method})`}
              wide
              value={
                row.signature_method === 'checkbox' ? (
                  <span>Ticking the consent box and submitting, as {row.digital_signature}</span>
                ) : row.signature_method === 'drawn' ? (
                  <img src={row.digital_signature} alt={`Drawn signature of ${row.full_name}`} className="mt-1 h-24 rounded-2xl border border-line bg-white p-2" />
                ) : (
                  <span className="font-display text-[26px] italic text-forest">{row.digital_signature}</span>
                )
              }
            />
          </Section>
        </div>
      )}
    </Modal>
  );
}
