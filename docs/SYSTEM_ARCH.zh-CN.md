# 🏛️ 系统架构设计 (System Architecture Design)

## 1. 整体拓扑 (Top-level View 顶层视图)

项目采用 **Filesystem-First (文件系统优先)** 架构，数据库作为二级索引缓存，确保数据的绝对实时性：

`[Filesystem (~/.gemini/tmp)]` -> `[Server-Discovery 服务器发现服务]` -> `[Server-Parser Matrix 服务器解析器矩阵]`
`[Memory Map Aggregator 内存映射聚合器]` -> `[REST API RESTful API接口]` -> `[UI (Dashboard 仪表盘 / Inspector 检查器)]`

## 2. 核心模块与子文档 (Module Map 模块图)

### 📂 Backend (Server 后端)

由 `server/` 提供核心分析引擎。详细实现文档见 `server/docs/`：

- [Discovery Service 实现](server/docs/DISCOVERY_SERVICE.md): 物理文件检索与项目归属算法。
- [Parser Architecture 解析器架构](server/docs/PARSER_ARCHITECTURE.zh-CN.md): 插件化解析矩阵与事件聚合设计。
- [Sync & Cache Strategy 同步与缓存策略](server/docs/SYNC_STRATEGY.md): 高并发同步与内存聚合策略。
- [Coach Scoring Logic 教练评分逻辑](server/docs/COACH_LOGIC.md): 详细评分权重与审计维度。

### 📂 Frontend (UI 前端)

由 `ui/` 提供本地仪表盘。详细实现文档见 `ui/docs/`：

- [Theming & Styles 主题与样式](ui/docs/THEMING.md): CSS 变量与 Design Tokens (设计令牌)。
- [Component Architecture 组件架构](ui/docs/COMPONENT_LIBRARY.md): 核心 UI 组件说明。

## 3. 全局数据模型 (Shared Models 共享模型)

所有前后端共用的 TypeScript 接口定义均记录在 [DATA_STRUCTURE.md](docs/DATA_STRUCTURE.md)。

## 4. 全局任务与进度 (Roadmap 路线图)

查看 [TASKS.md](docs/TASKS.md) 了解整体迭代计划。
