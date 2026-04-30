# Gemini CLI 会话文件解析指南

本指南旨在详细解释 Gemini CLI 会话记录服务（`ChatRecordingService`）的工作原理，其中涉及的文件、服务流程以及会话数据在 `.jsonl` 文件中的存储结构。最终目标是提供足够的信息，使任何开发者都能够构建一个独立的会话文件解析程序。

## 1. 核心文件及其功能

以下是与会话记录和解析功能紧密相关的几个文件：

- **`packages/core/src/services/chatRecordingService.ts`**:
  - **功能**: 这是会话记录的核心服务。它的主要职责是**实时记录**用户输入、AI 响应（包括思考过程和工具调用）以及其他系统信息，并将这些事件逐行写入 `.jsonl` 会话文件。它负责管理会话的生命周期，例如启动新会话或准备继续现有会话的记录。
  - **在解析中的作用**: 虽然它主要是写入方，但其内部必然包含读取和重构会话的逻辑（例如在会话恢复时）。了解其如何组织写入内容对于反向解析至关重要。

- **`packages/core/src/config/storage.ts`**:
  - **功能**: 这是一个通用的文件系统存储抽象层。它负责处理文件和目录的路径管理、创建以及基本的读写操作。
  - **在解析中的作用**:
    - `getProjectTempDir()`: 确定项目专属的临时目录路径（例如 `~/.gemini/tmp/<project_hash>/`）。
    - `listProjectChatFiles()`: 列出 `chats` 子目录中所有符合条件的 `.json` 和 `.jsonl` 会话文件。
    - `loadProjectTempFile<T>(filePath: string)`: 读取指定文件路径的内容，并尝试将其解析为 JSON 对象。这是读取单个会话事件或元数据的底层方法。

- **`packages/core/src/services/chatRecordingTypes.ts`**:
  - **功能**: 这个文件（或类似的数据模型定义文件）定义了 Gemini CLI 内部用于表示会话事件和会话元数据的 TypeScript 接口或类型。
  - **在解析中的作用**: 它是理解会话数据结构的“Schema”。你的解析器应该基于这些类型定义来反序列化 `.jsonl` 文件中的 JSON 对象，确保数据的类型安全和正确解释。

- **`packages/core/src/utils/paths.ts`**:
  - **功能**: 提供各种路径相关的实用函数，包括用于生成项目哈希值的 `getProjectHash()`。
  - **在解析中的作用**: `getProjectHash()` 用于生成 `projectHash`，这个值会包含在会话文件的元数据中，用于关联会话到特定的项目。

- **`session-YYYY-MM-DDTHH-MM-hash.jsonl` (实际会话文件)**:
  - **功能**: 存储了从会话开始到结束的所有交互事件和元数据。
  - **在解析中的作用**: 这是你解析程序的目标文件。

## 2. `ChatRecordingService` 的服务功能流程

`ChatRecordingService` 作为一个会话“记录仪”，其核心流程围绕着会话的生命周期展开：

1.  **初始化 (`constructor`)**:
    - 服务启动时，会接收配置和上下文信息。
    - 它会通过 `getProjectHash()` 获取当前项目目录的唯一哈希值 (`projectHash`)，用于标识和关联会话文件。
    - 它会初始化内部状态，准备开始记录。

2.  **会话开始/加载**:
    - **开始新会话**: 当用户发起一个新的 Gemini CLI 会话时，`ChatRecordingService` 会：
      - 生成一个新的唯一 `sessionId`。
      - 在 `~/.gemini/tmp/<project_hash>/chats/` 目录下创建一个新的 `session-<sessionId>.jsonl` 文件。
      - 写入第一行作为**会话元数据**，包含 `sessionId`, `projectHash`, `startTime`, `lastUpdated`, `kind` (例如 "main") 等信息。
    - **加载现有会话**: 当用户选择恢复一个历史会话时，服务会：
      - 通过 `Storage.listProjectChatFiles()` 找到对应的 `.jsonl` 文件。
      - 打开该文件，并可能一次性读取所有历史事件，或者准备以追加模式继续写入新的事件。

3.  **事件记录**:
    - `ChatRecordingService` 提供多种方法来记录不同类型的事件，每当有新的事件发生，都会将对应的 JSON 对象写入 `.jsonl` 文件的末尾（追加模式）。
    - **记录用户输入**: 当用户键入并提交内容时，会调用相应的方法（例如 `recordUserTurn`），将用户输入（`content`）记录为 `{"type": "user", ...}`。
    - **记录 AI 响应**: 当 Gemini 模型产生回复时，会调用相应的方法（例如 `recordGeminiTurn`），将 AI 的完整输出记录为 `{"type": "gemini", ...}`。这包括 `content`、`thoughts` (思考过程)、`toolCalls` (工具调用详情)、`tokens` (token 统计) 和 `model` (模型名称)。
    - **记录系统信息**: 对于 CLI 内部产生的非对话信息（例如版本更新提示、错误、警告等），会调用相应的方法（例如 `recordInfo`），记录为 `{"type": "info", ...}`。

4.  **元数据更新**:
    - 每次记录新事件后，`ChatRecordingService` 都会写入一个特殊的 `$set` 记录，例如 `{"$set": {"lastUpdated": "..."}}`。这用于实时更新会话的最后活动时间，这对于会话列表的排序和显示非常重要。

5.  **文件关闭**:
    - 当会话结束或 CLI 应用程序退出时，`ChatRecordingService` 会负责安全地关闭所有打开的文件句柄，确保所有缓存数据都被写入磁盘，避免数据丢失。

## 3. 会话数据结构（`.jsonl` 文件内容）

会话文件采用 **JSONL (JSON Lines)** 格式，即文件中的每一行都是一个独立的、有效的 JSON 对象，由换行符分隔。这种格式非常适合记录事件流。

以下是文件中可能出现的几种主要 JSON 对象结构：

### a. 会话元数据 (Session Metadata) - 文件首行

这是 `.jsonl` 文件的第一行，定义了整个会话的基本信息。

```json
{
  "sessionId": "9816730e-7e39-46af-8874-d25d4929ebd8",
  "projectHash": "b8d6a45eae054a1106ccf91b32a511de14b38938eacd1fa0088ea6b59390c2b2",
  "startTime": "2026-04-28T21:44:33.372Z",
  "lastUpdated": "2026-04-28T21:44:33.372Z",
  "kind": "main" // 会话类型，例如 "main"
}
```

- `sessionId`: 唯一标识此次会话的 ID。
- `projectHash`: 关联到此会话的项目目录的哈希值。
- `startTime`: 会话开始的 UTC 时间戳。
- `lastUpdated`: 会话最后更新的 UTC 时间戳。
- `kind`: 会话的类型（例如，"main" 表示主会话）。

### b. 用户输入事件 (User Turn Event)

当用户向 Gemini CLI 输入内容时记录。

```json
{
  "id": "54c181b4-9948-4240-bca0-daf466757b12",
  "timestamp": "2026-04-28T21:45:45.652Z",
  "type": "user",
  "content": [
    {
      "text": "当前系统有采用了 jsonl 这类型文件储存 tmp session 吗."
    }
  ]
}
```

- `id`: 事件的唯一 ID。
- `timestamp`: 事件发生的 UTC 时间戳。
- `type`: 事件类型，此处为 "user"。
- `content`: 用户输入的内容，可以是一个文本数组，或者包含其他富媒体信息。

### c. AI (Gemini) 响应事件 (Gemini Turn Event)

当 Gemini 模型生成响应时记录。这是最复杂的事件类型，包含了 AI 的详细活动。

```json
{
  "id": "ac6b3df8-935b-4b4f-8013-f9172ac08bbb",
  "timestamp": "2026-04-28T21:45:56.776Z",
  "type": "gemini",
  "content": "AI 的回答文本内容，例如：我将开始在整个代码库中搜索...",
  "thoughts": [
    {
      "subject": "思考主题",
      "description": "具体的思考描述，例如：I've homed in on the user's core query..."
    }
    // 更多思考步骤
  ],
  "tokens": {
    "input": 11468,
    "output": 106,
    "cached": 0,
    "thoughts": 748,
    "tool": 0,
    "total": 12322
  },
  "model": "gemini-2.5-pro", // 使用的 AI 模型名称
  "toolCalls": [
    {
      "id": "tool_call_id",
      "name": "工具名称", // 例如 "glob", "read_file"
      "args": {
        "参数名": "参数值" // 工具调用的参数
      },
      "result": {
        "functionResponse": {
          "id": "...",
          "name": "...",
          "response": {
            "output": "工具的输出结果"
          }
        }
      },
      "status": "success", // 工具调用的状态
      "timestamp": "..."
    }
    // 更多工具调用
  ]
}
```

- `id`, `timestamp`, `type`: 同上，`type` 为 "gemini"。
- `content`: AI 的主要文本响应。
- `thoughts`: AI 内部的思考过程或推理步骤，每个思考是一个包含 `subject` 和 `description` 的对象。
- `tokens`: 本次交互中使用的 token 统计，包括输入、输出、缓存、思考和工具相关的 token。
- `model`: 实际用于生成响应的 Gemini 模型名称。
- `toolCalls`: 如果 AI 调用了工具，这里会包含工具调用的详细信息，包括工具名称、参数、调用结果和状态。

### d. 信息事件 (Informational Event)

用于记录系统级的通知、警告或其他非对话内容。

```json
{
  "id": "9717f0f8-efe2-486c-9d61-84d0d2854f40",
  "timestamp": "2026-04-28T21:45:35.147Z",
  "type": "info",
  "content": "A new version of Gemini CLI is available! ..."
}
```

- `id`, `timestamp`, `type`: 同上，`type` 为 "info"。
- `content`: 信息的文本内容。

### e. 元数据更新记录 ($set Event)

用于在会话过程中更新会话的元数据，通常是 `lastUpdated` 时间戳。

```json
{
  "$set": {
    "lastUpdated": "2026-04-28T21:45:35.147Z"
  }
}
```

- `$set`: 指示这是一个更新操作，其值是一个包含要更新字段的对象。

## 4. 构建独立的会话解析程序指南

要构建一个能够完整解析 Gemini CLI 会话文件的程序，请遵循以下步骤：

### 步骤 1: 确定会话文件位置

- **参考 `packages/core/src/config/storage.ts`**: 你的程序需要模拟 `Storage` 类的逻辑来定位会话文件。
  - 首先，找到全局的 Gemini 配置目录：`Storage.getGlobalGeminiDir()` (通常是 `~/.gemini/`)。
  - 然后，找到全局临时目录：`Storage.getGlobalTempDir()` (通常是 `~/.gemini/tmp/`)。
  - 你需要能够根据项目路径生成 `projectIdentifier` (类似于 `Storage.getProjectIdentifier()` 的逻辑，可能涉及哈希)。
  - 最终，会话文件位于 `path.join(globalTempDir, projectIdentifier, 'chats')`。
- **列出文件**: 借鉴 `Storage.listProjectChatFiles()` 的方式，读取 `chats` 目录，筛选出 `.json` 和 `.jsonl` 文件。

### 步骤 2: 读取 `.jsonl` 文件内容

- `.jsonl` 文件是按行分隔的 JSON 对象。处理它们最有效的方式是**逐行读取**。
- **推荐使用流式读取**: 对于大型会话文件，一次性读取整个文件内容可能会消耗过多内存。使用 Node.js 的 `fs.createReadStream()` 配合 `readline` 模块是推荐的做法。

  ```typescript
  import * as fs from 'node:fs';
  import * as readline from 'node:readline';

  async function* readJsonlFile(filePath: string) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity, // 处理不同操作系统的换行符
    });

    for await (const line of rl) {
      if (line.trim().length > 0) {
        try {
          yield JSON.parse(line);
        } catch (e) {
          console.error(`Error parsing JSON line: ${line}`, e);
          // 可以选择跳过或抛出错误
        }
      }
    }
  }

  // 使用示例
  // for await (const record of readJsonlFile(filePath)) {
  //   // 处理 record
  // }
  ```

### 步骤 3: 解析并映射数据

- **反序列化**: 逐行读取到的每个 `record` 都是一个 JavaScript 对象。
- **识别事件类型**: 根据对象的字段来判断其类型：
  - 如果对象包含 `sessionId`, `projectHash`, `startTime` 等字段，它就是会话元数据。
  - 如果包含 `type: "user"`，它是用户输入。
  - 如果包含 `type: "gemini"`，它是 AI 响应。
  - 如果包含 `type: "info"`，它是信息事件。
  - 如果包含 `$set` 字段，它是一个元数据更新。
- **数据模型**: **强烈建议**参考 `packages/core/src/services/chatRecordingTypes.ts` 中定义的 TypeScript 接口，或者根据 `3. 会话数据结构` 部分的描述，为你自己的解析程序创建相应的数据结构（例如，`SessionMetadata`, `UserTurn`, `GeminiTurn`, `InfoEvent` 等接口或类）。这将确保你的解析结果是类型安全且易于使用的。

### 步骤 4: 重构会话历史

- 你的解析器可以维护一个会话状态对象。
- 当读取到会话元数据时，初始化会话对象。
- 当读取到 `$set` 记录时，更新会话对象的相应元数据（例如 `lastUpdated`）。
- 将所有 `user`, `gemini`, `info` 类型的事件按时间顺序收集起来，形成一个完整的对话历史列表。

### 关键考虑事项

- **错误处理**: JSON 解析可能会失败，文件可能不存在或损坏。确保你的解析器能够优雅地处理这些情况。
- **性能**: 对于非常大的 `.jsonl` 文件，使用流式处理而非一次性加载到内存中是至关重要的。
- **版本兼容性**: 未来的 Gemini CLI 版本可能会更改会话文件的结构。你的解析器可能需要考虑这种兼容性，例如通过检查文件元数据中的版本信息（如果存在）来适配不同的解析逻辑。

通过遵循上述指南，你将能够构建一个强大且独立的解析器，以充分利用 Gemini CLI 的会话记录数据。
