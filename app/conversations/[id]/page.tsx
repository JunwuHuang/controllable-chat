import { prisma } from "../../../lib/prisma";
import { notFound } from "next/navigation";
import ConversationSelector from "../../../components/ConversationSelector";
import MessageList from "../../../components/MessageList";
import ChatInput from "../../../components/ChatInput";

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;

  // 获取对话列表
  const conversations = await prisma.conversation
    .findMany({
      orderBy: { updatedAt: "desc" },
    })
    .then((conversations) =>
      conversations.map((conv) => ({
        ...conv,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      }))
    );

  // 获取当前对话
  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    notFound();
  }

  // 获取对话消息
  const messages = await prisma.message
    .findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    })
    .then((messages) =>
      messages.map((msg) => ({
        ...msg,
        createdAt: msg.createdAt.toISOString(),
        sender: msg.sender as "AI" | "User",
        status: (msg.status || undefined) as
          | "thinking"
          | "complete"
          | undefined,
      }))
    );

  return (
    <div className="flex h-screen bg-gray-100">
      <ConversationSelector
        conversations={conversations}
        currentId={id}
      />

      <div className="flex flex-col flex-1">
        <MessageList messages={messages} />
        <ChatInput conversationId={id} />
      </div>
    </div>
  );
}
