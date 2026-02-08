// CRITICAL
import { describe, expect, it } from "bun:test";
import { GpuLeaseManager, GpuLeaseConflictError } from "../services/gpu-lease";

describe("GpuLeaseManager", () => {
  it("acquires and releases leases", async () => {
    const lease = new GpuLeaseManager();
    expect(lease.getLease()).toBe(null);

    await lease.acquireStrict("llm");
    expect(lease.getLease()?.holder_service_id).toBe("llm");

    await lease.release("llm");
    expect(lease.getLease()).toBe(null);
  });

  it("throws a structured conflict in strict mode", async () => {
    const lease = new GpuLeaseManager();
    await lease.acquireStrict("llm");

    let thrown: unknown = null;
    try {
      await lease.acquireStrict("image");
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GpuLeaseConflictError);
    const payload = (thrown as GpuLeaseConflictError).payload;
    expect(payload.code).toBe("gpu_lease_conflict");
    expect(payload.requested_service.id).toBe("image");
    expect(payload.holder_service.id).toBe("llm");
  });
});
