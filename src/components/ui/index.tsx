import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from 'lucide-react';
export function Button({
  variant = 'primary',
  loading,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      className={`btn ${variant === 'primary' ? '' : variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Button
      {...props}
      variant="quiet"
      className={`icon-button ${props.className || ''}`}
      aria-label={label}
    >
      {children}
    </Button>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Alert({
  children,
  tone = 'info',
  title,
}: {
  children: ReactNode;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertCircle : Info;
  return (
    <div
      className={`message ${tone === 'danger' ? 'error' : tone} alert-with-icon`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon size={19} aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={`panel ${className}`}>
      {children}
    </section>
  );
}
export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="between">
        <p>{label}</p>
        {icon && (
          <span className="stat-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className="value">{value}</p>
    </div>
  );
}
export function UsageMeter({ value, max, label }: { value: number; max: number; label: string }) {
  const id = useId(),
    percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="usage-meter">
      <div className="between note" id={id}>
        <span>{label}</span>
        <span>
          {value.toLocaleString('id-ID')} / {max.toLocaleString('id-ID')}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuenow={Math.min(value, max)}
        aria-valuemin={0}
        aria-valuemax={max || 1}
        className="progress"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  icon,
  action,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && (
        <span className="icon-tile" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Skeleton({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="skeleton-group" role="status" aria-label={label}>
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={value === item.id ? 'active' : ''}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
