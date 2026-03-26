# 🚀 Gemini Chat Analyze & Evolver

[English](./README.md) | [中文版]

一个专为 Gemini CLI 设计的本地化、私有化会话审计与进化引擎。它能够实时监控您的 AI 交互记录，通过 **Coach Module** 提供提问质量反馈，并利用 SQLite 追踪不同模型在不同任务（Coding, Research, Ops 等）中的表现。

---

## ✨ 已实现功能 (Current Features)

### 1. 实时会话审计 (Real-time Auditing)

- **智能监听 (Watcher)**: 自动监控 `~/.gemini/tmp` 目录下的 JSON 变更，实现对话生成即解析。
- **深度解析 (Parser)**: 自动提取 Markdown 内容、工具调用链 (Tool Chain)、Token 消耗以及思维链 (Thoughts)。
- **项目感知 (Project-Centric)**: 自动识别 Gemini CLI 的项目归属，支持长哈希项目名的路径自动纠回。

### 2. 教练模块 (Coach Module)

- **提问质量评分**: 基于纠错频率、指令长度、模糊词过滤等维度进行 0-100 打分。
- **改进建议**: 针对“过度依赖代词”、“缺乏背景”等常见问题自动生成改进 Prompt 的建议。
- **任务分类**: 自动识别任务类型（Coding, Ops, Research, Arch, Learning, General）。

### 3. 数据中心与可视化 (Data & UI)

- **本地持久化**: 基于 SQLite 的高性能存储，严禁数据外流，保护隐私。
- **统计看板**:
  - **趋势分析**: 过去 30 天提问质量波动曲线。
  - **模型对比**: 统计不同模型（如 Pro vs Flash）的平均分、Token 效率及回合数。
- **技能导出**: 支持将高质量会话一键导出为 Gemini CLI 的 `.md` 技能文件。

---

## 📅 将来可能实现的功能 (Future Roadmap)

### 短期计划 (Short-term)

- [ ] **多会话对比**: 支持对比两次针对同一问题的不同模型回答，进行侧向 A/B 测试。
- [ ] **自定义评分规则**: 允许用户配置特定的关键词权重或自定义审计逻辑。
- [ ] **代码差异分析**: 深度集成 `replace` 逻辑，分析 AI 修改代码的准确率与回归风险。

### 中长期愿景 (Long-term)

- [ ] **智能重写引擎**: 利用本地轻量级模型自动将低分 Prompt 重写为高分结构化指令。
- [ ] **IDE 插件集成**: 直接在 VS Code 侧边栏查看当前文件的历史演进逻辑与 AI 建议。
- [ ] **团队知识库**: 提取高质量对话中的技术决策，自动生成项目技术文档（ADR）。
- [ ] **跨平台支持**: 支持 Ollama 等其他本地 LLM 运行框架的日志审计。

---

## 🏗️ 技术架构 (Architecture)

- **Backend**: Node.js + TypeScript + Express
- **Storage**: SQLite (`better-sqlite3`)
- **Runtime**: `tsx` (直接运行 TypeScript 源码)
- **Frontend**: React + Vite + Tailwind CSS
- **Monitor**: Chokidar (文件监听器)

---

## 🛠️ 快速开始 (Getting Started)

### 安装依赖

```bash
npm install
cd ui && npm install && cd ..
```

### 启动服务

```bash
# 同时启动后端监控、API Server 和前端界面
npm run dev
```

### 环境变量

- `WATCH_PATH`: 默认为 `~/.gemini/tmp`，可根据您的 Gemini CLI 配置进行修改。

---

## 🏛️ 目录结构说明

- `server/`: 后端核心逻辑。
  - `core/`: 解析器、监听器与管理器。
  - `api/`: RESTful 接口与服务器配置。
  - `db/`: SQLite 数据库封装。
- `ui/`: 基于 React 的可视化仪表盘。
- `docs/`: 详细的架构文档与设计指南。
