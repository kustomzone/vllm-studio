import { RecipeWithStatus } from '@/lib/types';
import { Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface QuickLaunchProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchResults: RecipeWithStatus[];
  onLaunch: (recipeId: string) => void;
  launching: boolean;
  className?: string;
}

export function QuickLaunch({
  searchQuery,
  onSearchChange,
  searchResults,
  onLaunch,
  launching,
  className,
}: QuickLaunchProps) {
  return (
    <div className={cn('', className)}>
      <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Quick Launch</div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recipes..."
          className="w-full pl-11 pr-4 py-3.5 sm:py-3 bg-[var(--card)] rounded-lg text-base sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow"
        />
      </div>
      {searchResults.length > 0 && (
        <div className="mt-2 bg-[var(--card)] rounded-lg overflow-hidden">
          {searchResults.map((recipe, i) => (
            <div
              key={recipe.id}
              onClick={() => !launching && recipe.status !== 'running' && onLaunch(recipe.id)}
              className={cn(
                'flex items-center justify-between px-4 py-3.5 sm:py-3 cursor-pointer transition-colors',
                launching || recipe.status === 'running' ? 'cursor-not-allowed opacity-60' : 'hover:bg-[var(--accent-hover)] active:bg-[var(--accent)]',
                i > 0 && 'border-t border-[var(--border)]/50'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', recipe.status === 'running' ? 'bg-[var(--success)]' : 'bg-[var(--border)]')} />
                <div className="min-w-0">
                  <div className="text-[var(--foreground)] truncate">{recipe.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    TP{recipe.tp || recipe.tensor_parallel_size} · {recipe.backend}
                  </div>
                </div>
              </div>
              {recipe.status !== 'running' && <ChevronRight className="h-4 w-4 text-[var(--border)] flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
