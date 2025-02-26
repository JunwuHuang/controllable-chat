import { prisma } from "../lib/prisma";
import { redirect } from "next/navigation";
import ConversationSelector from "../components/ConversationSelector";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";

export default async function Home() {
  // 获取对话列表
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' }
  }).then(conversations => conversations.map(conv => ({
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString()
  })));
  
  // 如果有对话，重定向到第一个对话
  if (conversations.length > 0) {
    redirect(`/conversations/${conversations[0].id}`);
  }
  
  // 如果没有对话，显示空状态
  return (
    <div className="flex h-screen bg-gray-100">
      <ConversationSelector 
        conversations={conversations}
        currentId={null}
      />
      
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="text-gray-500 text-lg">
          请创建新对话或选择已有对话
        </p>
      </div>
    </div>
  );
}
