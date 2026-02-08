// CRITICAL
import type {
  RuntimePlatformKind,
  RuntimeRocmSmiTool,
  RuntimeTorchBuildInfo,
  SystemRuntimeInfo,
} from "./config";

export type CompatibilitySeverity = "info" | "warn" | "error";

export interface CompatibilityCheck {
  id: string;
  severity: CompatibilitySeverity;
  message: string;
  evidence: string | null;
  suggested_fix: string | null;
}

export interface CompatibilityReport {
  platform: {
    kind: RuntimePlatformKind;
  };
  gpu_monitoring: {
    available: boolean;
    tool: "nvidia-smi" | RuntimeRocmSmiTool | null;
  };
  torch: RuntimeTorchBuildInfo;
  backends: SystemRuntimeInfo["backends"];
  checks: CompatibilityCheck[];
}

