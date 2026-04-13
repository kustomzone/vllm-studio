"use client";

import type { ReactNode } from "react";

interface ChatToolbeltDockProps {
  toolBelt: ReactNode;
  showEmptyState: boolean;
}

export function ChatToolbeltDock({ toolBelt, showEmptyState }: ChatToolbeltDockProps) {
  return (
    <div className="fixed left-0 right-0 bottom-0 z-20 md:static md:bg-background md:border-t md:border-(--border)/20">
      <div className="md:hidden">{toolBelt}</div>
      {!showEmptyState && <div className="hidden md:block shrink-0 py-2.5">{toolBelt}</div>}
    </div>
  );
}
