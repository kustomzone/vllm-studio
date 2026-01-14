import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const variantStyles = {
  default: 'bg-[var(--accent)] text-[var(--accent-foreground)]',
  success: 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20',
  warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20',
  error: 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20',
  info: 'bg-[var(--link)]/10 text-[var(--link)] border border-[var(--link)]/20',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md font-medium transition-colors',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';
