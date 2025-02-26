# 可控聊天应用 (Controllable Chat)

这是一个基于 Next.js、Prisma 和 LangChain 构建的智能聊天应用，允许用户自定义使用的大语言模型。

## 技术栈

- **前端框架**: Next.js 14 (App Router)
- **数据库 ORM**: Prisma
- **AI 集成**: LangChain
- **开发工具**: Cursor AI (使用 Claude-3.7-sonnet 模型辅助开发)

## 主要功能

- 创建和管理多个对话
- 实时聊天界面，支持思考状态显示
- 对话历史记录保存和浏览
- 响应式设计，适配不同设备
- 支持用户自定义选择大语言模型

## 项目结构

- `/app`: Next.js 应用路由和页面组件
- `/components`: 可复用的 UI 组件
- `/lib`: 工具函数和数据库连接
- `/prisma`: 数据库模型和迁移文件

## 本地开发

1. 克隆仓库
2. 安装依赖: `npm install`
3. 配置环境变量
4. 初始化数据库: `npx prisma migrate dev`
5. 启动开发服务器: `npm run dev`

## 数据模型

应用主要包含两个核心数据模型:

- `Conversation`: 对话容器
- `Message`: 单条消息，包含用户和 AI 的回复

## 贡献指南

欢迎提交 Pull Request 或创建 Issue 来改进这个项目。

## 许可证

MIT

