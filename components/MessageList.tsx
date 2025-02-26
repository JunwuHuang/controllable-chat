"use client";

import { useEffect, useRef } from "react";

interface Message {
  id?: string;
  sender: "AI" | "User";
  content: string;
  status?: "thinking" | "complete";
  conversationId?: string;
  createdAt?: string;
}

export default function MessageList({ messages }: { messages: Message[] }) {
  const messageEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div 
            key={message.id || index} 
            className={`flex items-start ${message.sender === "User" ? "justify-end" : ""}`}
          >
            <div 
              className={`rounded-lg p-3 shadow max-w-md ${
                message.sender === "User" 
                  ? "bg-blue-600 text-white" 
                  : "bg-white"
              }`}
            >
              <p className={`font-medium ${message.sender === "User" ? "text-white" : "text-gray-800"}`}>
                {message.sender === "User" ? "用户" : "AI助手"}
              </p>
              
              {message.status === "thinking" ? (
                <p className="text-gray-600 font-medium">正在思考中...</p>
              ) : null}
              
              {message.content.split("\n").map((line, i) => {
                if (line.startsWith("- ")) {
                  return (
                    <ul key={i} className="list-disc pl-5 mt-2">
                      <li className={message.sender === "User" ? "text-white" : "text-gray-700"}>{line.substring(2)}</li>
                    </ul>
                  );
                }
                return <p key={i} className={`${i > 0 ? "mt-2" : ""} ${message.sender === "User" ? "text-white" : "text-gray-700"}`}>{line}</p>;
              })}
            </div>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
    </div>
  );
} 