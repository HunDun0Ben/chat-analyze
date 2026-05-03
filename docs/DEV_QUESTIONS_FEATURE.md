# 开发文档: My Questions 功能实现指南

## 1. 架构设计

"My Questions" 功能遵循后端数据处理、前端多维筛选的设计模式。

### 数据流向

1.  `SessionManager` 从本地 JSONL/Checkpoint 文件加载会话。
2.  `server/api/server.ts` 对内存中的会话进行二次投影，仅保留用户提问信息。
3.  前端 `QuestionsView.tsx` 负责状态管理与导出逻辑。

## 2. 后端 API 规范

### 2.1 获取提问列表

- **Endpoint**: `GET /api/user-questions`
- **Query Parameters**:
  - `project` (string): 项目名。
  - `minScore` (number): 最小表达分。
  - `maxScore` (number): 最大表达分。
  - `limit` (number): 分页限制。
  - `offset` (number): 分页偏移。
- **Headers**:
  - `Accept: application/json`: 返回结构化 JSON。
  - `Accept: text/plain`: 返回格式化后的 Markdown。

### 2.2 项目统计概览

- **Endpoint**: `GET /api/user-questions/stats`
- **Returns**: `ProjectStat[]` (包含提问总数、平均分等)。

## 3. 前端实现细节

### 3.1 类型定义 (`ui/src/types.ts`)

```typescript
export interface UserQuestionsSession {
  sessionId: string;
  projectName: string;
  sessionTitle?: string;
  startTime: string;
  questions: string[];
}
```

### 3.2 复制导出逻辑

导出逻辑直接在前端完成，以减轻服务器压力并支持实时筛选结果导出：

```typescript
const copyToClipboard = () => {
  const markdown = filteredData
    .map((s) => {
      return `### Session: ${s.sessionTitle}\n${s.questions.map((q) => `- ${q}`).join('\n')}`;
    })
    .join('\n\n');
  navigator.clipboard.writeText(markdown);
};
```

## 4. 扩展建议

- **情感分析集成**：未来可以增加对用户提问时的情绪（焦躁、困惑、明确）进行标注。
- **自动化总结**：集成一个本地轻量级模型（如 Ollama），直接在后端生成提问缺陷报告。
- **导出模板**：支持用户自定义导出格式（如 CSV, JSONL）。
