# 📊 数据结构与分析模型设计

## 1. 原始数据源 (Raw Data Sources)
系统需监听并解析以下路径：
- `~/.gemini/tmp/<project>/chats/session-*.json`: 会话详情、Token 消耗、工具调用。
- `~/.gemini/tmp/<project>/logs.json`: 全量用户输入历史。
- `~/.gemini/tmp/<project>/checkpoint-*.json`: 状态快照。
- `~/.gemini/projects.json`: 项目路径与 Slug 映射表。

## 2. 核心分析模型 (Analyzed Schema)
解析器应将原始 JSON 转换为以下可分析模型：

```typescript
interface AnalyzedSession {
  sessionId: string;
  projectName: string;
  modelId: string;       // 使用的模型 (如 gemini-1.5-pro)
  category: 'Coding' | 'Learning' | 'Ops' | 'Arch'; // 自动分类
  
  // 表达质量分析 (Coach 模块)
  expressionQuality: {
    score: number;       // 0-100 评分
    ambiguities: string[]; // 发现的模糊点
    suggestion: string;  // 改写建议
  };

  // 效率统计
  stats: {
    turns: number;        // 对话轮数
    corrections: number;  // 纠错循环次数
    toolChain: string[];  // 轨迹：如 ['grep_search', 'read_file', 'replace']
  };
  
  isStudyMode: boolean; // 是否为学习/代码阅读模式
}
```

## 3. 分类逻辑 (Classification Logic)
- **Coding**: 涉及 `replace` 工具或包含“优化”、“重构”、“实现”等动词。
- **Learning**: 包含“解释”、“原理”、“如何理解”或工具链中仅有读操作。
