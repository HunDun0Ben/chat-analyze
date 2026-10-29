# ⚡ 同步策略与实时性保障 (Sync Strategy)

## 1. 架构 (Architecture)

系统是 **文件系统优先 (FS-First)**：磁盘上的会话文件是唯一事实来源，内存 `Map` 是读模型。

SQLite 的 schema 与 `SessionStorage` 实现**保留**，但默认关闭写入：

- `PERSISTENCE=off`（默认）：进程不打开数据库文件，不产生任何写入
- `PERSISTENCE=sqlite`：恢复写入，调用方无需改动
- 跨重启的增量缓存尚未实现，当前只有进程内增量

## 2. 启动周期 (Boot Lifecycle)

1. **Scan Phase**：遍历所有 `watchPaths`。`DiscoveryService` 只发现候选文件（`.json` / `.jsonl`），不判断 provider；忽略规则与 watcher 共用。
2. **Parse Phase**：`SessionAnalyzer`（`server/core/parsing/SessionAnalyzer.ts`）并发解析，上限 `MAX_CONCURRENT_PARSES = 8`。
   - 格式通过 `core/parsing/registry.ts` 的 `PARSER_REGISTRATIONS` 探测；`.jsonl` 固定走事件流解析器。
   - 单个文件损坏只产生 `ParseWarning`，不中断整个启动流程。
3. **Resolve Phase**：`SessionManager` 对占位项目名调用 `ProjectResolver`，启动扫描与 watcher 共用同一入口。
4. **Index Phase**：结果写入内存 `Map`，并维护 `filePath → sessionIds` 索引。默认**不写数据库**。

## 3. 实时性 (Real-time)

- **Watcher**：`chokidar` 监控 `*.json` / `*.jsonl`
  - `add` / `change` → `manager.upsertFromFile()`（按文件替换旧会话）
  - `unlink` → `manager.removeByPath()`（内存、指纹、启用时的数据库同步清理）
- **增量**：进程内用 `(mtimeMs, size)` 指纹跳过未变化文件；首次启动仍会解析全部文件。
- **Aggregation**：所有统计在内存中由 `StatsService` 完成，没有 SQL 延迟。

## 4. 关闭 (Shutdown)

`SIGINT` / `SIGTERM` 触发统一关闭流程（`server/lifecycle.ts`）：

```
watcher.stop() → http server.close() → storage.close()（仅 PERSISTENCE=sqlite）
```

- 任一步失败仍继续关闭后续组件，最终以 1 退出
- 10 秒未完成则记录日志并强制退出
- 多次信号幂等

## 5. 健壮性措施 (Robustness)

- **不会删除**用户已有的数据库文件；旧的 `chat_analyze.db` 可以保留不动。
- 单文件解析失败只记录 warning，不影响其他文件。
- 解析结果保持确定性：缺少时间戳时回退到文件 `mtime`，消息 id 使用稳定哈希，而不是 `Date.now()`。
- 删除文件后不会再留下幽灵会话。
