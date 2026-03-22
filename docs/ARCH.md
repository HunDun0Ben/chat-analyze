# 🏛️ 系统架构说明 (Architecture)

## 1. 整体拓扑 (System Topology)
系统采用典型的 **前后端分离 (Decoupled)** 架构，数据流向如下：

`[Gemini CLI (session-*.json)]` -> `[ChatWatcher]` -> `[SessionParser]` -> `[SQLite (chat_analyze.db)]`
`[SQLite]` <- `[Express API (Port 3001)]` <- `[React Frontend (Port 5173)]`

## 2. 核心组件 (Core Components)

### 2.1 后端 (Server & Parser)
- **Watcher (`server/core/watcher.ts`)**: 监听 `~/.gemini/tmp` 目录下的 JSON 变更。
- **Parser (`server/core/parser.ts`)**: 核心审计引擎。负责 Markdown 提取、工具链分析及 **Coach Module** 评分。
- **Storage (`server/db/storage.ts`)**: 基于 `better-sqlite3`。存储标准化后的会话数据，支持时间序列统计。
- **API Server (`server/api/server.ts`)**: 提供 REST 接口。

### 2.2 前端 (UI & Viewer)
- **Vite + React (TS)**: 响应式前端框架。
- **Design Tokens**: 在 `ui/src/index.css` 中定义的一套 CSS 变量主题系统。
- **Inspector Panel**: 右侧实时分析看板，展示 Session 元数据。
- **Growth Dashboard**: 使用 `recharts` 渲染的质量演进曲线。

## 3. 核心算法 (Core Logic)

### 3.1 表达进化教练 (Coach Module) 评分公式
评分 (0-100) = `100` - `(纠错次数 * 15)` - `(模糊词权重 * 10)` - `(长度扣分)` - `(上下文缺失扣分)`。

### 3.2 审计维度
- **Ambiguity Dictionary**: 识别“这个”、“那个”、“所有的”、“帮我”等模糊或口语化表达。
- **Context Detection**: 检测 Prompt 中是否包含路径、代码块或引用。

## 4. API 定义 (REST Endpoints)
- `GET /api/projects`: 获取项目列表。
- `GET /api/projects/:slug/sessions`: 获取项目下会话摘要。
- `GET /api/sessions/:id`: 获取完整会话详情（含消息、工具链、思考链）。
- `GET /api/stats/timeline`: 获取 30 天内的平均质量趋势数据。
