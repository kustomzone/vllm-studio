// CRITICAL
"use client";

import { memo, useMemo } from "react";
import { Check, Loader2 } from "lucide-react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";

interface TodoStep { title: string; status: "done" | "running" | "pending" | "blocked"; }

function parse(tc: CurrentToolCall): TodoStep[] {
  const src = tc.input ?? tc.output;
  if (!src) return [];
  let raw: unknown[] = [];
  if (Array.isArray(src)) raw = src;
  else if (typeof src === "object" && src !== null) {
    const o = src as Record<string, unknown>;
    if (Array.isArray(o.steps)) raw = o.steps;
    else if (Array.isArray(o.tasks)) raw = o.tasks;
    else if (Array.isArray(o.items)) raw = o.items;
    else if (Array.isArray(o.plan)) raw = o.plan;
  } else if (typeof src === "string") {
    try { return parse({ ...tc, input: JSON.parse(src), output: undefined }); } catch { /* line-based fallback */ }
    return src.split("\n").filter(l => l.trim()).map(l => ({ title: l.replace(/^[-*\d.)\]]+\s*/, "").trim(), status: "pending" as const }));
  }
  return raw.map(step => {
    if (typeof step === "string") return { title: step, status: "pending" as const };
    if (step && typeof step === "object") {
      const s = step as Record<string, unknown>;
      const title = (typeof s.title === "string" ? s.title : typeof s.text === "string" ? s.text : "").trim();
      if (!title) return null;
      const r = typeof s.status === "string" ? s.status.toLowerCase() : "";
      const status: TodoStep["status"] = ["done","complete","completed","finished","success"].includes(r) ? "done" : ["running","in_progress","active","working"].includes(r) ? "running" : ["blocked","failed","error"].includes(r) ? "blocked" : "pending";
      return { title, status };
    }
    return null;
  }).filter((s): s is TodoStep => s !== null);
}

export const TodoView = memo(function TodoView({ toolCall }: { toolCall: CurrentToolCall }) {
  const steps = useMemo(() => parse(toolCall), [toolCall]);
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-(--border)/30 px-4 py-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-(--dim)/50">plan</span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {steps.length > 0 ? steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-(--fg)/[0.015]">
            <div className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border-[1.5px] transition-all ${
              step.status === "done" ? "bg-(--hl2) border-(--hl2)" : step.status === "running" ? "border-(--accent) bg-(--accent)/10" : step.status === "blocked" ? "border-(--err) bg-(--err)/10" : "border-(--border)"
            }`}>
              {step.status === "done" && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              {step.status === "running" && <Loader2 className="w-2.5 h-2.5 text-(--accent) animate-spin" />}
            </div>
            <span className={`text-[12px] leading-snug flex-1 ${
              step.status === "done" ? "text-(--dim) line-through decoration-(--border)" : step.status === "running" ? "text-(--fg) font-medium" : "text-(--fg)"
            }`}>{step.title}</span>
          </div>
        )) : (
          <div className="flex items-center justify-center h-full"><span className="text-[11px] font-mono text-(--dim)/30">No plan data</span></div>
        )}
      </div>
    </div>
  );
});
