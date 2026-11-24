import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/fields';
import { CONSENT_TEXT } from '@shared/registration.ts';

interface Props {
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
  onContinue: () => void;
}

function Card({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-rule bg-white p-5 sm:p-6">
      <h2 className="flex flex-wrap items-center gap-2 text-[17px] leading-snug">
        {title}
        {tag && <span className="rounded-full bg-leaf-tint px-2.5 py-0.5 text-[12px] font-medium text-leaf">{tag}</span>}
      </h2>
      <div className="mt-3 text-[15.5px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

/** Body of the terms page (the heading lives in the brown band). */
export default function TermsPage({ agreed, onAgreedChange, onContinue }: Props) {
  const t = CONSENT_TEXT;
  return (
    <div className="animate-rise">
      <div className="-mt-7 space-y-4 sm:-mt-9">
        <Card title={t.therapy.title}>
          <p>I {t.therapy.statement} I understand that:</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:text-muted">
            {t.therapy.understandings.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ol>
        </Card>

        <Card title={t.research.title} tag="Optional">
          <p>
            The clinic may use anonymous, non-identifiable data for research or educational purposes. You can say yes or no on the next
            page; either is fine.
          </p>
        </Card>

        <Card title={t.fees.title}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-rule p-4">
              <p className="text-[14px] text-muted">Per session</p>
              <p className="mt-1 text-[30px] font-semibold leading-none text-ink">₹1,800</p>
            </div>
            <div className="rounded-xl border border-rule p-4">
              <p className="text-[14px] text-muted">Each extra 30 min after 1 hour</p>
              <p className="mt-1 text-[30px] font-semibold leading-none text-ink">₹500</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 rounded-2xl bg-crema p-4 sm:p-5">
        <Checkbox id="terms-agree" checked={agreed} onChange={onAgreedChange}>
          {CONSENT_TEXT.initialAgreement}
        </Checkbox>
      </div>
      <Button variant="honey" size="lg" icon={ArrowRight} disabled={!agreed} onClick={onContinue} className="mt-6 w-full sm:w-auto">
        I Agree &amp; Continue
      </Button>
    </div>
  );
}
