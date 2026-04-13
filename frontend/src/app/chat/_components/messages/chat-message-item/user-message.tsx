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
      {expandedImage && (
        <div className="mb-2">
          <button
            onClick={() => setExpandedImage(null)}
            className="rounded-lg overflow-hidden border border-(--border) cursor-pointer"
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

      <div className="flex justify-end py-1.5">
        <div className="max-w-[85%] md:max-w-[75%]">
          <div className="px-3.5 py-2.5 rounded-2xl bg-(--surface) border border-(--border)/50">
            {hasImages && (
              <div className={`flex flex-wrap gap-1.5 ${textContent ? "mb-2" : ""}`}>
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => handleImageClick(img.url)}
                    className="rounded-lg overflow-hidden border border-(--border) hover:border-(--dim)/30 transition-colors cursor-pointer"
                  >
                    <Image
                      src={img.url}
                      alt={img.name ?? `Image ${i + 1}`}
                      width={100}
                      height={100}
                      className="w-auto h-auto max-w-[100px] max-h-[100px] object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}

            {textContent && (
              <p className="text-[14px] leading-[1.6] text-(--fg) whitespace-pre-wrap break-words">
                {textContent}
              </p>
            )}
          </div>

          <div className="flex justify-end items-center gap-0.5 mt-1 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
    </div>
  );
}
