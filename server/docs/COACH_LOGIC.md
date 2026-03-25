# 🧠 Coach 模块：评分逻辑与审计维度 (Scoring Logic)

## 1. 评分权重 (Weights)
系统对用户提问（Prompt）的质量采取 **“扣分制 (Penalty System)”**，基础分 100：

- **纠错扣分 (`-15 / turn`)**：识别关键词（`fix`, `wrong`, `error`, `不是这样`, `重新` 等）。
- **模糊词扣分 (`-10 / word`)**：识别口语化代词（`这个`, `那个`, `这里`, `所有这些`）。
- **上下文缺失 (`-10`)**：识别消息中没有包含路径、代码块或引用等实体的提问。
- **对话冗余 (`-5`)**：轮数超过一定比例时触发。

## 2. 差异化审计 (Parser Variance)
- **GeminiParser**: 支持 **ToolChain (工具链)** 审计。扣除重复或无效的工具调用（如：连续 `grep_search` 同一关键词）。
- **ChatGPTParser**: 重点关注 **转折词 (Transitions)** 审计，用于分析长对话中的逻辑断层。

## 3. 改进建议 (Suggestions)
Coach 模块会根据 `category` (Coding/Arch/Ops) 提供针对性建议：
- **Coding**: 建议加入具体文件路径。
- **Arch**: 建议提供明确的设计模式名称。
- **Research**: 建议增加搜索广度约束。
