// CRITICAL
export type {
  ServiceInfo,
  SystemConfig,
  EnvironmentInfo,
  RuntimeBackendInfo,
  RuntimePlatformKind,
  RuntimeRocmSmiTool,
  RuntimeGpuMonitoringTool,
  RuntimeCudaInfo,
  RuntimeRocmInfo,
  RuntimeTorchBuildInfo,
  RuntimePlatformInfo,
  RuntimeGpuMonitoringInfo,
  RuntimeGpuInfoSummary,
  CompatibilitySeverity,
  CompatibilityCheck,
  SystemRuntimeInfo,
  CompatibilityReport,
} from "../../../../../shared/src";

import type {
  ServiceInfo,
  SystemConfig,
  EnvironmentInfo,
  SystemRuntimeInfo,
} from "../../../../../shared/src";

export interface ConfigData {
  config: SystemConfig;
  services: ServiceInfo[];
  environment: EnvironmentInfo;
  runtime: SystemRuntimeInfo;
}

export interface DeepResearchConfig {
  enabled: boolean;
  maxSources: number;
  searchDepth: "shallow" | "medium" | "deep";
  autoSummarize: boolean;
  includeCitations: boolean;
}
