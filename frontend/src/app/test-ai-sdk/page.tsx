"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export default function TestAISDKPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/v2",
    }),
    onError: (error) => {
      console.error("[AI SDK Client Error]:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Test Page] Submitting message:", input);
    console.log("[Test Page] Current status:", status);
    if (input.trim() && status === "ready") {
      sendMessage({ text: input });
      setInput("");
    } else {
      console.log("[Test Page] Cannot submit - status:", status, "input:", input);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI SDK Test (v2 API)</h1>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="p-4 border rounded-lg">
            <div className="font-semibold mb-2">{message.role}</div>
            <div className="text-xs text-gray-500 mb-2">
              Parts: {message.parts.length}
            </div>
            {message.parts.map((part, idx) => {
              switch (part.type) {
                case "text":
                  return (
                    <div key={idx} className="whitespace-pre-wrap">
                      {part.text}
                    </div>
                  );
                default:
                  return (
                    <div key={idx} className="text-gray-500">
                      Unknown part type: {part.type}
                    </div>
                  );
              }
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="p-4 border rounded-lg bg-gray-50 text-gray-500">
            No messages yet. Send a message to test the AI SDK integration.
          </div>
        )}

        {(status === "submitted" || status === "streaming") && (
          <div className="p-4 border rounded-lg bg-blue-50">
            <div className="font-semibold">Assistant</div>
            <div className="text-blue-600">
              Status: {status === "submitted" ? "Waiting for response..." : "Streaming..."}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 border border-red-500 rounded-lg bg-red-50">
            <div className="font-semibold text-red-700">Error</div>
            <div className="text-red-600 text-sm">{error.message}</div>
            <div className="text-red-400 text-xs mt-2">
              Check browser console and server logs for details
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="font-semibold">Status:</span>
        <span className={status === "ready" ? "text-green-600" : "text-blue-600"}>
          {status || "initializing"}
        </span>
        <span className="text-gray-500">
          ({messages.length} messages)
        </span>
        {(status === "submitted" || status === "streaming") && (
          <button
            onClick={stop}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Stop
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status !== "ready" || !input.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>

      <div className="mt-4 p-4 bg-gray-100 rounded-lg text-xs">
        <div className="font-semibold mb-2">Debug Info:</div>
        <div>Status: {status}</div>
        <div>Messages: {messages.length}</div>
        <div>Error: {error ? error.message : "none"}</div>
      </div>
    </div>
  );
}
