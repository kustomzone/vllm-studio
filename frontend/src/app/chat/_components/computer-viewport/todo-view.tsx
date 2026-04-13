// CRITICAL
"use client";

import { memo, useMemo } from "react";
import { Check, Loader2 } from "lucide-react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";

interface TodoStep {
  title: string;
  status: "done" | "running" | "pending" | "blocked";
}

function parsePlanSteps(tc: CurrentToolCall): TodoStep[] {
  const input = tc.input;
  const output = tc.output;
  const source = input ?? output;

  if (!source) return [];

  let rawSteps: unknown[] = [];

  if (Array.isArray(source)) {
    rawSteps = source;
  } else if (typeof source === "object" && source !== null) {
    const obj = source as Record<string, unknown>;
    if (Array.isArray(obj.steps)) rawSteps = obj.steps;
    else if (Array.isArray(obj.tasks)) rawSteps = obj.tasks;
    else if (Array.isArray(obj.items)) rawSteps = obj.items;
    else if (Array.isArray(obj.plan)) rawSteps = obj.plan;
  } else if (typeof source === "string") {
    try {
      const parsed = JSON.parse(source);
      return parsePlanSteps({ ...tc, input: parsed, output: undefined });
    } catch {
      // Try line-based parsing
      return source
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => ({
          title: l.replace(/^[-*\d.)\]]+\s*/, "").trim(),
          status: "pending" as const,
        }));
    }
  }

  return rawSteps
    .map((step) => {
      if (typeof step === "string") return { title: step, status: "pending" as const };
      if (step && typeof step === "object") {
        const s = step as Record<string, unknown>;
        const title = (typeof s.title === "string" ? s.title : typeof s.text === "string" ? s.text : "").trim();
        if (!title) return null;

        let status: TodoStep["status"] = "pending";
        const rawStatus = typeof s.status === "string" ? s.status.toLowerCase() : "";
        if (["done", "complete", "completed", "finished", "success"].includes(rawStatus)) status = "done";
        else if (["running", "in_progress", "active", "working"].includes(rawStatus)) status = "running";
        else if (["blocked", "failed", "error"].includes(rawStatus)) status = "blocked";

        return { title, status };
      }
      return null;
    })
    .filter((s): s is TodoStep => s !== null);
}

export const TodoView = memo(function TodoView({
  toolCall,
}: {
  toolCall: CurrentToolCall;
}) {
  const steps = useMemo(() => parsePlanSteps(toolCall), [toolCall]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--border)/30 px-4 py-2.5 shrink-0">
        <span className="text-[13px] font-semibold text-(--fg)">Agent&apos;s Computer</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {steps.length > 0 ? (
          steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-(--fg)/[0.015]">
              <div
                className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border-[1.5px] transition-all ${
                  step.status === "done"
                    ? "bg-(--hl2) border-(--hl2)"
                    : step.status === "running"
                      ? "border-(--blue) bg-(--blue)/10"
                      : step.status === "blocked"
                        ? "border-(--err) bg-(--err)/10"
                        : "border-(--border)"
                }`}
              >
                {step.status === "done" && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                {step.status === "running" && <Loader2 className="w-2.5 h-2.5 text-(--blue) animate-spin" />}
              </div>
              <span
                className={`text-[12px] leading-snug flex-1 ${
                  step.status === "done"
                    ? "text-(--dim) line-through decoration-(--border)"
                    : step.status === "running"
                      ? "text-(--fg) font-medium"
                      : "text-(--fg)"
                }`}
              >
                {step.title}
              </span>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] font-mono text-(--dim)/30">No plan data</span>
          </div>
        )}
      </div>
    </div>
  );
});
