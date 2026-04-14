"use client";

import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <Sparkles className="h-8 w-8 text-(--dim)" />
    </div>
  );
}

const ChatLayout = dynamic(() => import("./chat-layout").then((mod) => mod.ChatLayout), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});

export default function Chat2Page() {
  return <ChatLayout />;
}
