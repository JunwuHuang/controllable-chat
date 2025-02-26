import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// 删除对话
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.conversation.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除对话失败:', error)
    return NextResponse.json({ error: '删除对话失败' }, { status: 500 })
  }
}

// 更新对话标题
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { title } = await request.json()
    
    const updatedConversation = await prisma.conversation.update({
      where: { id: params.id },
      data: { title }
    })
    
    return NextResponse.json(updatedConversation)
  } catch (error) {
    console.error('更新对话失败:', error)
    return NextResponse.json({ error: '更新对话失败' }, { status: 500 })
  }
} 