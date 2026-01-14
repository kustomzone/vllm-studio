import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, unit, trend, size = 'md', ...props }, ref) => {
    const sizeStyles = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    const valueSizeStyles = {
      sm: 'text-xl',
      md: 'text-2xl',
      lg: 'text-3xl',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-[var(--card)] border border-[var(--border)] rounded-lg',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1">{label}</div>
        <div className={cn('font-semibold text-[var(--foreground)]', valueSizeStyles[size])}>
          {value}
          {unit && <span className="text-sm font-normal text-[var(--muted-foreground)] ml-1">{unit}</span>}
        </div>
        {trend !== undefined && (
          <div className={cn('text-xs mt-2', trend >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]')}>
            {trend >= 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
