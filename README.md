# Gemini Chat Analyze & Evolver

这是一个专为开发者设计的“人机协作进化系统”，它通过监听、解析、分析 Gemini CLI 的历史会话，提供深度的可视化洞察和 Prompt 指令进化建议。

## 🚀 核心功能 (Main Features)
- **实时会话观测器 (Viewer)**: 美观的 Markdown 渲染，支持思考链 (Thoughts) 折叠展示。
- **工具链轨迹追踪 (Tool Timeline)**: 可视化每个工具调用的 `args` 和 `result`。
- **表达进化教练 (Coach Module)**: 自动审计 Prompt 质量，识别模糊代词，提供改写建议。
- **成长曲线仪表盘 (Dashboard)**: 可视化展示用户指令精准度的演进趋势。
- **设计令牌主题 (Tokenized UI)**: 统一的深色模式主题系统，类似 Linear 设计风格。

## 🛠️ 快速上手 (Getting Started)

### 环境要求
- Node.js v18+
- [Gemini CLI](https://github.com/google/gemini-cli) 已安装并有历史对话记录。

### 安装与启动
1. 克隆并安装依赖：
   ```sh
   npm install
   cd ui && npm install && cd ..
   ```
2. 启动全栈开发环境：
   ```sh
   npm run dev
   ```
   - **Frontend**: http://localhost:5173
   - **API Server**: http://localhost:3001

## 🏛️ 目录结构
- `src/`: 后端核心，包含 Watcher, Parser 和 SQLite 存储层。
- `ui/`: 前端 React (Vite) 应用。
- `docs/`: 包含架构设计、任务列表和数据结构文档。

## 📈 设计哲学
本系统坚持“离线优先 (Offline First)”和“Token 效率 (Token Efficiency)”原则，所有分析数据均存储在本地 `chat_analyze.db`。
