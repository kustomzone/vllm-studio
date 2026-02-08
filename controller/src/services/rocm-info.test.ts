// CRITICAL
import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRocmInfo } from "./rocm-info";

describe("rocm-info", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("reads ROCm version from override file and extracts HIP + gfx arch (best effort)", () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-rocm-info-"));
    try {
      const versionFile = join(root, "rocm-version");
      writeFileSync(versionFile, "7.1.1\n", "utf-8");
      process.env["VLLM_STUDIO_ROCM_VERSION_FILE"] = versionFile;

      const hipccPath = join(root, "hipcc");
      writeFileSync(hipccPath, "#!/usr/bin/env bash\necho 'HIP version: 7.1.1'\n", "utf-8");
      chmodSync(hipccPath, 0o755);

      const rocminfoPath = join(root, "rocminfo");
      writeFileSync(
        rocminfoPath,
        "#!/usr/bin/env bash\necho 'Name: gfx942'\necho 'Name: gfx942'\n",
        "utf-8",
      );
      chmodSync(rocminfoPath, 0o755);

      const originalPath = process.env["PATH"] ?? "";
      process.env["PATH"] = `${root}:${originalPath}`;

      const info = getRocmInfo("amd-smi");
      expect(info.smi_tool).toBe("amd-smi");
      expect(info.rocm_version).toBe("7.1.1");
      expect(info.hip_version).toBe("7.1.1");
      expect(info.gpu_arch).toContain("gfx942");

      process.env["PATH"] = originalPath;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

