# 架构说明 (Architecture)

## 1. 数据流 (Data Flow)
1. **Watcher** (`src/watcher.ts`): 监听 `.gemini/tmp/` 目录。
2. **Parser** (`src/parser.ts`): 会话解析、任务分类、质量评分、Token 聚合。
3. **Storage** (`src/storage.ts`): SQLite 持久化、查询。

## 2. 核心模块关系
[File System (session-*.json)] -> [ChatWatcher] -> [SessionParser] -> [SessionStorage] -> [chat_analyze.db]

## 3. 关键逻辑
- **任务分类**: 基于工具链行为（如 `replace` => `Coding`）和 Prompt 正则匹配。
- **质量评分**: 100 分制，根据纠错次数 (regex) 和 Prompt 长度进行扣分。
- **性能优化**: Token 聚合采用 O(N) 的单次循环算法。
