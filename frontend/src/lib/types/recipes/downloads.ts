// CRITICAL
/**
 * Model download + storage types.
 */

export type {
  DownloadStatus,
  DownloadFileStatus,
  DownloadFileInfo,
  ModelDownload,
} from "../../../../../shared/src";

export interface StorageInfo {
  models_dir: string;
  model_count: number;
  model_bytes: number;
  disk: {
    path: string;
    total_bytes: number | null;
    free_bytes: number | null;
    available_bytes: number | null;
  };
}

