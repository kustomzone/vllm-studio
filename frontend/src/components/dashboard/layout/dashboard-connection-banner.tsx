interface DashboardConnectionBannerProps {
  isConnected: boolean;
}

export function DashboardConnectionBanner({
  isConnected,
}: DashboardConnectionBannerProps) {
  if (isConnected) return null;

  return (
    <div className="fixed top-4 right-4 z-50 px-3 py-1.5 text-xs text-(--dim) bg-(--surface) border border-(--border)">
      Reconnecting...
    </div>
  );
}
