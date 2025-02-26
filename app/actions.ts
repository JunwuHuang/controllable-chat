"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
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
    const aiMessage = await prisma.message.create({
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
    
    // 返回消息ID，让客户端处理轮询或WebSocket监听
    return { success: true, messageId: aiMessage.id };
  } catch (error) {
    console.error('发送消息失败', error);
    return { success: false };
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