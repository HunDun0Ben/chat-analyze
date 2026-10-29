# ⚡ 同步策略与实时性保障 (Sync Strategy)

## 1. 架构演进 (Evolution)

系统从 **“数据库驱动 (DB-Driven)”** 演进为 **“文件系统优先 (FS-First)”** 模式。

## 2. 启动周期 (Boot Lifecycle)

1.  **Scan Phase**: 遍历所有 `watchPaths`（Gemini、ChatGPT 等）。`DiscoveryService` 只负责发现候选文件，不判断 provider；忽略规则与 watcher 共用。
2.  **Parse & Resolve Phase**: 启动 `SessionParser` 并发解析，由内容探测确定 `provider`；随后 `ProjectResolver` 按 provider 规则计算最终 `projectName`。
    - **隔离性**: 单个文件损坏或入库失败时只记录日志，不中断整个 Boot 流程。
3.  **Index Phase**:
    - 将结果存入内存 `Map`（核心 API 使用）。
    - 增量更新 SQLite 数据库（持久化检索使用）。

## 3. 实时性 (Real-time)

- **Watcher**: 实时监控文件变动，仅重析变动的文件（Incremental Re-parsing）。watcher 与启动扫描共用忽略规则和 `ProjectResolver`，因此同一会话的项目名不会因加载方式而改变。
- **Aggregation**: 所有聚合统计逻辑在内存中动态完成，避免 SQL 延迟。

## 4. 健壮性措施

- 启动时自动删除由于旧版本架构产生的脏 DB (`chat_analyze.db`)。
- 自动识别并标记 `provider` 字段。
