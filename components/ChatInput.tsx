"use client";

import { useState, FormEvent } from "react";
import { createMessage } from "@/app/actions";

export default function ChatInput({ conversationId }: { conversationId: string }) {
  const [inputMessage, setInputMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !conversationId) return;

    const message = inputMessage;
    setInputMessage("");

    // 使用 Server Action 发送消息
    await createMessage(conversationId, message);
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <form onSubmit={handleSubmit} className="flex items-center">
        <div className="flex-1">
          <textarea
            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans text-gray-800"
            placeholder="请输入消息..."
            rows={3}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        <button
          type="submit"
          className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          发送
        </button>
      </form>
    </div>
  );
} 