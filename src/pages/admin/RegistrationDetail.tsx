import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, Mail, Phone, Printer, X } from 'lucide-react';
import { referralLabel } from '@shared/registration.ts';
import { getSupabase, type RegistrationRow } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/format';
import { consentGivenBy } from '../../lib/exporters';
import { ABtn, Badge, Initials } from './ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule px-6 py-5">
      <h3 className="text-[13px] font-semibold text-muted">{title}</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}
function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-ink">{children === '' || children == null ? '—' : children}</dd>
    </div>
  );
}

/** Right-hand side panel with one registration (full screen on phones). */
export default function RegistrationDetail({
  id,
  onClose,
  onPrint,
}: {
  id: string | null;
  onClose: () => void;
  onPrint: (row: RegistrationRow) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [row, setRow] = useState<RegistrationRow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id && !d.open) {
      d.showModal();
      // Focus the panel itself (not the close button), so no focus ring flashes on open.
      d.querySelector<HTMLElement>('[data-panel]')?.focus();
    }
    if (!id && d.open) d.close();
  }, [id]);

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
    <dialog
      ref={ref}
      aria-label={row ? `Registration of ${row.full_name}` : 'Registration'}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="drawer fixed inset-y-0 left-auto right-0 m-0 h-svh max-h-none w-full max-w-none bg-white p-0 text-ink shadow-lift sm:max-w-[560px]"
    >
      {id && (
        <div data-panel tabIndex={-1} className="flex h-full flex-col outline-none">
          <header className="border-b border-rule px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                {row ? <Initials name={row.full_name} size="lg" /> : <span className="size-12 animate-pulse rounded-full bg-crema" />}
                <div className="min-w-0">
                  <h2 className="truncate text-[20px] font-bold leading-tight">{row?.full_name ?? 'Loading…'}</h2>
                  {row && (
                    <p className="mt-0.5 text-[13.5px] text-muted">
                      <span className="font-medium text-leaf">{row.registration_id}</span> · Submitted {formatDateTime(row.created_at)}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-crema hover:text-ink"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {row && (
              <div className="mt-4 flex flex-wrap gap-2">
                <ABtn variant="solid" icon={Printer} onClick={() => onPrint(row)}>
                  Download PDF
                </ABtn>
                <a href={`tel:${row.mobile_phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rule px-3.5 text-[14px] font-medium hover:bg-crema">
                  <Phone className="size-4" aria-hidden="true" /> Call
                </a>
                <a href={`mailto:${row.email}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rule px-3.5 text-[14px] font-medium hover:bg-crema">
                  <Mail className="size-4" aria-hidden="true" /> Email
                </a>
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {error && (
              <p className="m-6 flex gap-2 rounded-lg bg-error-soft p-4 text-[14.5px] text-error">
                <CircleAlert className="mt-0.5 size-4" aria-hidden="true" />
                {error}
              </p>
            )}
            {!row && !error && (
              <div className="space-y-3 p-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-crema" />
                ))}
              </div>
            )}
            {row && (
              <>
                <Section title="Personal information">
                  <Item label="Full name">{row.full_name}</Item>
                  <Item label="Date of birth">
                    {formatDate(row.date_of_birth)} · {row.age} years
                  </Item>
                  <Item label="Gender">{row.gender_self_description ? `${row.gender} (${row.gender_self_description})` : row.gender}</Item>
                </Section>
                <Section title="Contact">
                  <Item label="Mobile phone">{row.mobile_phone}</Item>
                  <Item label="Email ID">{row.email}</Item>
                  <Item label="Present address">{`${row.present_address}\n${row.present_pincode}`}</Item>
                  <Item label="Permanent address">
                    {row.permanent_same_as_present ? 'Same as present address' : `${row.permanent_address}\n${row.permanent_pincode}`}
                  </Item>
                </Section>
                <Section title="Background">
                  <Item label="Marital status">{row.marital_status}</Item>
                  <Item label="Educational level">{row.educational_level}</Item>
                  <Item label="Occupation">{row.occupation}</Item>
                </Section>
                <Section title="Emergency contact">
                  <Item label="Name">{row.emergency_contact_name}</Item>
                  <Item label="Relationship">{row.emergency_contact_relationship}</Item>
                  <Item label="Contact number">{row.emergency_contact_number}</Item>
                </Section>
                <Section title="History & referral">
                  <Item label="Registered before">{row.previously_registered ? 'Yes' : 'No'}</Item>
                  <Item label="Heard about Kappiness via">{referralLabel(row.referral_source, row.referral_other)}</Item>
                </Section>
                <Section title="Consent">
                  <Item label="Psychological examination / therapy">
                    {row.psychological_consent ? <Badge tone="positive">Consented</Badge> : <Badge>Not given</Badge>}
                  </Item>
                  <Item label="Research / education">
                    {row.research_permission ? <Badge tone="positive">Permitted</Badge> : <Badge>Not permitted</Badge>}
                  </Item>
                  <Item label="Consent given by">{consentGivenBy(row)}</Item>
                  <Item label="Consent date">{formatDate(row.consent_date)}</Item>
                  <Item label="Terms accepted">{formatDateTime(row.terms_accepted_at)}</Item>
                  <Item label="Consent wording version">{row.consent_version}</Item>
                  {row.signature_method === 'drawn' && (
                    <Item label="Signature" wide>
                      <img src={row.digital_signature} alt={`Drawn signature of ${row.full_name}`} className="mt-1 h-20 rounded-lg border border-rule bg-white p-2" />
                    </Item>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
