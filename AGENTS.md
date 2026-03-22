# Gemini Chat Analyze & Evolver - Agent Mandates

**使用中文回复**
**使用 `gh` 完成对github的操作. `gh` 的版本为: gh version 2.45.0 (2025-07-18 Ubuntu 2.45.0-1ubuntu0.3)**
**认真工作, 会减少你的工作时长**

## 1. 核心工程标准 (Core Standards)
- **离线首位 (Offline First)**: 禁止将用户对话数据、Token 消耗、或分析结果上传到任何第三方服务（GitHub 除外，且需脱敏）。
- **运行环境**: 使用 `tsx` 直接运行 TypeScript 源代码进行测试与调试。
- **存储规范**: 所有持久化必须经过 `server/db/storage.ts` (SQLite)，严禁使用纯文本作为主存储。

## 2. 代码开发准则 (Coding Guidelines)
- **Token 效率**: 在处理 `session.messages` 这种大数组时，严禁使用 O(N²) 的嵌套查询（如在 `map` 里执行 `find`），必须优先使用 `reduce` 或预处理 Map 进行 O(N) 聚合。
- **鲁棒性**: `SessionParser.extractContent` 必须能处理 `string`、`Array<{text: string}>` 以及直接带 `text` 字段的对象。
- **影子模式**: `ChatWatcher` 必须静默运行，不得阻塞 Gemini CLI 本身的交互逻辑。

## 3. 任务驱动流程 (Workflow)
- 任何功能变更必须同步更新 `docs/TASKS.md` 中的状态。
- 如果引入了新的数据结构，必须在 `docs/DATA_STRUCTURE.md` 中定义 Schema。
