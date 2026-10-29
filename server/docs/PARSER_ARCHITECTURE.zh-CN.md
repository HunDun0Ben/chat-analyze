# 🧩 解析器架构设计 (Parser Architecture)

## 1. 设计哲学

系统采用 **注册表路由 (Registry Routing)**：所有来源、所有格式的原始会话最终都转换为共享包中的 `AnalyzedSession`。

唯一的类型定义位于 `shared/src/session.ts`，`server` 与 `ui` 都从 `@chat-analyze/shared` 导入。

## 2. 核心组件

### 2.1 `SessionAnalyzer`（唯一入口）

- **文件**：`server/core/parsing/SessionAnalyzer.ts`
- **契约**：`analyze(filePath): Promise<ParseResult>`，其中 `ParseResult = { sessions, warnings }`
- **路由**：
  - `.jsonl` 扩展名 → `GeminiJsonlParser`
  - 其他 `.json` → 按 `PARSER_REGISTRATIONS` 顺序探测
  - JSON 数组（ChatGPT 批量导出）→ 逐条解析，单条失败只产生 warning
- **错误策略**：任何异常都被转换为 `warnings`，从不向调用方抛出

### 2.2 `registry.ts`（格式注册表）

- **文件**：`server/core/parsing/registry.ts`
- **顺序**：`chatgpt-export` → `gemini-checkpoint` → `gemini-session`，第一个 `canParse` 命中者胜出
- **探测**：只检查特征字段是否存在（`mapping` / `history` / `messages`），不做严格校验；具体字段错误由对应解析器给出可读信息

新增 provider 时，除了写解析器，只需在这里追加一条注册项，`SessionAnalyzer` 不需要修改。

### 2.3 `BaseParser`

- **契约**：`parse(source: SessionSource): Promise<ParserOutput>`
- `SessionSource` 统一了"静态 JSON"与"流式 JSONL"两种读取方式，解析器不关心文件如何打开
- 基类注入 `CoachService`，用于评分、纠错识别与分类

## 3. 解析策略分类

### 3.1 静态解析 (Static Parsing)

- **适用**：`.json` 导出包（ChatGPT 导出、Gemini 历史快照、Checkpoint）
- **实现**：`GeminiParser`、`ChatGPTParser`、`GeminiCheckpointParser`
- **特点**：一次性读取、内存解析、直接映射

### 3.2 增量事件聚合 (Incremental Event Aggregation)

- **适用**：`.jsonl` 实时记录
- **实现**：`GeminiJsonlParser`
- **逻辑**：
  1. **流式读取**：Node.js `readline`，降低内存占用
  2. **事件回放**：
     - 首行元数据初始化上下文
     - `$set` 只允许更新白名单字段（`lastUpdated` / `sessionTitle` / `modelId`）
     - `user` / `gemini` / `info` 事件累加消息链
  3. **最终组装**：统一计算 `stats` 与 `expressionQuality`

## 4. 角色与统计口径

- 输出消息角色固定为 `user | assistant | system | info`
- 输入格式中的 `gemini`（JSONL）与 `model`（Checkpoint）都映射为 `assistant`
- `turns = userTurns + assistantTurns`，由 `@chat-analyze/shared` 的 `turnStats()` 唯一计算，所有解析器共用
- `system` / `info` 只计入 `totalMessages`，不计入 `turns`

## 5. 与 Discovery / ProjectResolver 的边界

- `DiscoveryService` 只负责发现候选文件，**不判断** provider
- `SessionAnalyzer` 负责识别 provider 并完成解析
- `ProjectResolver` 在解析后按 provider 计算最终 `projectName`；启动扫描与 watcher 共用同一入口
- 新增 provider 时，除解析器与注册表外，还需同步添加命名规则与占位名规则（见 `server/docs/DISCOVERY_SERVICE.zh-CN.md`）

## 6. 扩展指南

1. 在 `server/core/parsers/` 下继承 `BaseParser` 创建新解析器。
2. 在 `server/core/parsers/schemas.ts` 中定义输入 schema，并让解析器使用 `safeParse`。
3. 在 `server/core/parsing/registry.ts` 中追加注册项（`format` / `canParse` / `create`）。
4. 在 `server/core/services/ProjectResolver.ts` 中注册 provider 的项目名解析与占位名规则。
5. 在 `server/__tests__/` 中补充格式探测、角色映射与 `turns` 一致性测试。
