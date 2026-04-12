// CRITICAL
"use client";

import type { ActivityGroup } from "@/app/chat/types";
import { TurnGroup } from "./turn-group";

export interface ActivityPanelProps {
  activityGroups: ActivityGroup[];
  agentPlan?: { steps: Array<{ status: string; title: string }> } | null;
  isLoading?: boolean;
  runStatusLine?: string;
}

export function ActivityPanel({
  activityGroups,
  agentPlan,
  isLoading,
  runStatusLine,
}: ActivityPanelProps) {
  if (activityGroups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <p className="text-sm text-(--dim)">No activity yet</p>
      </div>
    );
  }

  const totalSteps = agentPlan?.steps.length ?? 0;
  const doneSteps = agentPlan?.steps.filter((s) => s.status === "done").length ?? 0;
  const currentStep = agentPlan?.steps.find((s) => s.status === "running");

  return (
    <div className="h-full flex flex-col">
      {/* Status line */}
      {isLoading && runStatusLine?.trim() && (
        <div className="px-4 pt-3">
          <p className="text-xs text-(--dim)/70">{runStatusLine}</p>
        </div>
      )}

      {/* Plan progress */}
      {totalSteps > 0 && (
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[11px] font-medium text-(--fg)">Plan</span>
            <span className="text-[10px] text-(--dim) font-mono">{doneSteps}/{totalSteps}</span>
          </div>
          <div className="h-0.5 w-full bg-(--border) rounded-full overflow-hidden">
            <div
              className="h-full bg-(--accent) rounded-full transition-all duration-300"
              style={{ width: `${totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0}%` }}
            />
          </div>
          {isLoading && currentStep && (
            <p className="mt-1.5 text-[10px] text-(--dim) truncate">{currentStep.title}</p>
          )}
        </div>
      )}

      {/* Turn groups */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 space-y-1">
          {activityGroups.map((group) => (
            <TurnGroup
              key={`${group.id}:${group.isLatest ? "latest" : "past"}`}
              group={group}
              hasActiveThinking={group.isLatest && group.items.some((i) => i.type === "thinking" && i.isActive)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
