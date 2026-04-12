// CRITICAL
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import * as Icons from "../../icons";

interface ImagePart {
  url: string;
  name?: string;
}

export function UserMessage({
  messageId,
  textContent,
  images,
  copied,
  canActOnContent,
  onCopy,
  onExport,
}: {
  messageId: string;
  textContent: string;
  images?: ImagePart[];
  copied: boolean;
  canActOnContent: boolean;
  onCopy: () => void;
  onExport: () => void;
}) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const hasImages = images && images.length > 0;

  const handleImageClick = useCallback((url: string) => {
    setExpandedImage((prev) => (prev === url ? null : url));
  }, []);

  return (
    <div id={`message-${messageId}`} className="group">
      {/* Expanded image overlay */}
      {expandedImage && (
        <div className="mb-3">
          <button
            onClick={() => setExpandedImage(null)}
            className="rounded-2xl overflow-hidden border border-(--border) cursor-pointer"
          >
            <Image
              src={expandedImage}
              alt="Expanded"
              width={600}
              height={600}
              className="w-auto h-auto max-w-full max-h-[60vh] object-contain"
              unoptimized
            />
          </button>
        </div>
      )}

      {/* Clean separator-style message */}
      <div className="pt-4 pb-3 border-b border-(--border)/40">
        {hasImages && (
          <div className={`flex flex-wrap gap-2 ${textContent ? "mb-2" : ""}`}>
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => handleImageClick(img.url)}
                className="rounded-xl overflow-hidden border border-(--border) hover:border-(--dim)/30 transition-colors cursor-pointer"
              >
                <Image
                  src={img.url}
                  alt={img.name ?? `Image ${i + 1}`}
                  width={120}
                  height={120}
                  className="w-auto h-auto max-w-[120px] max-h-[120px] object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}

        {textContent && (
          <p className="text-[15px] leading-[1.7] text-(--dim) whitespace-pre-wrap break-words">
            {textContent}
          </p>
        )}

        {/* Ghost actions on hover */}
        <div className="flex items-center gap-0.5 mt-1.5 h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={onCopy}
            disabled={!canActOnContent}
            className="p-1 rounded-md hover:bg-(--surface) transition-colors disabled:opacity-30"
            title="Copy"
          >
            {copied ? (
              <Icons.Check className="h-3 w-3 text-(--hl2)" />
            ) : (
              <Icons.Copy className="h-3 w-3 text-(--dim)/40" />
            )}
          </button>
          <button
            onClick={onExport}
            disabled={!canActOnContent}
            className="p-1 rounded-md hover:bg-(--surface) transition-colors disabled:opacity-30"
            title="Export"
          >
            <Icons.Download className="h-3 w-3 text-(--dim)/40" />
          </button>
        </div>
      </div>
    </div>
  );
}
