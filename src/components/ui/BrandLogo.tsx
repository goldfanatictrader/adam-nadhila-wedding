export default function BrandLogo({
  variant = 'compact',
  tone = 'color',
  className = '',
  decorative = false,
}: {
  variant?: 'compact' | 'horizontal' | 'stacked' | 'symbol';
  tone?: 'color' | 'mono' | 'inverse';
  className?: string;
  decorative?: boolean;
}) {
  const file = variant === 'symbol' ? 'symbol' : `logo-${variant}`;
  return (
    <img
      className={`brand-logo brand-logo-${variant} ${className}`}
      src={`/brand/${file}${tone === 'color' ? '' : `-${tone}`}.svg`}
      width={variant === 'symbol' ? 120 : variant === 'stacked' ? 465 : 576}
      height={
        variant === 'symbol'
          ? 120
          : variant === 'stacked'
            ? 380
            : variant === 'horizontal'
              ? 148
              : 120
      }
      alt={decorative ? '' : 'CELEYO'}
      aria-hidden={decorative || undefined}
      decoding="async"
    />
  );
}
