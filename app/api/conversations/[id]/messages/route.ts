import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: params.id },
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json(messages)
  } catch (error) {
    console.error('获取消息失败:', error)
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { content } = await request.json()
    
    // 创建用户消息
    await prisma.message.create({
      data: {
        sender: 'User',
        content,
        conversationId: params.id
      }
    })
    
    // 创建AI响应消息(思考状态)
    const aiMessage = await prisma.message.create({
      data: {
        sender: 'AI',
        content: '',
        status: 'thinking',
        conversationId: params.id
      }
    })
    
    // 更新对话最后修改时间
    await prisma.conversation.update({
      where: { id: params.id },
      data: { updatedAt: new Date() }
    })
    
    // 更新AI消息为完成状态 (模拟)
    setTimeout(async () => {
      try {
        await prisma.message.update({
          where: { id: aiMessage.id },
          data: {
            content: "React是一个用于构建用户界面的JavaScript库。以下是React的一些基础知识：\n- 组件是React的核心概念\n- 使用JSX语法来描述UI\n- 单向数据流使应用更易于理解\n- 虚拟DOM提高了性能\n\n你想了解更具体的哪方面内容呢？",
            status: 'complete'
          }
        })
      } catch (error) {
        console.error('更新AI消息失败:', error)
      }
    }, 2000)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('发送消息失败:', error)
    return NextResponse.json({ error: '发送消息失败' }, { status: 500 })
  }
} 