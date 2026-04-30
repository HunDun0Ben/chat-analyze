# ⚡ 同步策略与实时性保障 (Synchronization Strategy and Real-time Guarantee)

## 1. 架构演进 (Architecture Evolution)

系统从 **“数据库驱动 (DB-Driven)”** 演进为 **“文件系统优先 (FS-First)”** 模式。

## 2. 启动周期 (Boot Lifecycle 启动生命周期)

1.  **Scan Phase (扫描阶段)**: 遍历 `~/.gemini/tmp` 和其他 provider (提供者) 路径。支持 `.json` 和 `.jsonl` (JSON Lines) 格式。
2.  **Resolve Phase (解析阶段)**: 调用 `DiscoveryService` (发现服务) 确定所有文件的项目归属。
3.  **Parallel Parse (并行解析)**: 启动 `SessionParser` (会话解析器) 并发矩阵。
    - **多格式支持**: 自动根据文件扩展名路由至静态解析器或事件流解析器。
    - **隔离性**: 某个文件损坏时，通过内部 `try-catch` 捕获，不中断整个 Boot (启动) 流程。
4.  **Index Phase (索引阶段)**:
    - 将结果存入内存 `Map` (核心 API 使用)。
    - 增量更新 SQLite 数据库（持久化检索使用）。

## 3. 实时性 (Real-time 实时性)

- **Watcher (监视器)**: 使用 `chokidar` 实时监控文件变动（包含 `*.(json|jsonl)`），仅重析变动的文件（Incremental Re-parsing 增量重新解析）。
- **Aggregation (聚合)**: 所有聚合统计逻辑在内存中动态完成，避免 SQL 延迟。

## 4. 健壮性措施 (Robustness Measures)

- 启动时自动删除由于旧版本架构产生的脏 DB (`chat_analyze.db`)。
- 自动识别并标记 `provider` 字段。
