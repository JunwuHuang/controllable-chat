"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Message {
  id?: string;
  sender: "AI" | "User";
  content: string;
  status?: "thinking" | "complete" | "error";
  conversationId?: string;
  createdAt?: string;
}

export default function MessageList({ messages: initialMessages }: { messages: Message[] }) {
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 添加连接状态跟踪
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected" | "reconnecting" | "failed">("connected");
  
  // 获取当前对话ID
  const conversationId = messages.length > 0 ? messages[0]?.conversationId : null;
  
  // 重置不活动计时器的函数
  const resetInactivityTimer = () => {
    // 清除已有计时器
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // 设置新计时器：10分钟无活动后关闭连接
    inactivityTimerRef.current = setTimeout(() => {
      console.log('SSE连接10分钟无活动，自动关闭');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }, 10 * 60 * 1000); // 10分钟
  };
  
  // 添加创建SSE连接的函数
  const createEventSource = useCallback(() => {
    if (!conversationId) return;
    
    // 更新连接状态
    setConnectionState(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");
    
    // 关闭现有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // 清理重连计时器
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    console.log(`创建SSE连接: /api/sse?conversationId=${conversationId}，重连次数: ${reconnectAttemptsRef.current}`);
    
    const eventSource = new EventSource(`/api/sse?conversationId=${conversationId}`);
    eventSourceRef.current = eventSource;
    
    // 初始化不活动计时器
    resetInactivityTimer();
    
    // 处理连接建立事件
    eventSource.addEventListener('connected', (event) => {
      console.log('SSE连接已建立:', event.data);
      resetInactivityTimer();
      reconnectAttemptsRef.current = 0; // 重置重连计数
      setConnectionState("connected");
    });
    
    // 处理完成事件
    eventSource.addEventListener('complete', (event) => {
      console.log('SSE连接收到完成事件:', event.data);
      resetInactivityTimer();
    });
    
    // 处理心跳事件
    eventSource.addEventListener('ping', (event) => {
      console.log('收到心跳:', event.data);
      resetInactivityTimer();
    });
    
    // 处理消息更新事件
    eventSource.onmessage = (event) => {
      try {
        console.log('收到SSE消息更新，数据长度:', event.data.length);
        
        // 重置不活动计时器
        resetInactivityTimer();
        
        // 检查数据是否有效
        if (!event.data || event.data.trim() === '') {
          console.warn('收到空SSE消息数据');
          return;
        }
        
        const latestMessages = JSON.parse(event.data) as Message[];
        console.log(`解析后的消息数量: ${latestMessages.length}`);
        
        // 检查消息状态
        const thinkingMessage = latestMessages.find(msg => msg.status === "thinking");
        if (thinkingMessage) {
          console.log('仍有思考中的消息:', thinkingMessage.id, '内容长度:', thinkingMessage.content.length);
        } else {
          console.log('所有消息已完成');
          // 输出最新的消息状态，查看完成的消息
          latestMessages.forEach(msg => {
            console.log(`消息ID: ${msg.id}, 状态: ${msg.status}, 内容长度: ${msg.content.length}`);
          });
        }
        
        setMessages(latestMessages);
      } catch (error) {
        console.error('解析SSE消息失败:', error, '原始数据:', event.data.substring(0, 100));
      }
    };
    
    // 处理错误
    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      
      // 更新连接状态
      setConnectionState("disconnected");
      
      // 关闭错误的连接
      eventSource.close();
      
      // 重连逻辑
      const maxRetries = 5;
      const baseDelay = 1000; // 1秒基础延迟
      
      if (reconnectAttemptsRef.current < maxRetries) {
        // 计算指数退避延迟
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 30000); // 最多30秒
        console.log(`SSE连接将在${delay}ms后重连，尝试次数: ${reconnectAttemptsRef.current + 1}/${maxRetries}`);
        
        reconnectAttemptsRef.current += 1;
        setConnectionState("reconnecting");
        reconnectTimerRef.current = setTimeout(createEventSource, delay);
      } else {
        console.error(`SSE重连失败，已达到最大尝试次数(${maxRetries})`);
        eventSourceRef.current = null;
        setConnectionState("failed");
      }
    };
    
    return eventSource;
  }, [conversationId]);
  
  // 使用SSE获取实时消息更新
  useEffect(() => {
    // 初始化消息
    setMessages(initialMessages);
    
    // 如果没有对话ID，不建立SSE连接
    if (!conversationId) return;
    
    // 重置重连计数
    reconnectAttemptsRef.current = 0;
    
    // 创建SSE连接
    createEventSource();
    
    // 组件卸载时关闭连接
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // 清理不活动计时器
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      
      // 清理重连计时器
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [initialMessages, conversationId, createEventSource]);

  // 添加网络状态监听
  useEffect(() => {
    // 监听网络状态变化
    const handleOnline = () => {
      console.log("网络已连接，尝试重新建立SSE连接");
      if (connectionState === "disconnected" || connectionState === "failed") {
        reconnectAttemptsRef.current = 0; // 重置重连计数
        createEventSource();
      }
    };
    
    const handleOffline = () => {
      console.log("网络已断开");
      setConnectionState("disconnected");
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionState, createEventSource]);

  // 自动滚动到最新消息
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* 显示连接状态 */}
      {connectionState !== "connected" && (
        <div className={`mb-4 p-2 rounded text-sm ${
          connectionState === "connecting" ? "bg-blue-100 text-blue-800" :
          connectionState === "reconnecting" ? "bg-yellow-100 text-yellow-800" :
          "bg-red-100 text-red-800"
        }`}>
          {connectionState === "connecting" && "正在连接服务器..."}
          {connectionState === "reconnecting" && "正在重新连接服务器..."}
          {connectionState === "disconnected" && "与服务器的连接已断开，尝试重新连接..."}
          {connectionState === "failed" && "连接服务器失败，请刷新页面重试"}
        </div>
      )}
      
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
                <div>
                  <p className="text-gray-600 font-medium">正在思考中...</p>
                  <div className="mt-1 flex space-x-1">
                    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "600ms" }}></div>
                  </div>
                </div>
              ) : message.status === "error" ? (
                <p className="text-red-500 font-medium">抱歉，出现了错误，请重试。</p>
              ) : null}
              
              {/* 无论状态如何，始终显示消息内容 */}
              {message.content && message.content.split("\n").map((line, i) => {
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