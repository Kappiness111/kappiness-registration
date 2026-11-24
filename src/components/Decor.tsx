import type { ReactNode } from 'react';

/** Postage-stamp card: scalloped ivory edge around a bordered inner card. Sits straight, no tilt. */
export function Stamp({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`animate-rise drop-shadow-[0_14px_24px_rgba(36,20,10,0.18)] ${className}`}>
      <div className="stamp">
        <div className="rounded-xl border border-rule bg-white p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

/** Dash-style progress through the four stages. */
export function ProgressDashes({ step, tone = 'dark' }: { step: 1 | 2 | 3 | 4; tone?: 'light' | 'dark' }) {
  const labels = ['Welcome', 'Terms', 'Your details', 'Done'];
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Step ${step} of 4: ${labels[step - 1]}`}>
      {labels.map((l, i) => (
        <li
          key={l}
          aria-hidden="true"
          className={`h-1 rounded-full transition-all duration-500 ${i + 1 === step ? 'w-8' : 'w-3'} ${
            tone === 'light' ? (i + 1 === step ? 'bg-honey' : 'bg-white/30') : i + 1 === step ? 'bg-cocoa' : 'bg-ink/15'
          }`}
        />
      ))}
    </ol>
  );
}
