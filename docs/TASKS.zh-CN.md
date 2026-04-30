# Gemini Chat Analyze & Evolver - 任务追踪清单 (Task Tracking List) (2026-03-25)

## 阶段一：架构重构与多供应商支持 (Architecture Refactoring & Multi-Vendor Support) (DONE 已完成)

- [x] **任务 1.1: 解析器解耦 (Strategy Pattern 策略模式)**
  - 引入 `BaseParser` (基础解析器), `GeminiParser` (Gemini 解析器), `ChatGPTParser` (ChatGPT 解析器)。
- [x] **任务 1.2: 项目自动发现服务 (Project Auto-Discovery Service)**
  - 开发 `DiscoveryService` (发现服务)，支持 `.project_root` 及 `projects.json` 自动标记。
- [x] **任务 1.3: 文件系统优先同步 (Filesystem-First Synchronization)**
  - 弃用单一数据库作为数据源，改为启动时全量物理扫描，实现毫秒级内存索引。
- [x] **任务 1.4: UI 导航重构 (UI Navigation Refactoring)**
  - 侧边栏支持按 Provider (Gemini/ChatGPT 供应商) 切换视图。

## 阶段二：系统稳定性与性能优化 (System Stability & Performance Optimization) (DONE 已完成)

- [x] **任务 2.1: 内存统计聚合 (In-memory Statistics Aggregation)**
  - 将 API 统计逻辑从 SQL 查询迁移至内存 Map-Reduce，解决数据库冷启动报错。
- [x] **任务 2.2: 前端防御性加固 (Frontend Defensive Hardening)**
  - Dashboard (仪表盘) 增加数组校验，解决 `models.map is not a function` 崩溃。
- [x] **任务 2.3: 侧边栏 UI 精准化 (Sidebar UI Refinement)**
  - 重构 `SessionLink`：突出首条指令内容，优化 ID 与日期布局。

## 阶段三：未来规划 (Future Plan) (TODO 待办)

- [ ] **任务 3.1: Skill 孵化与导出 (Skill Incubation & Export)**
  - 能够将选中的高质量会话轨迹一键转化为 `SKILL.md` (技能文档)。
- [ ] **任务 3.2: 多模型表现横向对比 (IQ Comparison 多模型智能对比)**
  - 基于现有数据，提供同一任务在 Pro vs Flash 模型下的性能分析图表。
- [ ] **任务 3.3: 语义化会话搜索 (Semantic Session Search)**
  - 引入轻量级向量检索（或简单的本地分词索引）进行跨项目搜索。
