// CRITICAL
"use client";

import type { CompatibilityCheck, CompatibilityReport } from "@/lib/types";

const sortSeverity = (severity: CompatibilityCheck["severity"]): number => {
  if (severity === "error") return 0;
  if (severity === "warn") return 1;
  return 2;
};

const titleForSeverity = (severity: CompatibilityCheck["severity"]): string => {
  if (severity === "error") return "Errors";
  if (severity === "warn") return "Warnings";
  return "Info";
};

export function CompatibilityPanel({ report }: { report: CompatibilityReport | null }) {
  const checks = report?.checks ?? [];
  const grouped = new Map<CompatibilityCheck["severity"], CompatibilityCheck[]>();

  for (const check of checks) {
    const list = grouped.get(check.severity) ?? [];
    list.push(check);
    grouped.set(check.severity, list);
  }

  const severities = Array.from(grouped.keys()).sort((a, b) => sortSeverity(a) - sortSeverity(b));

  return (
    <div className="bg-[#1e1e1e] rounded-lg p-3 sm:p-4">
      <div className="text-xs text-[#9a9088] uppercase tracking-wider mb-3">Compatibility</div>
      {!report && <div className="text-sm text-[#9a9088]">No report available.</div>}
      {report && checks.length === 0 && <div className="text-sm text-[#9a9088]">No issues detected.</div>}

      {report && severities.map((severity) => (
        <div key={severity} className="space-y-3 mb-4 last:mb-0">
          <div className="text-xs uppercase tracking-wider text-[#9a9088]">{titleForSeverity(severity)}</div>
          <div className="space-y-3">
            {(grouped.get(severity) ?? []).map((check) => (
              <div key={check.id} className="rounded-md border border-[#363432] bg-[#0d0d0d] p-3">
                <div className="text-sm text-[#f0ebe3]">{check.message}</div>
                {check.evidence && (
                  <pre className="mt-2 text-xs text-[#9a9088] whitespace-pre-wrap font-mono">{check.evidence}</pre>
                )}
                {check.suggested_fix && (
                  <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-[#f0ebe3]">{check.suggested_fix}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

