import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// 存储活跃的SSE连接
const clients = new Map<string, ReadableStreamController<Uint8Array>>();
// 存储连接最后活动时间
const lastActivityTime = new Map<string, number>();

// 定期检查并清理不活跃连接（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    console.log(`开始清理不活跃SSE连接，当前连接数: ${clients.size}`);
    
    for (const [conversationId, controller] of clients.entries()) {
      const lastActive = lastActivityTime.get(conversationId) || 0;
      // 超过15分钟未活动的连接将被关闭
      if (now - lastActive > 15 * 60 * 1000) {
        console.log(`关闭不活跃SSE连接: ${conversationId}, 已闲置${Math.round((now - lastActive)/60000)}分钟`);
        try {
          controller.close();
        } catch (e) {
          console.error(`关闭SSE连接失败:`, e);
        }
        clients.delete(conversationId);
        lastActivityTime.delete(conversationId);
      }
    }
  }, 5 * 60 * 1000); // 每5分钟检查一次
}

// 发送消息给特定对话的所有客户端
export async function sendMessageToClients(conversationId: string) {
  try {
    // 更新最后活动时间
    lastActivityTime.set(conversationId, Date.now());
    
    // 获取最新消息
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });
    
    // 记录消息状态
    const thinkingMessages = messages.filter(msg => msg.status === "thinking");
    if (thinkingMessages.length > 0) {
      console.log(`对话${conversationId}有${thinkingMessages.length}条思考中的消息, 最新消息长度: ${thinkingMessages[0].content?.length || 0}`);
    }
    
    // 获取此对话的客户端
    const client = clients.get(conversationId);
    if (client) {
      try {
        // 优化：仅发送必要的字段，减少数据量
        const optimizedMessages = messages.map(msg => ({
          id: msg.id,
          sender: msg.sender,
          content: msg.content,
          status: msg.status,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt
        }));
        
        // 发送消息更新
        const data = `data: ${JSON.stringify(optimizedMessages)}\n\n`;
        client.enqueue(new TextEncoder().encode(data));
        console.log(`已向对话${conversationId}的客户端发送更新, 数据长度: ${data.length}`);
        
        // 如果没有思考中的消息，发送完成事件但不关闭连接
        if (!messages.some(msg => msg.status === "thinking")) {
          console.log(`对话${conversationId}没有思考中的消息，发送完成事件`);
          
          // 发送完成事件
          client.enqueue(new TextEncoder().encode(`event: complete\ndata: 所有消息已完成\n\n`));
          
          // 不再关闭连接，保持连接以便用户继续交互
          // setTimeout(() => {
          //   console.log(`关闭对话${conversationId}的SSE连接`);
          //   client.close();
          //   clients.delete(conversationId);
          // }, 1000);
        }
      } catch (error) {
        console.error(`向对话${conversationId}的客户端发送更新失败:`, error);
        // 尝试关闭可能已损坏的连接
        try {
          client.close();
        } catch (e) {
          console.error(`关闭对话${conversationId}的SSE连接失败:`, e);
        }
        clients.delete(conversationId);
        lastActivityTime.delete(conversationId);
      }
    } else {
      console.log(`对话${conversationId}没有活跃的SSE客户端连接`);
    }
  } catch (error) {
    console.error('发送SSE消息失败:', error);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversationId');
  
  if (!conversationId) {
    return new Response('缺少conversationId参数', { status: 400 });
  }
  
  console.log(`收到对话${conversationId}的SSE连接请求`);
  
  // 关闭该对话已有的连接(如果存在)
  const existingClient = clients.get(conversationId);
  if (existingClient) {
    try {
      console.log(`关闭对话${conversationId}已有的SSE连接`);
      existingClient.close();
    } catch (e) {
      console.error(`关闭已有SSE连接失败:`, e);
    }
    clients.delete(conversationId);
    lastActivityTime.delete(conversationId);
  }
  
  // 创建一个可读流
  const stream = new ReadableStream({
    start(controller) {
      // 存储控制器以便稍后发送消息
      clients.set(conversationId, controller);
      // 设置最后活动时间
      lastActivityTime.set(conversationId, Date.now());
      
      console.log(`为对话${conversationId}创建新的SSE连接`);
      
      // 发送初始连接消息
      controller.enqueue(new TextEncoder().encode('event: connected\ndata: 连接已建立\n\n'));
      
      // 立即发送当前消息
      sendMessageToClients(conversationId);
      
      // 设置心跳，每30秒发送一次ping
      const heartbeatInterval = setInterval(() => {
        try {
          if (clients.has(conversationId)) {
            controller.enqueue(new TextEncoder().encode('event: ping\ndata: 保持连接\n\n'));
            lastActivityTime.set(conversationId, Date.now());
          } else {
            clearInterval(heartbeatInterval);
          }
        } catch (e) {
          console.error(`发送心跳失败:`, e);
          clearInterval(heartbeatInterval);
          if (clients.has(conversationId)) {
            clients.delete(conversationId);
            lastActivityTime.delete(conversationId);
          }
        }
      }, 30000); // 每30秒
    },
    cancel() {
      // 连接关闭时清理
      console.log(`对话${conversationId}的SSE连接被关闭`);
      clients.delete(conversationId);
      lastActivityTime.delete(conversationId);
    }
  });
  
  // 返回SSE响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
    }
  });
}