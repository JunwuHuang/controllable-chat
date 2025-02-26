import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' }
    })
    return NextResponse.json(conversations)
  } catch (error) {
    return NextResponse.json({ error: '获取对话失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 从请求体获取标题，如果没有则使用默认值
    const body = await request.json().catch(() => ({}));
    const title = body.title || '新对话';
    
    const newConversation = await prisma.conversation.create({
      data: {
        title,
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
    })
    
    return NextResponse.json(newConversation)
  } catch (error) {
    return NextResponse.json({ error: '创建对话失败' }, { status: 500 })
  }
} 