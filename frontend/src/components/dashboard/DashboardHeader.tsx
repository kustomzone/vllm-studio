import type { ProcessInfo, RecipeWithStatus } from "@/lib/types";

interface DashboardHeaderProps {
  currentProcess: ProcessInfo | null;
  currentRecipe: RecipeWithStatus | null;
  onNavigateChat: () => void;
  onNavigateLogs: () => void;
  onBenchmark: () => void;
  benchmarking: boolean;
  onStop: () => void;
}

export function DashboardHeader({
  currentProcess,
  currentRecipe,
  onNavigateChat,
  onNavigateLogs,
  onBenchmark,
  benchmarking,
  onStop,
}: DashboardHeaderProps) {
  const modelName = currentRecipe?.name || currentProcess?.model_path?.split("/").pop();

  return (
    <header className="mb-6 pb-4 border-b border-(--border)/40">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-2">
          {currentProcess ? (
            <>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-(--success)"></div>
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-(--success) animate-ping opacity-75"></div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-(--foreground)">
                  {modelName}
                </h1>
              </div>
              <div className="flex items-center gap-3 text-xs text-(--muted-foreground) pl-5">
                <span className="font-medium">{currentProcess.backend}</span>
                <span className="opacity-40">·</span>
                <span>pid {currentProcess.pid}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-(--muted)/60"></div>
                <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-(--muted-foreground)">
                  No model running
                </h1>
              </div>
              <p className="text-xs text-(--muted-foreground)/80 pl-5">
                Select a recipe to launch
              </p>
            </>
          )}
        </div>
        {currentProcess && (
          <nav className="flex items-center gap-5 text-xs">
            <button
              onClick={onNavigateChat}
              className="text-(--muted-foreground) hover:text-(--foreground) transition-colors duration-200"
            >
              chat
            </button>
            <button
              onClick={onNavigateLogs}
              className="text-(--muted-foreground) hover:text-(--foreground) transition-colors duration-200"
            >
              logs
            </button>
            <button
              onClick={onBenchmark}
              disabled={benchmarking}
              className="text-(--muted-foreground) hover:text-(--foreground) transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed hidden sm:block"
            >
              {benchmarking ? "running..." : "benchmark"}
            </button>
            <span className="text-(--border)/40">·</span>
            <button
              onClick={onStop}
              className="text-(--muted-foreground) hover:text-(--error) transition-colors duration-200"
            >
              stop
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
