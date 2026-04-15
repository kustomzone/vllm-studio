import type { Attachment } from "../../../types";
import { formatBytes, formatDurationMmSs } from "@/lib/formatters";

export function maybeRevokeObjectUrl(url: string | undefined) {
  if (!url) return;
  if (!url.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
}

/** @deprecated Use `formatDurationMmSs` from `@/lib/formatters` directly. Re-exported for backwards compatibility. */
export const formatDuration = formatDurationMmSs;

/** @deprecated Use `formatBytes` from `@/lib/formatters` directly. Re-exported for backwards compatibility. */
export const formatFileSize = formatBytes;

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

export function clearAttachmentUrls(attachments: Attachment[]) {
  for (const attachment of attachments) {
    maybeRevokeObjectUrl(attachment.url);
  }
}

