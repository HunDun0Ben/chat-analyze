# 📊 数据结构与分析模型设计 - v1.2 (2026-03-25)

## 1. 核心模型 (Analyzed Session)

系统已统一了不同 Provider（Gemini/ChatGPT）的数据接口，解析器会将其标准化为以下格式：

```typescript
export interface AnalyzedSession {
  sessionId: string;
  projectName: string;
  provider: 'gemini' | 'chatgpt'; // 新增：来源标识
  modelId: string; // 对应的模型标识
  startTime: string; // ISO 时间戳
  lastUpdated: string;
  category: SessionCategory; // 自动分类结果

  // 表达质量分析 (Coach 模块)
  expressionQuality: {
    score: number; // 0-100 综合评分
    ambiguities: string[]; // 识别出的模糊词汇
    suggestion: string; // 针对性改进建议
  };

  // 消息内容 (标准化)
  messages: Message[]; // 包含 User/Gemini/System/Tool/Thought 消息类型

  // 效率统计 (Stats)
  stats: {
    turns: number; // 总轮数
    userTurns: number; // 用户输入轮数
    geminiTurns: number; // 模型回复轮数
    corrections: number; // 纠错次数 (通过关键词与状态码识别)
    toolChain: string[]; // 顺序轨迹 (仅 Gemini 支持)
    tokenUsage: {
      input: number;
      output: number;
      thoughts: number; // 思考链消耗 (Gemini 2.0+)
      total: number;
    };
  };
}
```

## 2. 存储设计 (Storage Schema)

SQLite 数据库（`chat_analyze.db`）表结构镜像了上述核心字段，以加速全文检索与特定条件查询。统计汇总则在内存中实时生成。
