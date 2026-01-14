import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, description, action, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center justify-between mb-4', className)} {...props}>
        <div>
          <h2 className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    );
  }
);

SectionHeader.displayName = 'SectionHeader';
