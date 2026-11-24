/**
 * Official Kappiness logo (public/brand), cut from the clinic's artwork:
 *  - kappiness-logo.png         mark + "kappi ness" + "Nourishing Minds, Pouring Happiness."
 *  - kappiness-logo-header.png  mark + "kappi ness" (tagline is too small to read at header size)
 *  - kappiness-logo-mark.png    the mug-and-brain mark on its own
 */

/** Public files must be prefixed with the site's base path (e.g. /kappiness-registration/ on GitHub Pages). */
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const HEADER_HEIGHT = { sm: 'h-11', md: 'h-12 sm:h-14', lg: 'h-16' } as const;

/** Header lock-up: mark + name. */
export function Wordmark({ tone = 'dark', size = 'md' }: { tone?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg'; tagline?: boolean }) {
  // 'light' = cream single-colour version for the brown band
  const src = asset(tone === 'light' ? 'brand/kappiness-logo-header-light.png' : 'brand/kappiness-logo-header.png');
  return <img src={src} alt="Kappiness" width={991} height={423} className={`${HEADER_HEIGHT[size]} w-auto`} />;
}

/** Full logo with the tagline. */
export function FullLogo({ className = 'h-16' }: { className?: string }) {
  return (
    <img
      src={asset('brand/kappiness-logo.png')}
      alt="Kappiness: Nourishing Minds, Pouring Happiness."
      width={1003}
      height={434}
      className={`w-auto ${className}`}
    />
  );
}

/** The mark on its own. */
export function LogoMark({ className = 'size-8' }: { className?: string; tone?: 'dark' | 'light' }) {
  return <img src={asset('brand/kappiness-logo-mark.png')} alt="" aria-hidden="true" width={459} height={423} className={`object-contain ${className}`} />;
}

/** Kept for compatibility: same as LogoMark. */
export function KappinessMark({ className = 'size-8' }: { className?: string; mono?: string }) {
  return <LogoMark className={className} />;
}
