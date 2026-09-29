import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export default function Modal({
  title,
  close,
  children,
  className = '',
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(close),
    titleId = useId();
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = [
      ...document.querySelectorAll<HTMLElement>('.sidebar,.app-topbar,.app-content'),
    ].filter((el) => !el.contains(ref.current));
    const inertStates = background.map((el) => el.inert);
    background.forEach((el) => {
      el.inert = true;
    });
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button,a[href],input,select,textarea,[tabindex="0"]',
        ) || [],
      ).filter((el) => !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const els = focusable();
        if (!els.length) {
          e.preventDefault();
          ref.current?.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = old;
      background.forEach((el, i) => {
        el.inert = inertStates[i];
      });
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-title">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={close} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
