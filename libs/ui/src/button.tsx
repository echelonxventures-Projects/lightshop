import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

interface Common {
  variant?: 'primary' | 'secondary';
  block?: boolean;
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;
export type LinkButtonProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button({ variant = 'primary', block, className, ...rest }: ButtonProps) {
  return <button className={cx('ls-button', `ls-button--${variant}`, block && 'ls-button--block', className)} {...rest} />;
}

export function LinkButton({ variant = 'primary', block, className, ...rest }: LinkButtonProps) {
  return <a className={cx('ls-button', `ls-button--${variant}`, block && 'ls-button--block', className)} {...rest} />;
}
