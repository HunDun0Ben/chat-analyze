# 📊 数据结构与分析模型设计 - v1.3 (2026-10-30)

## 1. 核心模型 (Analyzed Session 分析会话)

系统已统一了不同 Provider（Gemini/ChatGPT）的数据接口。解析器会根据输入源（静态 JSON 或 JSONL 事件流）将其标准化为以下格式。

> 唯一的类型定义位于 `shared/src/session.ts`（workspace 包 `@chat-analyze/shared`），
> `server/` 与 `ui/` 都从该包导入，不再各自维护副本。

### 1.1 数据获取模式

- **静态模式 (Static JSON)**: 一次性载入完整会话快照。
- **流式/事件模式 (JSONL)**: 通过“事件回放”机制聚合。每一行代表一个原子事件（如消息发送、状态更新 `$set`），系统通过顺序解析这些事件，在内存中重构出完整的 `AnalyzedSession`。

### 1.2 标准化字段定义

```typescript
export interface AnalyzedSession {
  sessionId: string; // 会话ID
  projectName: string; // 项目名称
  provider: 'gemini' | 'chatgpt'; // 新增：来源标识
  modelId: string; // 对应的模型标识
  startTime: string; // ISO 时间戳
  lastUpdated: string; // 最后更新时间
  category: SessionCategory; // 自动分类结果

  // 表达质量分析 (Coach 模块)
  expressionQuality: {
    score: number; // 0-100 综合评分
    scoreable?: boolean; // 无用户提问时为 false，所有均分都会排除该会话
    ambiguities: string[]; // 识别出的模糊词汇
    suggestion: string; // 针对性改进建议
  };

  // 消息内容 (标准化)
  messages: Message[]; // type: 'user' | 'assistant' | 'system' | 'info'

  // 效率统计 (Stats 统计)
  stats: {
    turns: number; // = userTurns + assistantTurns（不含 system/info）
    totalMessages: number; // 全部消息数（含 system/info）
    userTurns: number; // 用户输入轮数
    assistantTurns: number; // 模型回复轮数（所有 Provider 统一）
    geminiTurns?: number; // @deprecated 保留一个版本，等于 assistantTurns
    corrections: number; // 纠错次数 (通过关键词与状态码识别)
    toolChain: string[]; // 工具链顺序轨迹 (仅 Gemini 支持)
    tokenUsage: {
      input: number;
      output: number;
      thoughts: number; // 思考链消耗 (Gemini 2.0+)
      total: number;
    };
  };
}
```

## 2. 存储设计 (Storage Schema 存储模式)

SQLite 数据库（默认 `server/chat_analyze.db`）的表结构镜像了上述核心字段，
但**默认不写库**：`PERSISTENCE=off` 时进程不会打开数据库文件，统计全部在内存中实时生成。
需要持久化时设置 `PERSISTENCE=sqlite`；表结构包含 `filePath` 列与对应索引，为将来的增量缓存预留。
