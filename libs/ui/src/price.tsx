import { cx } from './cx';

export interface PriceProps {
  /** Pre-formatted by the API for the request locale, e.g. "₹2,390.00". */
  formatted: string;
  /** Optional unit suffix, e.g. "/ box" for B2B. */
  unit?: string;
  size?: 'md' | 'lg';
}

export function Price({ formatted, unit, size = 'md' }: PriceProps) {
  return (
    <span className={cx('ls-price', size === 'lg' && 'ls-price--lg')}>
      {formatted}
      {unit && <span className="ls-price__unit">{unit}</span>}
    </span>
  );
}
