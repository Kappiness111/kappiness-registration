import { ArrowRight } from 'lucide-react';
import Button from '../../components/ui/Button';
import { LogoMark } from '../../components/Brand';
import { Stamp } from '../../components/Decor';
import SimpleLayout from '../../layouts/SimpleLayout';
import { CLINIC } from '../../lib/config';

interface Props {
  onBegin: () => void;
  onPrivacy: () => void;
  onCrisis: () => void;
}

const ROWS = [
  ['Takes', 'About a minute'],
  ['You’ll need', 'Your contact details and an emergency contact'],
  ['Your answers', 'Sent securely to the clinic only'],
];

export default function LandingPage({ onBegin, onPrivacy, onCrisis }: Props) {
  return (
    <SimpleLayout
      step={1}
      onPrivacy={onPrivacy}
      onCrisis={onCrisis}
      title={
        <>
          A little closer
          <br />
          to yourself.
        </>
      }
      intro="Sometimes, taking the first step is the most meaningful one. Welcome to a space where you can feel heard, understood and supported."
      bandExtra={
        <div className="mt-8">
          <Button variant="honey" size="lg" icon={ArrowRight} onClick={onBegin} className="w-full sm:w-auto">
            Begin Your Journey
          </Button>
          <p className="mt-3 text-[14px] text-white/70">A gentle beginning. At your own pace.</p>
        </div>
      }
    >
      {/* the card overlaps the bottom edge of the brown band */}
      <Stamp className="-mt-7 sm:-mt-9">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div>
            <p className="text-[17px] font-semibold text-ink">Registration</p>
            <p className="text-[13.5px] text-muted">{CLINIC.tagline}</p>
          </div>
        </div>
        <dl className="mt-5 divide-y divide-rule border-y border-rule">
          {ROWS.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3.5 text-[14.5px]">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13.5px] font-medium text-leaf">{CLINIC.motto}</p>
      </Stamp>
    </SimpleLayout>
  );
}
