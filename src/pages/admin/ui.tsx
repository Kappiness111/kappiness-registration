/** Small, square-cornered controls for the staff area (the patient site keeps its own pill buttons). */
import type { ButtonHTMLAttributes, ComponentType, ReactNode, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export function ABtn({
  variant = 'outline',
  icon: I,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'outline' | 'ghost'; icon?: Icon }) {
  const v = {
    solid: 'bg-ink text-white hover:bg-bean disabled:bg-latte disabled:text-muted',
    outline: 'border border-rule bg-white text-ink hover:bg-crema disabled:text-muted',
    ghost: 'text-muted hover:bg-crema hover:text-ink',
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[14px] font-medium transition-colors disabled:cursor-not-allowed ${v} ${className}`}
      {...props}
    >
      {I && <I className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'positive' | 'brand'; children: ReactNode }) {
  const t = {
    neutral: 'bg-crema text-muted ring-rule',
    positive: 'bg-[#eef6ee] text-[#2f6b3a] ring-[#cfe3d2]',
    brand: 'bg-leaf-tint text-leaf ring-[#efd9c4]',
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[12.5px] font-medium ring-1 ring-inset ${t}`}>{children}</span>;
}

export function Initials({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-leaf-tint font-semibold text-leaf ${
        size === 'lg' ? 'size-12 text-[16px]' : 'size-9 text-[13px]'
      }`}
    >
      {letters || '?'}
    </span>
  );
}
