# LLM-Native 分析指南: 自动化提复盘流程

本指南介绍如何通过命令行和 API 管道实现“零人工交互”的提问模式复盘。该流程完全跳过浏览器，直接将结构化数据喂给 LLM。

---

## 1. 快速开始：一键生成分析 Prompt

我们为 API 添加了 `format=prompt` 模式。运行以下命令，即可获得一段可以直接粘贴给 LLM（或者通过管道发送）的完整分析请求：

```bash
# 获取特定项目 redis 的最近 10 组提问，并自动附带分析指令
curl -s "http://localhost:3001/api/user-questions?project=redis&limit=10&format=prompt"
```

### 命令说明

- `project=xxx`: 锁定分析维度，避免跨项目干扰。
- `limit=10`: 控制上下文长度，防止 LLM 内存溢出。
- `format=prompt`: **关键参数**。它会自动在数据前后加上专家级的分析指令，无需您手动编写提示词。

---

## 2. 自动化管道：实现“数据 -> 诊断”闭环

如果您本地安装了命令行 LLM 工具（如 `gemini-cli`），您可以实现全自动复盘：

```bash
# 全自动工作流示例
curl -s "http://localhost:3001/api/user-questions?project=my-app&limit=5&format=prompt" | gemini-ask
```

---

## 3. 分阶段深度诊断协议 (CLI 模式)

当数据量极大时，建议采用以下命令行交互协议：

### 阶段 A：数据取样

获取当前项目的提问概览：

```bash
curl -s "http://localhost:3001/api/user-questions/stats"
```

### 阶段 B：分批诊断

针对统计中发现的“重灾区”项目，分批提取：

```bash
# 第一批：提取最早的提问
curl -s "http://localhost:3001/api/user-questions?project=redis&limit=10&offset=0&format=prompt"

# 第二批：提取后续提问，观察改进情况
curl -s "http://localhost:3001/api/user-questions?project=redis&limit=10&offset=10&format=prompt"
```

---

## 4. 接口协议摘要 (LLM 友好型)

| 场景           | 推荐命令                              | 返回格式                       |
| :------------- | :------------------------------------ | :----------------------------- |
| **纯数据抓取** | `curl -H "Accept: text/plain" ...`    | 结构化 Markdown                |
| **即时分析**   | `curl "...?format=prompt"`            | 完整 Prompt (含指令 + 数据)    |
| **项目画像**   | `curl ".../api/user-questions/stats"` | 用于决定分析优先级的 JSON 统计 |

---

## 注意事项

- **Prompt 自定义**: 如果您想修改默认的分析指令，可以修改 `server/api/server.ts` 中的 `promptHeader` 定义。
- **无感复盘**: 建议将此类命令配置为 `alias` 或 git hook，实现真正的无感沟通进化。
