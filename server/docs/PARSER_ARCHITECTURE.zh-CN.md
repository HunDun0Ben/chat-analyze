# 🧩 解析器架构设计 (Parser Architecture)

## 1. 设计哲学

系统采用 **“插件化路由 (Pluggable Routing)”** 架构。核心目标是将不同来源、不同格式的原始会话数据，统一转化为标准化的 `AnalyzedSession` 模型。

## 2. 核心组件

### 2.1 `SessionParser` (总调度器)
- **职责**: 作为单一入口点，负责识别文件格式并将解析任务路由给对应的子解析器。
- **路由逻辑**: 
  - 优先根据文件扩展名（如 `.jsonl`）分发。
  - 其次根据 JSON 内部特征字段（如 `history`, `mapping`）进行动态探测。

### 2.2 `BaseParser` (解析基类)
- **职责**: 定义所有子解析器的共同契约，注入通用的审计辅助服务（如 `CoachService`）。
- **核心方法**: `analyze(data: unknown, options: ParserOptions): Promise<AnalyzedSession>`。

## 3. 解析策略分类

### 3.1 静态解析 (Static Parsing)
- **适用场景**: `.json` 格式的导出包（如 ChatGPT 导出、Gemini 历史快照）。
- **实现类**: `GeminiParser`, `ChatGPTParser`, `GeminiCheckpointParser`。
- **特点**: 一次性读取、内存解析、直接映射。

### 3.2 增量事件聚合 (Incremental Event Aggregation)
- **适用场景**: `.jsonl` 格式的实时记录文件。
- **实现类**: `GeminiJsonlParser`。
- **逻辑**:
  1. **流式读取**: 采用 Node.js `readline` 接口，降低内存占用。
  2. **事件回放**: 
     - 识别“元数据事件”（首行）初始化上下文。
     - 识别“状态更新事件”（如 `$set`）修正会话属性。
     - 识别“交互事件”（如 `user`, `gemini` 类型）累加消息链。
  3. **最终组装**: 聚合所有事件后，进行二次计算（如 `stats` 和 `expressionQuality`）。

## 4. 扩展指南

若需支持新的 Provider 或格式，请遵循以下步骤：
1. 在 `server/core/parsers/` 下继承 `BaseParser` 创建新解析器。
2. 实现 `analyze` 逻辑，确保输出符合 `AnalyzedSession` 接口。
3. 在 `server/core/parser.ts` 的 `SessionParser` 中注册该解析器的路由逻辑。
