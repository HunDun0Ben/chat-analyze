# ⚡ 同步策略与实时性保障 (Sync Strategy)

## 1. 架构演进 (Evolution)

系统从 **“数据库驱动 (DB-Driven)”** 演进为 **“文件系统优先 (FS-First)”** 模式。

## 2. 启动周期 (Boot Lifecycle)

1.  **Scan Phase**: 遍历 `~/.gemini/tmp` 和其他 provider 路径。
2.  **Resolve Phase**: 调用 `DiscoveryService` 确定所有文件的项目归属。
3.  **Parallel Parse**: 启动 `SessionParser` 并发矩阵。
    - **隔离性**: 某个文件损坏时，通过内部 `try-catch` 捕获，不中断整个 Boot 流程。
4.  **Index Phase**:
    - 将结果存入内存 `Map`（核心 API 使用）。
    - 增量更新 SQLite 数据库（持久化检索使用）。

## 3. 实时性 (Real-time)

- **Watcher**: 实时监控文件变动，仅重析变动的文件（Incremental Re-parsing）。
- **Aggregation**: 所有聚合统计逻辑在内存中动态完成，避免 SQL 延迟。

## 4. 健壮性措施

- 启动时自动删除由于旧版本架构产生的脏 DB (`chat_analyze.db`)。
- 自动识别并标记 `provider` 字段。
