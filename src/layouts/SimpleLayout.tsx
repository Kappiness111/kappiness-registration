import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '../components/Brand';
import { ProgressDashes } from '../components/Decor';
import { CLINIC } from '../lib/config';

interface Props {
  step: 1 | 2 | 3 | 4;
  /** Page heading area, shown on the brown band. */
  title: ReactNode;
  intro?: ReactNode;
  /** Extra content inside the band, under the intro (e.g. the main button). */
  bandExtra?: ReactNode;
  onBack?: () => void;
  onHome?: () => void;
  onPrivacy: () => void;
  onCrisis: () => void;
  children?: ReactNode;
}

/**
 * Every page: a Kappiness-brown band across the top (logo, progress, page
 * heading), then a white page. Content sits in one centred column.
 */
export default function SimpleLayout({ step, title, intro, bandExtra, onBack, onHome, onPrivacy, onCrisis, children }: Props) {
  const logo = <Wordmark tone="light" size="sm" />;

  return (
    <div className="flex min-h-svh flex-col bg-white">
      <div className="bg-cocoa text-white">
        <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-5 pt-4 sm:px-8 sm:pt-6">
          {onHome ? (
            <button type="button" onClick={onHome} className="cursor-pointer rounded-xl" aria-label="Kappiness home">
              {logo}
            </button>
          ) : (
            logo
          )}
          <button
            type="button"
            onClick={onCrisis}
            className="min-h-11 cursor-pointer px-1 text-[14px] font-medium text-white underline decoration-honey decoration-2 underline-offset-[6px]"
          >
            Need help now?
          </button>
        </header>

        <div className="mx-auto w-full max-w-[680px] px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-12">
          <div className="flex items-center justify-between gap-4">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="-ml-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/10"
              >
                <ArrowLeft className="size-6" aria-hidden="true" />
              </button>
            ) : (
              <span />
            )}
            <ProgressDashes step={step} tone="light" />
          </div>
          <h1 className="mt-5 animate-rise text-[34px] leading-[1.12] text-white sm:text-[46px]">{title}</h1>
          {intro && <div className="mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-white/85">{intro}</div>}
          {bandExtra}
        </div>
      </div>

      <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-5 pb-14 sm:px-8">
        {children}
      </main>

      <footer className="border-t border-rule">
        <p className="mx-auto max-w-[680px] px-5 py-6 text-[13px] text-muted sm:px-8">
          {CLINIC.name}, {CLINIC.tagline}. {CLINIC.initiative}. ·{' '}
          <a href={`tel:${CLINIC.phoneTel}`} className="hover:text-ink hover:underline">
            {CLINIC.phoneDisplay}
          </a>{' '}
          ·{' '}
          <button type="button" onClick={onPrivacy} className="min-h-8 cursor-pointer underline underline-offset-4 hover:text-ink">
            Privacy
          </button>
        </p>
      </footer>
    </div>
  );
}
