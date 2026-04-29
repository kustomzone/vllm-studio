"use client";

import { buildDisplayModelLabel, type ModelOption } from "../../../types";

export function ModelSelect({
  availableModels,
  selectedModel,
  onChange,
  disabled,
  className,
  mobile = false,
}: {
  availableModels: ModelOption[];
  selectedModel?: string;
  onChange?: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
  mobile?: boolean;
}) {
  if (availableModels.length === 0 || !onChange) return null;

  const grouped = (() => {
    const map = new Map<string, ModelOption[]>();
    for (const model of availableModels) {
      const group = model.provider || "local";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(model);
    }
    return map;
  })();

  const baseClass = mobile
    ? "h-10 w-full px-3 font-mono text-[12px] bg-(--border) border border-(--border) rounded-full text-(--dim) focus:outline-none disabled:opacity-50 truncate appearance-none cursor-pointer hover:bg-(--border) transition-colors"
    : "max-w-[140px] h-7 px-2 font-mono text-[11px] bg-transparent border border-(--border)/40 rounded-md text-(--dim) focus:outline-none focus:border-(--accent)/50 focus:text-(--fg) disabled:opacity-50 truncate appearance-none cursor-pointer hover:text-(--fg) hover:border-(--border)/60 transition-colors";

  return (
    <select
      value={selectedModel || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className || baseClass}
      title={selectedModel || "Select model"}
    >
      {grouped.size <= 1
        ? availableModels.map((model, idx) => (
            <option key={`${model.id}-${idx}`} value={model.id}>
              {buildDisplayModelLabel(model.id, model.provider)}
            </option>
          ))
        : Array.from(grouped.entries()).map(([group, models]) => (
            <optgroup key={group} label={group}>
              {models.map((model, idx) => (
                <option key={`${model.id}-${idx}`} value={model.id}>
                  {buildDisplayModelLabel(model.id, model.provider)}
                </option>
              ))}
            </optgroup>
          ))}
    </select>
  );
}
