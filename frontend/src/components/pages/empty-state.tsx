import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { FileX } from 'lucide-react';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, title, description, icon, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
        {...props}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center mb-4">
          {icon || <FileX className="h-6 w-6 text-[var(--muted-foreground)]" />}
        </div>
        <h3 className="text-lg font-medium text-[var(--foreground)] mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm">{description}</p>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
