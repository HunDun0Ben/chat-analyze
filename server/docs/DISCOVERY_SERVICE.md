# 🔍 Discovery Service 实现详解

## 1. 背景 (Context)
由于 Gemini CLI 的会话文件散落在 `~/.gemini/tmp/` 的各个子目录中，且项目结构可能存在嵌套（Nested），简单的目录名提取已无法满足需求。

## 2. 识别策略 (Resolution Strategy)
`DiscoveryService.resolveProjectName` 采用以下优先级进行异步溯源：

1.  **显式标记 (`.project_root`)**：
    - 从 `session-*.json` 所在目录向上递归查找，直到发现 `.project_root` 空文件。
    - 取包含该标记文件的目录名作为 `Project Name`。
2.  **配置文件 (`projects.json`)**：
    - 检查 `~/.gemini/projects.json` 中的 Slug 映射。
3.  **目录回退 (Fallback)**：
    - 如果上两项均未命中，则取 `session-*.json` 的父目录名。

## 3. 并发处理 (Concurrency)
- 使用 `p-limit` 或 `Promise.all` 处理数百个文件的溯源。
- 内部包含 `memoization` 机制，确保同一目录在一次 Boot 过程中仅被磁盘扫描一次。
