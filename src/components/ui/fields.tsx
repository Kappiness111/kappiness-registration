import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Check, ChevronDown, CircleAlert } from 'lucide-react';

/* 16px+ text prevents iOS from zooming into fields on focus. */
const inputBase =
  'w-full rounded-xl border bg-white px-4 text-[16px] text-ink placeholder:text-muted/55 outline-none transition-[border-color,box-shadow] duration-150 focus:border-leaf focus:ring-4 focus:ring-honey/35 disabled:cursor-not-allowed disabled:opacity-60 [&[readonly]]:border-transparent [&[readonly]]:bg-crema [&[readonly]]:font-medium';

const tone = (error?: string) => (error ? 'border-error focus:border-error focus:ring-error/15' : 'border-rule hover:border-olive');

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13.5px] leading-snug text-error">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

interface ShellProps {
  id: string;
  label?: ReactNode;
  ml?: string; // Malayalam label, as printed on the clinic's paper form
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
}

function Label({ id, label, ml, required, optional }: Pick<ShellProps, 'id' | 'label' | 'ml' | 'required' | 'optional'>) {
  if (!label) return null;
  return (
    <label htmlFor={id} className="mb-2 block">
      <span className="flex flex-wrap items-baseline gap-x-1.5 text-[14.5px] font-medium text-ink">
        {label}
        {required && (
          <span className="text-clay" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="text-[13px] font-normal text-stone">(optional)</span>}
      </span>
      {ml && (
        <span lang="ml" className="mt-0.5 block text-[12px] leading-snug text-muted">
          {ml}
        </span>
      )}
    </label>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
}

function Hint({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-[13.5px] leading-snug text-stone">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </>
  );
}

type InputProps = ShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { suffix?: ReactNode };

export function TextField({ id, label, ml, required, optional, hint, error, className = '', suffix, ...props }: InputProps) {
  return (
    <div className={className}>
      <Label {...{ id, label, ml, required, optional }} />
      <div className="relative">
        <input
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          aria-required={required || undefined}
          className={`${inputBase} ${tone(error)} h-12 ${suffix ? 'pr-12' : ''}`}
          {...props}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone">{suffix}</span>}
      </div>
      <Hint id={id} hint={hint} error={error} />
    </div>
  );
}

type AreaProps = ShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextAreaField({ id, label, ml, required, optional, hint, error, className = '', rows = 3, ...props }: AreaProps) {
  return (
    <div className={className}>
      <Label {...{ id, label, ml, required, optional }} />
      <textarea
        id={id}
        name={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
        className={`${inputBase} ${tone(error)} resize-y py-3.5 leading-relaxed`}
        {...props}
      />
      <Hint id={id} hint={hint} error={error} />
    </div>
  );
}

type SelectProps = ShellProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { options: readonly (string | { value: string; label: string })[]; placeholder?: string };

export function SelectField({ id, label, ml, required, optional, hint, error, className = '', options, placeholder = 'Select', ...props }: SelectProps) {
  return (
    <div className={className}>
      <Label {...{ id, label, ml, required, optional }} />
      <div className="relative">
        <select
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          aria-required={required || undefined}
          className={`${inputBase} ${tone(error)} h-12 cursor-pointer appearance-none pr-11 ${props.value ? '' : 'text-stone/70'}`}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => {
            const value = typeof o === 'string' ? o : o.value;
            return (
              <option key={value} value={value} className="text-charcoal">
                {typeof o === 'string' ? o : o.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-[18px] -translate-y-1/2 text-stone" aria-hidden="true" />
      </div>
      <Hint id={id} hint={hint} error={error} />
    </div>
  );
}

interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
  className?: string;
}

/** Large, touch-friendly checkbox; the native input stays in the DOM for accessibility. */
export function Checkbox({ id, checked, onChange, children, error, className = '' }: CheckboxProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="group flex min-h-11 cursor-pointer items-start gap-3.5">
        <span className="relative flex shrink-0">
          <input
            id={id}
            name={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`flex size-6 items-center justify-center rounded-md border-2 bg-white transition-colors duration-150 peer-checked:border-leaf peer-checked:bg-leaf peer-focus-visible:ring-4 peer-focus-visible:ring-honey/50 ${
              error ? 'border-error' : 'border-olive'
            }`}
          >
            <Check className={`size-4 text-white transition-opacity duration-150 ${checked ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
          </span>
        </span>
        <span className="text-[15px] leading-snug text-ink">{children}</span>
      </label>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
