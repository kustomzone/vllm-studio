// CRITICAL
"use client";

import Link from "next/link";
import { isParallaxEnabled } from "@/lib/features";

export default function BetaPage() {
  const parallax = isParallaxEnabled();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Beta</h1>
        <p className="text-sm text-[#9a9590] mt-1">
          Experimental features behind local flags. Expect breaking changes.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Parallax (Model Sharing)</div>
              <div className="text-xs text-[#9a9590] mt-1">
                Create a share link for a model (local or Hugging Face) and guide others through install.
              </div>
            </div>
            {parallax ? (
              <Link
                href="/beta/parallax"
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15 transition-colors"
              >
                Open
              </Link>
            ) : (
              <span className="text-xs text-[#9a9590]">Enable in Chat Settings</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

