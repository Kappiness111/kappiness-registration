/**
 * Printable views for "Save as PDF". The browser's print dialog produces the
 * PDF, so fonts (including ₹ and Malayalam) render exactly as on screen.
 * Only #print-root is shown when printing; the app itself is hidden.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CONSENT_TEXT, referralLabel } from '@shared/registration.ts';
import { FullLogo } from '../../components/Brand';
import { CLINIC } from '../../lib/config';
import type { RegistrationRow } from '../../lib/supabase';
import { consentGivenBy } from '../../lib/exporters';
import { formatDate, formatDateTime } from '../../lib/format';

/** Renders `job.node` into the print area, opens the print dialog, then clears it. */
export function usePrint() {
  const [job, setJob] = useState<{ node: ReactNode; landscape: boolean; title: string } | null>(null);

  useEffect(() => {
    if (!job) return;
    const previousTitle = document.title;
    document.title = job.title; // becomes the suggested PDF file name
    const done = () => {
      document.title = previousTitle;
      setJob(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    const t = window.setTimeout(() => window.print(), 150); // let fonts/images settle
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [job]);

  const portal = job
    ? createPortal(
        <div id="print-root" className={job.landscape ? 'print-landscape' : ''}>
          {job.node}
        </div>,
        document.body,
      )
    : null;

  return { print: (node: ReactNode, opts: { title: string; landscape?: boolean }) => setJob({ node, landscape: Boolean(opts.landscape), title: opts.title }), portal };
}

function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-6 border-b-2 border-black pb-3">
      <div className="flex items-end gap-4">
        <FullLogo className="h-12" />
        <div>
          <p className="text-[11px] text-neutral-600">
            {CLINIC.tagline} · {CLINIC.initiative}
          </p>
          <h1 className="text-[20px] font-bold text-black">{title}</h1>
        </div>
      </div>
      <div className="text-right text-[11px] text-neutral-700">{right}</div>
    </header>
  );
}

function Field({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`border-b border-neutral-300 py-1 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-[9.5px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="whitespace-pre-wrap text-[12px] text-black">{value === '' || value == null ? '—' : value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h2 className="text-[12.5px] font-bold text-black">{title}</h2>
      <div className="grid grid-cols-2 gap-x-6">{children}</div>
    </section>
  );
}

const box = (on: boolean) => (on ? '☑' : '☐');

/** One registration, laid out like the clinic's paper form. */
export function RegistrationPrint({ r }: { r: RegistrationRow }) {
  return (
    <article className="text-black">
      <Header
        title="Registration record"
        right={
          <>
            <p className="text-[15px] font-bold text-black">{r.registration_id}</p>
            <p>Submitted {formatDateTime(r.created_at)}</p>
          </>
        }
      />

      <Section title="Personal information">
        <Field label="Full name" value={r.full_name} />
        <Field label="Date of birth / Age" value={`${formatDate(r.date_of_birth)} · ${r.age} years`} />
        <Field label="Gender" value={r.gender_self_description ? `${r.gender} (${r.gender_self_description})` : r.gender} />
      </Section>

      <Section title="Contact information">
        <Field label="Mobile phone" value={r.mobile_phone} />
        <Field label="Email ID" value={r.email} />
        <Field label="Present address with pincode" value={`${r.present_address}\n${r.present_pincode}`} />
        <Field
          label="Permanent address with pincode"
          value={r.permanent_same_as_present ? 'Same as present address' : `${r.permanent_address}\n${r.permanent_pincode}`}
        />
      </Section>

      <Section title="Personal background">
        <Field label="Marital status" value={r.marital_status} />
        <Field label="Educational level" value={r.educational_level} />
        <Field label="Occupation" value={r.occupation} />
      </Section>

      <Section title="Emergency contact">
        <Field label="Name" value={r.emergency_contact_name} />
        <Field label="Relationship" value={r.emergency_contact_relationship} />
        <Field label="Contact number" value={r.emergency_contact_number} />
      </Section>

      <Section title="Registration history & referral">
        <Field label="Registered at Kappiness before" value={r.previously_registered ? 'Yes' : 'No'} />
        <Field label="How they got to know about Kappiness" value={referralLabel(r.referral_source, r.referral_other)} />
      </Section>

      <section className="mt-3 break-inside-avoid text-[11px] leading-snug">
        <h2 className="text-[12.5px] font-bold">{CONSENT_TEXT.therapy.title}</h2>
        <p className="mt-1">
          {box(r.psychological_consent)} I, <strong>{r.full_name}</strong>, {CONSENT_TEXT.therapy.statement} {CONSENT_TEXT.therapy.understandingIntro}
        </p>
        <ol className="mt-1 list-decimal pl-5">
          {CONSENT_TEXT.therapy.understandings.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ol>
        <p className="mt-2">
          {CONSENT_TEXT.research.intro} {CONSENT_TEXT.research.statement} &nbsp; {box(r.research_permission)} Yes &nbsp; {box(!r.research_permission)} No
        </p>
        <p className="mt-2 font-bold">{CONSENT_TEXT.fees.title}</p>
        <ul className="list-disc pl-5">
          {CONSENT_TEXT.fees.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="mt-2">{CONSENT_TEXT.declaration}</p>
        <div className="mt-2 grid grid-cols-3 gap-6 border-t border-neutral-400 pt-2">
          <Field label="Consent given by" value={consentGivenBy(r)} />
          <Field label="Date" value={formatDate(r.consent_date)} />
          <Field label="Consent wording version" value={r.consent_version} />
        </div>
        {r.signature_method === 'drawn' && (
          <img src={r.digital_signature} alt="" className="mt-2 h-16 border border-neutral-300 p-1" />
        )}
      </section>

      <footer className="mt-3 border-t border-neutral-300 pt-1.5 text-[9.5px] text-neutral-500">
        Confidential. Contains personal and health-related information. {CLINIC.name}, {CLINIC.city}.
      </footer>
    </article>
  );
}

/** A table of many registrations (landscape). */
export function ListPrint({ rows, rangeLabel }: { rows: RegistrationRow[]; rangeLabel: string }) {
  return (
    <article className="text-black">
      <Header
        title="Registrations"
        right={
          <>
            <p>{rangeLabel}</p>
            <p>
              {rows.length} {rows.length === 1 ? 'registration' : 'registrations'} · printed {formatDateTime(new Date().toISOString())}
            </p>
          </>
        }
      />
      <table className="mt-3 w-full border-collapse text-left text-[10.5px]">
        <thead>
          <tr className="border-b-2 border-black">
            {['ID', 'Name', 'Age', 'Gender', 'Mobile', 'Email', 'Emergency contact', 'Heard via', 'Research', 'Registered'].map((h) => (
              <th key={h} className="py-1.5 pr-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="break-inside-avoid border-b border-neutral-300 align-top">
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">{r.registration_id}</td>
              <td className="py-1.5 pr-2">{r.full_name}</td>
              <td className="py-1.5 pr-2">{r.age}</td>
              <td className="py-1.5 pr-2">{r.gender}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap">{r.mobile_phone}</td>
              <td className="py-1.5 pr-2">{r.email}</td>
              <td className="py-1.5 pr-2">
                {r.emergency_contact_name} ({r.emergency_contact_relationship})<br />
                {r.emergency_contact_number}
              </td>
              <td className="py-1.5 pr-2">{referralLabel(r.referral_source, r.referral_other)}</td>
              <td className="py-1.5 pr-2">{r.research_permission ? 'Yes' : 'No'}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="mt-6 text-[12px]">No registrations in this range.</p>}
      <footer className="mt-6 border-t border-neutral-300 pt-2 text-[9.5px] text-neutral-500">
        Confidential. Contains personal and health-related information. {CLINIC.name}, {CLINIC.city}.
      </footer>
    </article>
  );
}
