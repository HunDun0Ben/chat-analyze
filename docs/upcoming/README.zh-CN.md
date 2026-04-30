# 🚀 待开发功能与需求池 (Upcoming Features and Requirement Pool)

本文件夹专门用于存放待开发功能的详细设计文档、原型构思及技术预研。

## 1. Skill 孵化器 (Skill Incubator 技能孵化器)

**目标**：将优秀的对话路径一键导出为 `SKILL.md` (技能文档) 模板。

- [ ] UI (用户界面) 支持选中多条 Message (消息)。
- [ ] 后端通过 `CoachService` (教练服务) 生成格式化的 Markdown。
- [ ] 支持保存到指定的 `.gemini/skills/` 目录。

## 2. 深度模型对比 (IQ Comparison 智能对比)

**目标**：量化分析不同模型（如 Gemini 1.5 Pro vs GPT-4o）在同一领域的表现。

- [ ] 按照 `category` (Coding/Ops/Arch 编码/运维/架构) 聚合统计模型评分。
- [ ] 图表化展示各模型在不同维度的优势（如：逻辑严密性 vs 响应速度）。

## 3. 语义化跨项目搜索 (Semantic Search 语义搜索)

**目标**：解决项目增多后难以找回历史知识的问题。

- [ ] 后端集成本地索引库（如 `FlexSearch` 或简单的 `bm25`）。
- [ ] 支持搜索消息文本、工具参数及思考链内容。

## 4. 离线 Skill 版本监控 (Offline Skill Version Monitoring)

**目标**：当 Skill (技能) 的提示词版本更新时，评估历史会话的“健康度”，看是否需要基于新版 Skill 重跑任务。
