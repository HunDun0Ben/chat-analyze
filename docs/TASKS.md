#  Gemini Chat Analyze & Evolver - 开发任务清单

基于对 `README.md` 以及关联的 `REQUIREMENTS.md`、`DATA_STRUCTURE.md` 和 `PARSER_DEMO.ts` 文件的综合分析，这是一个专注于解析、分析和优化开发者与 Gemini CLI 交互行为的**“人机协作进化系统”**。

以下是详细开发任务清单，按模块与实施阶段进行了结构化划分：

## 阶段一：基础设施与数据解析底座 (Foundation & Data Parsing)
本阶段的核心是建立对 Gemini CLI 生成的本地历史数据的读取和结构化解析能力。

- [x] **任务 1.1: 核心解析引擎完善**
  - 基于 `PARSER_DEMO.ts`，完善 `SessionParser` 类，支持解析完整的 `.gemini/tmp/<project>/chats/session-*.json` 结构。
  - 实现从 `userMessages` 和 `geminiMessages` 中提取全量对话上下文、Thoughts (思考链) 和 Tool Calls (工具调用记录)。
- [x] **任务 1.2: 数据模型映射**
  - 按照 `DATA_STRUCTURE.md` 定义 `AnalyzedSession` 接口。
  - 实现原始 JSON 数据到 `AnalyzedSession` 对象的映射逻辑。
- [x] **任务 1.3: 文件系统监听与发现**
  - 实现对 `~/.gemini/projects.json` 的读取，建立项目路径与 Project Slug 的映射表。
  - 实现对 `~/.gemini/tmp/` 目录的监听机制 (File Watcher)，当有新的 session、logs 或 checkpoint 生成时，触发增量解析。
- [x] **任务 1.4: 离线存储与检索引擎**
  - 搭建本地轻量级数据库或内存检索库（如基于 SQLite 或直接内存索引），存储解析后的标准化数据。
  - 实现跨项目、跨会话的语义或关键字全量搜索接口。

## 阶段二：核心业务逻辑分析 (Core Analysis Logic)
本阶段专注于从结构化的会话数据中提取“行为模式”和“效率评估”指标。

- [x] **任务 2.1: 任务类型自动分类**
  - 完善 `detectCategory` 逻辑，支持基于工具特征的精细化分类：
    - `Coding`: 使用 `replace`, `write_file`, `apply_diff` 等。
    - `Ops`: 使用 `run_shell_command`, `gh` 等。
    - `Investigate`: 使用 `grep_search`, `glob`, `list_directory` 等。
    - `Research`: 使用 `web_fetch`, `google_web_search` 等。
    - `Arch`: 匹配 Prompt 中的架构/设计/模式关键字。
    - `Learning`: 匹配 Prompt 中的解释/原理/如何关键字。
- [x] **任务 2.2: 工具链轨迹识别**
  - 提取并规范化工具调用序列（例如 `grep` -> `read` -> `edit`），建立高频操作模式库。
  - 在 `AnalyzedSession` 中增加 `toolChain` 的顺序轨迹记录（按时间戳排序）。
- [x] **任务 2.3: 效率统计与纠错识别**
  - 扩展 `countCorrections` 逻辑，识别用户修正意图及工具调用失败 (status: 'error')。
  - 扩充纠错关键字库（增加：报错、重来、理解错了、fix、wrong、incorrect 等）。
  - 基于纠错次数动态调整 `expressionQuality.score`。
## 阶段三：前端展示与观测面板 (Frontend UI & Viewer)
构建一个现代化的、离线优先的 Web 可视化平台。

- [x] **任务 3.0: 前后端脚手架初始化**
- [x] **任务 3.1: 项目与会话导航树**
- [x] **任务 3.2: 富文本会话主视图**
- [x] **任务 3.3: 工具流与快照追踪 UI**
- [x] **任务 3.4: Tokenized UI 重构与 Inspector Panel**

## 阶段四：表达进化教练模块 (Expression Coach Module)
将系统从“查看器”升级为“提效教练”，帮助开发者提升 Prompt 质量。

- [x] **任务 4.1: 指令精准度审计**
  - [x] 实现模糊词词典与上下文缺失检测算法。
  - [x] 建立多维度评分权重体系 (`expressionQuality.score`)。
- [x] **任务 4.2: 语言艺术优化建议**
  - [x] 实现基于任务分类的结构化改写建议。
- [x] **任务 4.3: 成长曲线可视化**
  - [x] 后端支持时间轴评分统计 API。
  - [x] 前端 Dashboard 渲染 AreaChart (面积图) 展示进化趋势。

## 阶段五：模型与技能孵化模块 (Model Audit & Skill Evolution)
评估工具和模型效能，并实现工作流的自动化闭环。

- [ ] **任务 5.1: 多模型表现对比面板**
- [ ] **任务 5.2: Skill 孵化器 (一键导出)**
- [ ] **任务 5.3: Skill 健壮性监控**
- [ ] **任务 5.2: Skill 孵化器 (一键导出)**
  - 开发 UI 交互：允许用户在视图中选中一条“成功且高效”的完整对话路径/工具调用链。
  - 实现导出逻辑：将选中的路径提取为标准模板，生成 `SKILL.md` 文件并保存至本地 Skill 目录，实现高频操作的复用。
- [ ] **任务 5.3: Skill 健壮性监控**
  - 分析使用自定义 Skill 的会话，监控其失败率或陷入死循环的概率，提供优化或模型选型的建议。
