// CRITICAL
import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTorchBuildInfo } from "./torch-info";

describe("torch-info", () => {
  it("parses torch build info from a python-like shim", () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-torch-info-"));
    try {
      const pythonShim = join(root, "python3");
      // Ignore args and return the JSON payload expected by getTorchBuildInfo.
      writeFileSync(
        pythonShim,
        "#!/usr/bin/env bash\nset -euo pipefail\necho '{\"torch_version\":\"2.6.0\",\"torch_cuda\":null,\"torch_hip\":\"7.1.1\"}'\n",
        "utf-8",
      );
      chmodSync(pythonShim, 0o755);

      const info = getTorchBuildInfo(pythonShim);
      expect(info.torch_version).toBe("2.6.0");
      expect(info.torch_cuda).toBeNull();
      expect(info.torch_hip).toBe("7.1.1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

