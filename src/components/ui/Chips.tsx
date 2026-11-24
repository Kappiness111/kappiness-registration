import type { ReactNode } from 'react';
import { FieldError } from './fields';

interface Props {
  name: string;
  label: ReactNode;
  ml?: string;
  hint?: ReactNode;
  required?: boolean;
  options: readonly (string | { value: string; label: string })[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** One-tap choices (radio buttons styled as pills). Faster than a dropdown for short lists. */
export default function Chips({ name, label, ml, hint, required, options, value, onChange, error }: Props) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-[14.5px] font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-clay" aria-hidden="true">
            *
          </span>
        )}
        {ml && (
          <span lang="ml" className="block text-[12px] font-normal text-muted">
            {ml}
          </span>
        )}
      </legend>
      {hint && <p className="-mt-1 mb-2 text-[13px] text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const text = typeof o === 'string' ? o : o.label;
          const id = `${name}-${v.replace(/\W+/g, '_')}`;
          const on = value === v;
          return (
            <label
              key={v}
              htmlFor={id}
              className={`inline-flex min-h-11 cursor-pointer select-none items-center rounded-xl border px-4 text-[15px] transition-colors duration-150 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-honey/50 ${
                on ? 'border-leaf bg-leaf-tint font-medium text-leaf shadow-[inset_0_0_0_1px_var(--color-leaf)]' : error ? 'border-error bg-white text-ink' : 'border-rule bg-white text-ink hover:border-olive'
              }`}
            >
              <input id={id} type="radio" name={name} value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
              {text}
            </label>
          );
        })}
      </div>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </fieldset>
  );
}
