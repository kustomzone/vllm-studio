// CRITICAL
import { AsyncLock } from "../core/async";
import type { ServiceId } from "../types/services";

export type GpuLease = {
  holder_service_id: ServiceId;
  acquired_at: string;
  reason?: string | null;
};

export type GpuLeaseConflictPayload = {
  code: "gpu_lease_conflict";
  requested_service: { id: ServiceId };
  holder_service: { id: ServiceId };
  recommended_actions: Array<
    | { type: "replace"; label: string }
    | { type: "best_effort"; label: string }
    | { type: "cancel"; label: string }
  >;
};

/**
 * Structured error thrown when a strict GPU lease acquisition conflicts with another holder.
 */
export class GpuLeaseConflictError extends Error {
  public readonly payload: GpuLeaseConflictPayload;

  /**
   * Create a GPU lease conflict error.
   * @param payload - Conflict payload to return to callers.
   */
  public constructor(payload: GpuLeaseConflictPayload) {
    super("GPU lease conflict");
    this.payload = payload;
  }
}

/**
 * Strict-by-default GPU lease manager. Designed for a future N-GPU API but
 * currently manages a single global lease (one holder at a time).
 */
export class GpuLeaseManager {
  private readonly lock = new AsyncLock();
  private lease: GpuLease | null = null;

  /**
   * Get the current lease snapshot.
   * @returns Lease snapshot or null.
   */
  public getLease(): GpuLease | null {
    return this.lease ? { ...this.lease } : null;
  }

  /**
   * Force-set the current lease holder (used to reconcile with external state).
   * @param holder - Service id taking the lease.
   * @param reason - Optional reason.
   * @returns Lease snapshot.
   */
  public async forceSetLease(holder: ServiceId, reason?: string | null): Promise<GpuLease> {
    const release = await this.lock.acquire();
    try {
      this.lease = { holder_service_id: holder, acquired_at: new Date().toISOString(), reason: reason ?? null };
      return { ...this.lease };
    } finally {
      release();
    }
  }

  /**
   * Release the lease if held by the provided service.
   * @param holder - Service id releasing the lease.
   * @returns void
   */
  public async release(holder: ServiceId): Promise<void> {
    const release = await this.lock.acquire();
    try {
      if (this.lease?.holder_service_id === holder) {
        this.lease = null;
      }
    } finally {
      release();
    }
  }

  /**
   * Acquire a strict lease; throws on conflict unless already held by requested.
   * @param requested - Service id requesting the lease.
   * @param reason - Optional reason.
   * @returns Lease snapshot.
   */
  public async acquireStrict(requested: ServiceId, reason?: string | null): Promise<GpuLease> {
    const release = await this.lock.acquire();
    try {
      if (!this.lease) {
        this.lease = { holder_service_id: requested, acquired_at: new Date().toISOString(), reason: reason ?? null };
        return { ...this.lease };
      }
      if (this.lease.holder_service_id === requested) {
        return { ...this.lease };
      }

      throw new GpuLeaseConflictError({
        code: "gpu_lease_conflict",
        requested_service: { id: requested },
        holder_service: { id: this.lease.holder_service_id },
        recommended_actions: [
          { type: "replace", label: "Stop current holder and start requested service" },
          { type: "best_effort", label: "Try best-effort start anyway (may fail/OOM)" },
          { type: "cancel", label: "Cancel" },
        ],
      });
    } finally {
      release();
    }
  }
}
