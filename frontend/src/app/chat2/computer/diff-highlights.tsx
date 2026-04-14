import React from "react";

const ADD_RE = /^\+(?!\+\+)(.*)$/;
const DEL_RE = /^-(?!--)(.*)$/;

export function applyDiffHighlights(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const addMatch = ADD_RE.exec(line);
    const delMatch = DEL_RE.exec(line);

    if (addMatch) {
      result.push(
        <div key={i} className="bg-(--hl2)/10 text-(--hl2)">
          {line}
        </div>
      );
    } else if (delMatch) {
      result.push(
        <div key={i} className="bg-(--err)/10 text-(--err)/70 line-through">
          {line}
        </div>
      );
    } else {
      result.push(
        <div key={i} className="text-(--fg)/70">
          {line}
        </div>
      );
    }
  }

  return result;
}
