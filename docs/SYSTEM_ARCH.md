# 🏛️ 系统架构设计 (System Architecture)

## 1. 整体拓扑 (Top-level View)

项目采用 **Filesystem-First (文件系统优先)** 架构：磁盘文件是唯一事实来源，内存 `Map` 提供读模型。
SQLite schema 与 `SessionStorage` 保留，但默认关闭写入（`PERSISTENCE=off`），需要时用 `PERSISTENCE=sqlite` 开启：

`[Filesystem (~/.gemini/tmp)]` -> `[Server-Discovery]` -> `[Server-Parser Matrix]`
`[Memory Map Aggregator]` -> `[REST API]` -> `[UI (Dashboard / Inspector)]`

## 2. 核心模块与子文档 (Module Map)

### 📂 Backend (Server)

由 `server/` 提供核心分析引擎。详细实现文档见 `server/docs/`：

- [Discovery Service 实现](server/docs/DISCOVERY_SERVICE.md): 物理文件检索与项目归属算法。
- [Sync & Cache Strategy](server/docs/SYNC_STRATEGY.md): 高并发同步与内存聚合策略。
- [Coach Scoring Logic](server/docs/COACH_LOGIC.md): 详细评分权重与审计维度。

### 📂 Frontend (UI)

由 `ui/` 提供本地仪表盘。详细实现文档见 `ui/docs/`：

- [Theming & Styles](ui/docs/THEMING.md): CSS 变量与 Design Tokens。
- [Component Architecture](ui/docs/COMPONENT_LIBRARY.md): 核心 UI 组件说明。

## 3. 全局数据模型 (Shared Models)

前后端共用的类型与 API 响应 schema 位于 `shared/src/`（workspace 包 `@chat-analyze/shared`），
两份副本已删除。字段说明见 [DATA_STRUCTURE.md](docs/DATA_STRUCTURE.md)。

## 4. 全局任务与进度 (Roadmap)

查看 [TASKS.md](docs/TASKS.md) 了解整体迭代计划。
