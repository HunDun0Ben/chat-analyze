# 🔍 Discovery 与项目名解析 (Discovery & Project Resolution)

## 1. 背景 (Context)

会话文件可能来自多个 Provider（Gemini CLI、ChatGPT 导出，以及未来的工具），并且可能散落在任意目录。系统把职责拆成两层：

1. **发现 (Discovery)**：在配置的监听路径下查找候选会话文件。这一层**与 Provider 无关**。
2. **项目名解析 (Project Resolution)**：为已解析的会话确定项目归属。这一层**与 Provider 相关**。

```
watchPaths ──► DiscoveryService ──► SessionAnalyzer ──► ProjectResolver
                (只发现文件)        (识别 provider)    (最终 projectName)
```

`SessionManager` 的启动全量扫描 (`init`) 与 watcher 的单文件更新 (`upsertFromFile`) 使用完全相同的流程，因此同一个会话无论通过哪种方式加载，项目名都一致。

## 2. 扫描策略 (`DiscoveryService.scan`)

1. 按顺序遍历每一个 `watchPath`。
2. 收集会话文件：
   - 直接位于监听根目录下的文件；
   - 所有非忽略子目录中的文件（递归）。
3. 只考虑 `.json` 与 `.jsonl`，并跳过保留配置文件（见 §4）。
4. 结果按绝对路径去重（允许多个监听路径相互重叠），并排序以保证输出稳定。
5. 某个监听路径或子目录读取失败时只记录日志，不会中断其余路径。

`DiscoveryResult` 只包含 `filePath` 与 `watchRoot`。这一层不做任何项目名推断；最终名称由解析后的 `ProjectResolver` 产生。

## 3. 项目名解析 (`ProjectResolver`)

只有当解析器给出的是「占位名」时才会重新解析；否则保留解析器提供的名称（例如 Gemini 会话内部记录的项目名）。

| Provider  | 根目录文件       | 嵌套文件                                                     | 标记文件                                                          |
| --------- | ---------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `gemini`  | `Imported`       | 监听根下第一层目录；`chats/<project>/...` 解析为 `<project>` | 向上查找 `.project_root` 或 `projects.json`，包含标记的目录名优先 |
| `chatgpt` | `ChatGPT Import` | 监听根下第一层目录                                           | 无                                                                |
| 其他      | `Imported`       | 监听根下第一层目录                                           | 无                                                                |

补充规则：

- 使用**最长匹配**的监听根，避免 `/data/end` 误匹配 `/data/end2`。
- 不在任何监听路径内的文件解析为 `Unknown`。
- 占位名判断位于 `ProjectResolver.isPlaceholder`，按 Provider 区分（例如 Gemini 的 64 位项目 hash）。

## 4. 忽略规则 (Ignored Entries)

忽略规则统一定义在 `server/core/services/discovery/ignored.ts`，由 `DiscoveryService` 与 `ChatWatcher` 共用。

- **忽略目录**：`node_modules`、`.git`、`exports`、`dist`、`build`、`logs`、`community-plugins`、`.obsidian`、`.trash`。
- **忽略文件**：`package.json`、`package-lock.json`、`tsconfig.json`、`projects.json`、`vitest.config.ts`、`community-plugins.json`。

忽略 `.obsidian` 与 `.trash` 是因为导出目录中常包含 Obsidian 配置文件，`.trash` 中还可能有损坏文件，它们都不是会话。

## 5. 扩展新 Provider

1. 在 `server/core/parsers/` 下新增解析器，并在 `server/core/parsing/registry.ts` 的 `PARSER_REGISTRATIONS` 中追加注册项。
2. 在 `server/core/services/discovery/projectNaming.ts` 中新增命名函数。
3. 在 `ProjectResolver.resolve` 中接入该 Provider，并在 `ProjectResolver.isPlaceholder` 中补充占位规则。
4. 为解析器、命名规则以及「启动扫描 / watcher 一致性」补充测试。
