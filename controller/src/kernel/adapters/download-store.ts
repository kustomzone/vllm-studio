/**
 * DownloadStore adapter — wraps upstream DownloadManager/Store.
 */
import type { DownloadRecord, DownloadStore } from "../interfaces";
import { DOWNLOAD_STATUS } from "../contracts";

export interface UpstreamDownloadStore {
  list(): Array<{
    id: string;
    model_id: string;
    target_dir: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  get(id: string): {
    id: string;
    model_id: string;
    target_dir: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
}

export interface UpstreamDownloadManager {
  list(): Array<{
    id: string;
    model_id: string;
    target_dir: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  start(request: {
    model_id: string;
    destination_dir?: string | null;
  }): Promise<{
    id: string;
    model_id: string;
    target_dir: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
}

function toRecord(raw: {
  id: string;
  model_id: string;
  target_dir: string;
  status: string;
  created_at: string;
  updated_at: string;
}): DownloadRecord {
  return {
    id: raw.id,
    modelId: raw.model_id,
    targetDir: raw.target_dir,
    status: raw.status as DownloadRecord["status"],
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export class DownloadStoreAdapter implements DownloadStore {
  private readonly manager: UpstreamDownloadManager;

  constructor(manager: UpstreamDownloadManager) {
    this.manager = manager;
  }

  create(modelId: string, targetDir: string): DownloadRecord {
    const ts = new Date().toISOString();
    return {
      id: `dl-${crypto.randomUUID().slice(0, 8)}`,
      modelId,
      targetDir,
      status: DOWNLOAD_STATUS.QUEUED,
      createdAt: ts,
      updatedAt: ts,
    };
  }

  update(downloadId: string, patch: Partial<DownloadRecord>): DownloadRecord {
    const existing = this.manager
      .list()
      .find((d) => d.id === downloadId);
    if (!existing) throw new Error(`Unknown download: ${downloadId}`);
    const record = toRecord(existing);
    return { ...record, ...patch, updatedAt: new Date().toISOString() };
  }

  list(): DownloadRecord[] {
    return this.manager.list().map(toRecord);
  }
}
