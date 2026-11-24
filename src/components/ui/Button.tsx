import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';
import { LoaderCircle } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'light' | 'accent' | 'honey';
type Size = 'md' | 'lg' | 'sm';

const VARIANTS: Record<Variant, string> = {
  // honey pill: the main "go" action on every page
  honey: 'bg-honey text-ink hover:bg-honey-deep disabled:bg-latte disabled:text-muted',
  primary: 'bg-honey text-ink hover:bg-honey-deep disabled:bg-latte disabled:text-muted',
  accent: 'bg-leaf text-white hover:bg-bean disabled:bg-latte disabled:text-muted',
  light: 'bg-white text-ink hover:bg-crema',
  secondary: 'border border-rule bg-white text-ink hover:border-olive disabled:text-muted',
  ghost: 'bg-transparent text-ink hover:bg-crema disabled:text-muted',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-4 text-[13.5px]',
  md: 'min-h-12 px-6 text-[16px]',
  lg: 'min-h-14 px-8 text-[17px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  block?: boolean;
}

/** Rounded pill. Honey for the main action, quieter variants for everything else. */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'right',
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const iconEl = loading ? (
    <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
  ) : Icon ? (
    <Icon className="size-[18px] transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} aria-hidden="true" />
  ) : null;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`group inline-flex cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-semibold transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${
        VARIANTS[variant]
      } ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {iconPosition === 'left' && iconEl}
      <span>{children}</span>
      {iconPosition === 'right' && iconEl}
    </button>
  );
}
