import { Check, MapPin, Phone } from 'lucide-react';
import Button from '../../components/ui/Button';
import { LogoMark } from '../../components/Brand';
import { Stamp } from '../../components/Decor';
import { CLINIC } from '../../lib/config';

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Kappiness, Jagathy, Thiruvananthapuram')}`;

interface Props {
  firstName: string;
  phoneLast4: string;
  preview?: boolean;
  onHome: () => void;
}

/** Body of the thank-you page (the heading lives in the brown band). */
export default function SuccessPage({ firstName, phoneLast4, preview = false, onHome }: Props) {
  const steps = [
    {
      title: 'Registration received',
      text: preview ? 'Preview only: nothing was sent to the clinic.' : 'Your details are safely with the clinic team.',
      done: true,
    },
    {
      title: 'We’ll give you a call',
      text: phoneLast4 ? `Someone from Kappiness will call you on the number ending ${phoneLast4}.` : 'Someone from Kappiness will call you.',
      done: false,
    },
    {
      title: 'Your first session',
      text: 'Together, we’ll find a time and a space that feels right for you.',
      done: false,
    },
  ];

  return (
    <div>
      <Stamp className="-mt-7 sm:-mt-9">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark className="size-11" />
            <p className="text-[19px] font-semibold text-ink">{firstName ? `Talk soon, ${firstName}.` : 'Talk soon.'}</p>
          </div>
          {preview && <span className="rounded-full bg-leaf-tint px-3 py-1 text-[12.5px] font-medium text-leaf">Preview</span>}
        </div>

        <p className="mt-6 text-[14px] text-muted">What happens next</p>
        <ol className="mt-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 pb-5 last:pb-0">
              {i < steps.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-32px)] w-px bg-rule" aria-hidden="true" />}
              <span
                className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                  s.done ? 'bg-leaf text-white' : 'border border-rule bg-white text-muted'
                }`}
                aria-hidden="true"
              >
                {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-[16px] font-medium text-ink">
                  {s.title}
                  {s.done && <span className="sr-only"> (done)</span>}
                </p>
                <p className="mt-0.5 text-[14.5px] leading-snug text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-rule pt-5">
          <a
            href={`tel:${CLINIC.phoneTel}`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-rule text-[15px] font-medium text-ink hover:border-olive"
          >
            <Phone className="size-4" aria-hidden="true" /> Call us
          </a>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-rule text-[15px] font-medium text-ink hover:border-olive"
          >
            <MapPin className="size-4" aria-hidden="true" /> Directions
          </a>
        </div>
      </Stamp>

      {preview && (
        <p className="mt-6 rounded-xl bg-crema p-4 text-[14px] leading-relaxed text-muted">
          <strong className="font-medium text-ink">Preview mode.</strong> This site isn’t connected to the clinic’s system yet, so nothing
          was sent or saved.
        </p>
      )}

      <p className="mt-6 text-[15px] leading-relaxed text-muted">
        Registering doesn’t book an appointment yet. If you’d like to talk sooner, just call us.
      </p>

      <Button variant="secondary" size="lg" onClick={onHome} className="mt-6 w-full sm:w-auto">
        Return to Home
      </Button>
    </div>
  );
}
