import { describe, expect, it } from "vitest";
import type { ActivityGroup } from "@/app/chat/types";
import { extractBrowserActivityEntries, extractComputerActivityEntries } from "./browser-computer-data";

const activityGroups: ActivityGroup[] = [
  {
    id: "group-1",
    messageId: "m-1",
    title: "Turn 1",
    isLatest: false,
    turnNumber: 1,
    items: [
      {
        id: "tool-browser-1",
        type: "tool-call",
        timestamp: 10,
        toolName: "browser_open_url",
        state: "complete",
        input: { url: "https://example.com/docs" },
        output: "URL: https://example.com/docs\nTitle: Example",
      },
      {
        id: "tool-computer-1",
        type: "tool-call",
        timestamp: 12,
        toolName: "execute_command",
        state: "complete",
        input: { command: "ls -la" },
        output: "file-a\nfile-b",
      },
    ],
  },
  {
    id: "group-2",
    messageId: "m-2",
    title: "Current (Turn 2)",
    isLatest: true,
    turnNumber: 2,
    items: [
      {
        id: "tool-browser-2",
        type: "tool-call",
        timestamp: 20,
        toolName: "web_search",
        state: "running",
        input: { query: "latest vllm docs", website: "docs.vllm.ai" },
      },
      {
        id: "tool-computer-2",
        type: "tool-call",
        timestamp: 21,
        toolName: "computer_use",
        state: "running",
        input: { cmd: "npm run test" },
      },
    ],
  },
];

describe("browser/computer sidepanel data extraction", () => {
  it("extracts browser URLs and normalizes bare hostnames", () => {
    const entries = extractBrowserActivityEntries(activityGroups);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.url).toBe("https://docs.vllm.ai");
    expect(entries[0]?.state).toBe("running");
    expect(entries[1]?.url).toBe("https://example.com/docs");
  });

  it("extracts computer command history with output", () => {
    const entries = extractComputerActivityEntries(activityGroups);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.command).toBe("npm run test");
    expect(entries[0]?.toolName).toBe("computer_use");
    expect(entries[1]?.command).toBe("ls -la");
    expect(entries[1]?.output).toContain("file-a");
  });
});
