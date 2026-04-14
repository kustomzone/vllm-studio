// CRITICAL
export function ConnectionFlow() {
  return (
    <div>
      <div className="text-xs text-(--dim) uppercase tracking-wider mb-3">Connection Flow</div>
      <div className="bg-(--surface) rounded-lg p-4 sm:p-6">
        <div className="hidden sm:flex items-center justify-between text-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-(--border) flex items-center justify-center text-(--fg) font-medium">
              Client
            </div>
          </div>
          <div className="flex-1 flex items-center gap-1 px-2">
            <div className="h-0.5 flex-1 bg-(--border)" />
            <span className="text-(--dim) text-xs px-1">:3000</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-(--hl1) flex items-center justify-center text-(--fg) font-medium">
              UI
            </div>
          </div>
          <div className="flex-1 flex items-center gap-1 px-2">
            <div className="h-0.5 flex-1 bg-(--border)" />
            <span className="text-(--dim) text-xs px-1">:8080</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-(--hl1) flex items-center justify-center text-(--fg) font-medium">
              API
            </div>
          </div>
          <div className="flex-1 flex items-center gap-1 px-2">
            <div className="h-0.5 flex-1 bg-(--border)" />
            <span className="text-(--dim) text-xs px-1">:8000</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-(--hl1) flex items-center justify-center text-(--fg) font-medium">
              Engine
            </div>
          </div>
        </div>
        <div className="sm:hidden flex items-center gap-2 text-xs text-(--dim) justify-center flex-wrap">
          <span className="text-(--fg)">Client</span> <span>\u2192</span>
          <span className="text-(--fg)">Frontend</span> <span>\u2192</span>
          <span className="text-(--fg)">Controller</span> <span>\u2192</span>
          <span className="text-(--fg)">Inference</span>
        </div>
        <div className="mt-4 pt-4 border-t border-(--border) text-[10px] sm:text-xs text-(--dim) text-center">
          Client \u2192 Frontend \u2192 Controller \u2192 Inference Engine
        </div>
      </div>
    </div>
  );
}
