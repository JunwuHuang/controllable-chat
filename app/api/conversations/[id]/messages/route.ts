import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { sendMessageToClients } from '@/app/api/sse/route';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
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
    const { id } = await params;
    const { content } = await request.json()
    
    // 检查该请求是否来自Server Action
    const isFromServerAction = request.headers.get('x-from-server-action') === 'true';
    let aiMessage;
    
    // 如果不是来自Server Action，则创建用户消息和AI消息
    if (!isFromServerAction) {
      // 创建用户消息
      await prisma.message.create({
        data: {
          sender: 'User',
          content,
          conversationId: id
        }
      })
      
      // 创建AI响应消息(思考状态)
      aiMessage = await prisma.message.create({
        data: {
          sender: 'AI',
          content: '',
          status: 'thinking',
          conversationId: id
        }
      })
      
      // 更新对话最后修改时间
      await prisma.conversation.update({
        where: { id: id },
        data: { updatedAt: new Date() }
      })
    } else {
      // 如果是来自Server Action，仅获取最新的AI消息
      aiMessage = await prisma.message.findFirst({
        where: { 
          conversationId: id,
          sender: 'AI',
          status: 'thinking'
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!aiMessage) {
        return NextResponse.json({ error: '找不到等待响应的AI消息' }, { status: 404 });
      }
    }
    
    // 通知SSE客户端消息已更新
    await sendMessageToClients(id);
    
    // 获取对话历史
    const conversationHistory = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' }
    });
    
    // 使用LangChain和兼容OpenAI协议的服务生成回复
    const generateAIResponse = async () => {
      let timeoutCheck: NodeJS.Timeout | null = null;
      let isCompleted = false;
      
      try {
        // 检查API密钥是否存在
        if (!process.env.OPENAI_API_KEY) {
          console.error('OpenAI API密钥未设置');
          throw new Error('OpenAI API密钥未设置');
        }
        
        // 初始化OpenAI客户端，启用流式输出
        const chatModel = new ChatOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          model: "deepseek-r1-250120",
          temperature: 0,
          streaming: true,
          configuration: {
            baseURL: 'https://ark.cn-beijing.volces.com/api/v3/'
          }
        });
        
        // 构建消息历史
        const messages = [
          new SystemMessage("你是一个友好、专业的AI助手，能够提供有用的信息和建议。"),
          ...conversationHistory.map(msg => 
            msg.sender === 'User' 
              ? new HumanMessage(msg.content) 
              : new AIMessage(msg.content || "")
          ).filter(msg => msg.content !== "")
        ];
        
        let responseText = "";
        isCompleted = false;
        let updateCounter = 0;
        
        // 设置超时检查
        timeoutCheck = setTimeout(async () => {
          if (!isCompleted && responseText.length > 0) {
            console.log('AI响应超时，强制完成，消息ID:', aiMessage.id);
            
            // 更新状态为完成
            await prisma.message.update({
              where: { id: aiMessage.id },
              data: {
                status: 'complete'
              }
            });
            
            // 通知SSE客户端消息已完成
            await sendMessageToClients(id);
          }
        }, 30000); // 30秒超时
        
        try {
          // 使用流式响应 - 更现代的方式
          const stream = await chatModel.stream(messages);
          
          for await (const chunk of stream) {
            if (chunk.content) {
              responseText += chunk.content;
              updateCounter++;
              
              // 智能更新策略：随着内容增长，降低更新频率
              // - 开始时每3个token更新一次（快速反馈）
              // - 中间内容每10个token更新一次
              // - 长内容每25个token更新一次
              let shouldUpdate = false;
              
              if (responseText.length < 200 && updateCounter % 3 === 0) {
                // 短内容：更频繁更新，提升用户体验
                shouldUpdate = true;
              } else if (responseText.length < 1000 && updateCounter % 10 === 0) {
                // 中等内容：适中更新频率
                shouldUpdate = true;
              } else if (updateCounter % 25 === 0) {
                // 长内容：降低更新频率，减轻服务器负担
                shouldUpdate = true;
              }
              
              if (shouldUpdate) {
                console.log(`AI响应进行中，已生成${responseText.length}个字符，消息ID:`, aiMessage.id);
                
                // 更新数据库
                await prisma.message.update({
                  where: { id: aiMessage.id },
                  data: {
                    content: responseText,
                    status: 'thinking'
                  }
                });
                
                // 通知SSE客户端消息已更新
                await sendMessageToClients(id);
              }
            }
          }
          
          // 流结束，最终更新
          console.log('AI响应生成完成，更新状态为complete，消息ID:', aiMessage.id);
          console.log('最终响应文本长度:', responseText.length);
          
          isCompleted = true;
          if (timeoutCheck) {
            clearTimeout(timeoutCheck);
          }
          
          // 响应完成后更新状态
          await prisma.message.update({
            where: { id: aiMessage.id },
            data: {
              content: responseText,
              status: 'complete'
            }
          });
          
          // 通知SSE客户端消息已完成
          await sendMessageToClients(id);
        } catch (error) {
          console.error('AI流式响应生成失败:', error);
          isCompleted = true;
          if (timeoutCheck) {
            clearTimeout(timeoutCheck);
          }
          
          await prisma.message.update({
            where: { id: aiMessage.id },
            data: {
              content: "抱歉，我现在无法回应。请稍后再试。",
              status: 'error'
            }
          });
          
          // 通知SSE客户端发生错误
          await sendMessageToClients(id);
          throw error; // 重新抛出错误，以便上层捕获
        }
      } catch (error) {
        console.error('AI响应生成失败:', error);
        isCompleted = true;
        if (timeoutCheck) {
          clearTimeout(timeoutCheck);
        }
        
        await prisma.message.update({
          where: { id: aiMessage.id },
          data: {
            content: "抱歉，我现在无法回应。请稍后再试。",
            status: 'error'
          }
        });
        
        // 通知SSE客户端发生错误
        await sendMessageToClients(id);
        throw error; // 重新抛出错误，以便上层捕获
      }
      
      console.log('generateAIResponse函数执行完毕，消息ID:', aiMessage.id);
      return true; // 表示成功完成初始化
    };
    
    try {
      // 异步开始AI响应生成并等待初始化完成
      // 只等待初始化部分，实际的流处理仍然是异步的
      await generateAIResponse();
      
      // 如果到这里，说明AI响应生成已经成功开始
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('启动AI响应生成失败:', error);
      
      // 如果AI响应生成无法启动，更新消息状态为错误
      await prisma.message.update({
        where: { id: aiMessage.id },
        data: {
          content: "抱歉，系统无法处理您的请求。请稍后再试。",
          status: 'error'
        }
      });
      
      // 通知SSE客户端发生错误
      await sendMessageToClients(id);
      
      // 返回错误响应
      return NextResponse.json({ error: 'AI响应生成失败' }, { status: 500 });
    }
  } catch (error) {
    console.error('发送消息失败:', error)
    return NextResponse.json({ error: '发送消息失败' }, { status: 500 })
  }
} 