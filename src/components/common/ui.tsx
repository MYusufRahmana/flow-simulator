import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string; pressed?: boolean };

export function IconButton({ label, shortcut, pressed, children, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed}
      className={`icon-btn ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Divider({ vertical = true }: { vertical?: boolean }) {
  return vertical ? <span className="mx-1 h-6 w-px bg-black/8" /> : <span className="my-1 block h-px w-full bg-black/8" />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-gray-500">
        {label}
        {hint}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13px] text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-black/20 focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            o.value === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left text-[13px] text-gray-700"
    >
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-[var(--color-brand)]' : 'bg-gray-300'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="panel fade-in w-full max-w-md p-5">
        <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
