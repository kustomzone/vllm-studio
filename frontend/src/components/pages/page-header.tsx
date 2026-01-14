import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { RefreshCw } from 'lucide-react';
import { IconButton } from '@/components/ui';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  action?: React.ReactNode;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, onRefresh, refreshing, action, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center justify-between mb-6', className)} {...props}>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
          {description && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <IconButton
              variant="secondary"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </IconButton>
          )}
          {action}
        </div>
      </div>
    );
  }
);

PageHeader.displayName = 'PageHeader';
