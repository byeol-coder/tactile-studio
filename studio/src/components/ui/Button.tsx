import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'default' | 'primary' | 'quiet' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
}

/** Shared button primitive. All labels are text — no icon-only buttons. */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'default', size = 'md', fullWidth = false, className = '', type = 'button', ...rest },
  ref,
) {
  const cls = [
    styles.btn,
    variant === 'primary' && styles.primary,
    variant === 'quiet' && styles.quiet,
    variant === 'danger' && styles.danger,
    size === 'sm' && styles.sm,
    fullWidth && styles.full,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button ref={ref} type={type} className={cls} {...rest} />;
});
