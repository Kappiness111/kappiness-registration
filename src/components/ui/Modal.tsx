import { useEffect, useId, useRef, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** Prevent closing (e.g. while a submission is in flight). */
  locked?: boolean;
}

/**
 * Native <dialog>: focus containment, Escape-to-close and inert background.
 * On phones it becomes a bottom sheet.
 */
export default function Modal({ open, onClose, title, eyebrow, icon: Icon, children, footer, size = 'md', locked = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = 'hidden';
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  const width = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className={`fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92svh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-ink shadow-lift open:animate-rise sm:inset-0 sm:m-auto sm:max-h-[88svh] sm:w-[calc(100%-2rem)] sm:rounded-3xl ${width}`}
    >
      {open && (
        <div className="flex max-h-[92svh] flex-col sm:max-h-[88svh]">
          <header className="flex items-start gap-4 border-b border-rule px-5 pb-4 pt-5 sm:px-8 sm:pt-6">
            {Icon && (
              <span className="hidden">
                <Icon className="size-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && <p className="text-[13px] font-medium text-leaf">{eyebrow}</p>}
              <h2 id={titleId} className="mt-0.5 text-[24px] font-semibold leading-tight">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={locked}
              className="-mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone transition-colors hover:bg-ivory hover:text-forest disabled:opacity-40"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-3 border-t border-line bg-ivory/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-8">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
