import type { ReactNode } from 'react';
import { Wordmark } from '../components/Brand';

/** Staff sign-in: one narrow column in the same style as the patient pages. */
export default function AuthCardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-paper">
      <div className="mx-auto flex min-h-svh w-full max-w-[440px] flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between pb-4 pt-5 sm:pt-8">
          <Wordmark />
          <span className="text-[13px] font-semibold text-muted">Staff</span>
        </header>
        <div className="h-0.5 bg-ink" aria-hidden="true" />
        <main id="main" className="flex flex-1 flex-col justify-center py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
