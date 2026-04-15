// CRITICAL
import type { ActivityItem } from "@/app/chat/types";
import { categorize as categorizeToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import type { ToolCategory as FullToolCategory } from "@/app/chat/hooks/chat/use-current-tool-call";

/** Sidebar uses a subset of categories (no "edit" — merged into "file"). */
export type ToolCategory = Exclude<FullToolCategory, "edit">;

/** Map the full tool category to sidebar-level category (collapse "edit" into "file"). */
const toSidebarCategory = (cat: FullToolCategory): ToolCategory =>
  cat === "edit" ? "file" : cat;

export const categorize = (toolName?: string): ToolCategory => {
  if (!toolName) return "other";
  return toSidebarCategory(categorizeToolCall(toolName));
};

export const CATEGORY_META: Record<ToolCategory, { label: string; color: string; iconColor: string }> =
  {
    file: { label: "File ops", color: "var(--hl1)", iconColor: "var(--hl1)" },
    search: { label: "Search", color: "var(--hl1)", iconColor: "var(--hl1)" },
    plan: { label: "Planning", color: "var(--hl2)", iconColor: "var(--hl2)" },
    web: { label: "Web", color: "var(--accent)", iconColor: "var(--accent)" },
    code: { label: "Code", color: "var(--hl3)", iconColor: "var(--hl3)" },
    other: { label: "Tools", color: "var(--dim)", iconColor: "var(--dim)" },
  };

export const getTurnSummary = (items: ActivityItem[]): { label: string; count: number; color: string } => {
  const toolItems = items.filter((i) => i.type !== "thinking");
  if (toolItems.length === 0) return { label: "Thinking", count: 0, color: "var(--dim)" };
  const counts = new Map<ToolCategory, number>();
  for (const item of toolItems) {
    const cat = categorize(item.toolName);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  let dominant: ToolCategory = "other";
  let max = 0;
  for (const [cat, count] of counts) {
    if (count > max) {
      dominant = cat;
      max = count;
    }
  }
  const meta = CATEGORY_META[dominant];
  return { label: `${meta.label} (${toolItems.length})`, count: toolItems.length, color: meta.color };
};
