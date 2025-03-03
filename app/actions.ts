"use server";

import { prisma } from "@/lib/prisma";
// import { redirect } from "next/navigation"; // 删除未使用的导入
import { revalidatePath } from "next/cache";

export async function createConversation() {
  try {
    const newConversation = await prisma.conversation.create({
      data: {
        messages: {
          create: {
            sender: 'AI',
            content: '你好，我是AI助手，有什么我可以帮助你的吗？',
            status: 'complete'
          }
        }
      },
      include: {
        messages: true
      }
    });
    
    revalidatePath('/conversations');
    return newConversation;
  } catch (error) {
    console.error('创建对话失败', error);
    return null;
  }
}

export async function createMessage(conversationId: string, content: string) {
  let aiMessage;  // 在try块外部声明aiMessage变量
  
  try {
    // 创建用户消息
    await prisma.message.create({
      data: {
        sender: 'User',
        content,
        conversationId
      }
    });
    
    // 创建AI响应消息(思考状态)
    aiMessage = await prisma.message.create({
      data: {
        sender: 'AI',
        content: '',
        status: 'thinking',
        conversationId
      }
    });
    
    // 更新对话最后修改时间
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });
    
    revalidatePath(`/conversations/${conversationId}`);
    
    // 调用API端点生成AI响应
    try {
      console.log(`开始调用API生成AI响应，对话ID: ${conversationId}`);
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-from-server-action': 'true'
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        throw new Error(`API响应错误: ${response.status}`);
      }
      
      console.log(`API调用成功，对话ID: ${conversationId}`);
    } catch (apiError) {
      console.error('调用AI响应API失败:', apiError);
      // 即使API调用失败，我们仍然返回成功
      // 这样前端可以继续处理已创建的消息
    }
    
    // 返回消息ID，让客户端处理轮询或WebSocket监听
    if (aiMessage && aiMessage.id) {
      return { success: true, messageId: aiMessage.id };
    } else {
      console.error('AI消息创建成功但ID不可用');
      return { success: false, error: 'AI消息ID不可用' };
    }
  } catch (error) {
    console.error('发送消息失败', error);
    return { success: false, error: '发送消息失败' };
  }
}

// 新增一个更新AI消息的函数
export async function updateAIMessage(messageId: string, content: string) {
  try {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        status: 'complete'
      }
    });
    
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true }
    });
    
    if (message) {
      revalidatePath(`/conversations/${message.conversationId}`);
    }
    
    return true;
  } catch (error) {
    console.error('更新AI消息失败:', error);
    return false;
  }
} 