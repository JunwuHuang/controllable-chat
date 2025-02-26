"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function ConversationSelector({ 
  conversations,
  currentId
}: { 
  conversations: Conversation[],
  currentId: string | null
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("新对话");
  const inputRef = useRef<HTMLInputElement>(null);

  // 当编辑状态改变时，聚焦到输入框
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  // 当新建对话模式启动时，聚焦到输入框
  useEffect(() => {
    if (isCreatingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingNew]);

  // 创建新对话
  const handleNewConversation = async () => {
    setIsCreatingNew(true);
    setNewTitle("新对话");
  };

  // 提交新对话
  const handleSubmitNew = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
      });
      const newConversation = await response.json();
      setIsCreatingNew(false);
      router.push(`/conversations/${newConversation.id}`);
    } catch (error) {
      console.error('创建对话失败', error);
      setIsCreatingNew(false);
    }
  };

  // 删除对话
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个对话吗？')) return;

    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'DELETE'
      });
      router.refresh();
      
      // 如果删除的是当前选中的对话，重定向到首页
      if (id === currentId) {
        router.push('/');
      }
    } catch (error) {
      console.error('删除对话失败', error);
    }
  };

  // 开始编辑对话标题
  const handleStartEditing = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  // 提交编辑后的标题
  const handleSubmitEdit = async () => {
    if (!editingId) return;
    
    try {
      await fetch(`/api/conversations/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: editTitle })
      });
      setEditingId(null);
      router.refresh();
    } catch (error) {
      console.error('更新对话标题失败', error);
      setEditingId(null);
    }
  };

  return (
    <div className="w-64 bg-gray-800 text-white p-4">
      {isCreatingNew ? (
        <div className="mb-4">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-gray-700 text-white px-3 py-2 rounded"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitNew();
              if (e.key === 'Escape') setIsCreatingNew(false);
            }}
          />
          <div className="flex mt-2 space-x-2">
            <button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-1 rounded text-sm"
              onClick={handleSubmitNew}
            >
              确认
            </button>
            <button 
              className="flex-1 bg-gray-600 hover:bg-gray-700 py-1 rounded text-sm"
              onClick={() => setIsCreatingNew(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button 
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded mb-4"
          onClick={handleNewConversation}
        >
          新对话
        </button>
      )}
      
      <div className="space-y-2">
        {conversations.map(conv => (
          <div 
            key={conv.id}
            className={`p-2 rounded ${currentId === conv.id ? 'bg-gray-700' : 'hover:bg-gray-700'} group`}
          >
            {editingId === conv.id ? (
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full bg-gray-600 text-white px-2 py-1 rounded"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <div className="flex mt-1 space-x-1">
                  <button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 py-0.5 rounded text-xs"
                    onClick={handleSubmitEdit}
                  >
                    确认
                  </button>
                  <button 
                    className="flex-1 bg-gray-600 hover:bg-gray-700 py-0.5 rounded text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className="flex justify-between items-center"
                onClick={() => router.push(`/conversations/${conv.id}`)}
              >
                <span className="truncate">{conv.title}</span>
                <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                  <button 
                    className="text-gray-400 hover:text-white"
                    onClick={(e) => handleStartEditing(conv.id, conv.title, e)}
                  >
                    ✏️
                  </button>
                  <button 
                    className="text-gray-400 hover:text-red-500"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 