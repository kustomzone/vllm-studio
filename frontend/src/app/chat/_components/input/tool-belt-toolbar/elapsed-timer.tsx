"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function ElapsedTimer({ startedAt }: { startedAt: number | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt == null) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt == null) return null;

  return (
    <div className="flex items-center gap-1 px-1.5 h-7 min-w-0">
      <Clock className="h-3 w-3 text-(--fg)/40 animate-pulse shrink-0" />
      <span className="text-[10px] font-mono text-(--fg)/40 tabular-nums shrink-0">
        {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
      </span>
    </div>
  );
}
