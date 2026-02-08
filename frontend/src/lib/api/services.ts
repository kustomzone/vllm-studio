// CRITICAL
import type { GpuLease, ServiceId, ServiceState } from "../types";
import type { ApiCore } from "./core";

export function createServicesApi(core: ApiCore) {
  return {
    getServices: async (): Promise<{ services: ServiceState[]; gpu_lease: GpuLease | null }> => {
      const data = await core.request<{ services?: ServiceState[]; gpu_lease?: GpuLease | null }>("/services");
      return {
        services: Array.isArray(data?.services) ? (data.services as ServiceState[]) : [],
        gpu_lease: (data?.gpu_lease ?? null) as GpuLease | null,
      };
    },

    startService: (
      id: ServiceId,
      payload: { recipe_id?: string; mode?: "strict" | "best_effort"; replace?: boolean } = {},
    ): Promise<{ service: ServiceState }> =>
      core.request(`/services/${encodeURIComponent(id)}/start`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    stopService: (id: ServiceId): Promise<{ service: ServiceState }> =>
      core.request(`/services/${encodeURIComponent(id)}/stop`, { method: "POST" }),

    getServiceHealth: (id: ServiceId): Promise<{ ok: boolean; service: ServiceState }> =>
      core.request(`/services/${encodeURIComponent(id)}/health`),

    getServiceVersion: (id: ServiceId): Promise<{ version: string | null; service: ServiceState }> =>
      core.request(`/services/${encodeURIComponent(id)}/version`),
  };
}
