# Gemini Chat Analyze - Code Review Feedback

## 1. 🐛 严重 Bug：数据库插入参数错位

在 `src/storage.ts` 的 `saveSession` 方法中，`INSERT` 语句对应 `modelId` 的位置传入了 `session.projectHash`。这将导致数据库中保存的 `modelId` 数据错误（变成 Hash 值）。

**建议修复 (`src/storage.ts`)：**

```typescript
stmt.run(
  session.sessionId,
  session.projectName,
  -session.projectHash, // Use hash if name is not available
  +session.modelId, // <--- 修复此处
  session.category,
  session.startTime,
  session.lastUpdated,
  session.expressionQuality.score,
  session.stats.turns,
  session.stats.tokenUsage.total,
  JSON.stringify(session),
);
```

## 2. ⚡ 性能优化：`Token` 统计的时间复杂度 (O(N²))

在 `src/parser.ts` 的 `tokenUsage` 统计中，对于每一条 `geminiMsgs`，都在整个 `session.messages` 数组里执行了 `find` 查找。如果会话记录很长，这里的时间复杂度是 O(N²)。

**建议优化 (`src/parser.ts`)：**
与其事后二次查找，不如直接对原始数据进行一次 `reduce` 遍历：

```typescript
// 聚合 Token 消耗 (优化为 O(N))
const tokenUsage = session.messages.reduce(
  (acc: any, m: any) => {
    if (m.type === 'gemini' && m.tokens) {
      acc.input += m.tokens.input || 0;
      acc.output += m.tokens.output || 0;
      acc.thoughts += m.tokens.thoughts || 0;
      acc.total += m.tokens.total || 0;
    }
    return acc;
  },
  { input: 0, output: 0, thoughts: 0, total: 0 },
);
```

## 3. 🛡️ 鲁棒性建议：处理未知的对象格式

在 `src/parser.ts` 中，`extractContent` 有时候面临着结构未知的 `any` 类型。建议加强 fallback 机制。

**建议改进 (`src/parser.ts`)：**

```typescript
  private extractContent(content: any): string {
    if (!content) return "";
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(c => c.text || "").join("");
    }
    // 有些 API 可能会直接把 content 作为一个带 text 字段的对象返回
    if (typeof content === 'object' && content.text) return content.text;

    return "";
  }
```

## 4. 🔍 业务逻辑完善：空对话的边界处理

在 `src/parser.ts` 中，如果 `userMsgs.length === 0`，`firstPrompt` 为空字符串。这会导致 `calculateQualityScore` 默认扣除 10 分。建议增加对初始化对话（无用户输入）的特殊判定。

## 5. 🏗️ 代码规范/依赖引入提示

- `better-sqlite3` 是原生编译模块，跨平台分发时需注意处理 `.node` 文件。
- `src/index.ts` 中的 `process.exit(0)` 之前可以给 `watcher.stop()` 加上 `try...catch` 以增强稳定性。
