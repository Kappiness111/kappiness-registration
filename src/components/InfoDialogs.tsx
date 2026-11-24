import type { ReactNode } from 'react';
import { LifeBuoy, Phone, ShieldCheck } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { CLINIC, CRISIS_LINES } from '../lib/config';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="font-sans text-[15.5px] font-semibold text-forest">{title}</h3>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-stone">{children}</div>
    </section>
  );
}

export function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={ShieldCheck}
      eyebrow="Privacy notice"
      title="How your information is handled"
      footer={
        <Button onClick={onClose} block className="sm:w-auto">
          I understand
        </Button>
      }
    >
      <Section title="What we collect">
        <p>
          The registration form asks for the details on the clinic’s paper registration form: personal and contact details, background,
          an emergency contact, previous registration, how you heard about us, your consent choices, signature and date. We treat all of
          it as sensitive personal information.
        </p>
      </Section>
      <Section title="Why we collect it">
        <p>
          To register you with {CLINIC.name}, to contact you about the next steps, and to reach your emergency contact if there is an
          emergency. Anonymous, non-identifiable data is used for research or education only if you answer “Yes” to that separate,
          optional question.
        </p>
      </Section>
      <Section title="How it is stored and who can see it">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-olive">
          <li>Your answers are sent over an encrypted (HTTPS) connection only when you press “Submit registration”.</li>
          <li>They are stored in the clinic’s secured database. Public visitors cannot read them; only authorised clinic staff who sign in can.</li>
          <li>While you fill in the form, nothing is saved in your browser’s storage. Refreshing or closing the page clears your answers.</li>
          <li>This website does not use advertising or analytics trackers.</li>
        </ul>
      </Section>
      <Section title="Confidentiality and its limits">
        <p>
          Information you share is kept confidential in line with the clinic’s policies, except where disclosure is required by law — for
          example a risk of harm to yourself or others, or abuse reporting.
        </p>
      </Section>
      <Section title="Your questions and requests">
        <p>
          To ask what information the clinic holds about you, or to request a correction or deletion, please contact {CLINIC.name}{' '}
          directly.
        </p>
      </Section>
    </Modal>
  );
}

export function CrisisDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} icon={LifeBuoy} eyebrow="You are not alone" title="If you need help right now">
      <p className="text-[15.5px] leading-relaxed text-stone">
        This registration form is not an emergency service and is not monitored in real time. If you or someone else is in immediate
        danger, or you are thinking about harming yourself, please reach out now:
      </p>
      <ul className="mt-5 space-y-3">
        {CRISIS_LINES.map((line) => (
          <li key={line.tel}>
            <a
              href={`tel:${line.tel}`}
              className="flex min-h-16 items-center gap-4 rounded-2xl border border-line bg-white/70 px-4 py-3 transition-all hover:border-olive hover:shadow-soft"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-cream">
                <Phone className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-2xl font-semibold text-forest">{line.number}</span>
                <span className="block text-[13.5px] text-stone">{line.label}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[14px] text-stone">You can also go to the nearest hospital emergency department.</p>
    </Modal>
  );
}
