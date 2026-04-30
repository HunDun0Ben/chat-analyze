# 🔍 Discovery Service 实现详解 (Discovery Service Implementation Details)

## 1. 背景 (Context 背景)

由于 Gemini CLI 及其他工具的会话文件可能散落在文件系统的多个位置（例如 `~/.gemini/tmp/` 的各个子目录中），甚至项目结构本身也可能存在嵌套，我们需要一个强大的服务来自动化地发现这些会话文件，并准确地识别它们所属的项目。`DiscoveryService` 正是为了此而生。

## 2. 扫描策略 (`scan` Strategy 扫描策略)

`DiscoveryService` 的入口是 `scan` 方法，它负责遍历一个或多个“监听路径” (`watchPaths` 监控路径) 来查找会话文件。

其主要扫描逻辑如下:

1.  **遍历监听路径**: 按顺序处理传入的每一个 `watchPath` (监控路径)。
2.  **处理根目录文件**: 查找直接位于 `watchPath` 根目录下的 `.json` 文件。这些文件通常是用户手动导入的，因此会被自动分配到名为 `Imported` 的特殊项目中。
3.  **递归搜索子目录**:
    - 遍历 `watchPath` 下的子目录（会跳过 `node_modules`, `.git` 等预设的忽略目录）。
    - 对每个有效的项目目录，它会调用内部的 `collectSessions` 方法，递归地收集其中所有的 `.json` 会话文件。
    - 收集到文件后，调用 `resolveProjectName` 方法为每个文件确定项目归属。

## 3. 项目名识别策略 (`resolveProjectName` Strategy 项目名解析策略)

`resolveProjectName` 是识别核心，它采用以下优先级来异步确定一个会话文件（`filePath` 文件路径）究竟属于哪个项目：

1.  **向上查找标记文件 (Marker-based Resolution 基于标记的解析)**:
    - 从会话文件所在的目录开始，**向上**逐层递归查找。
    - 在每一层目录中，检查是否存在 `.project_root` 或 `projects.json` 这两个**标记文件**之一。
    - 如果找到，则**包含该标记文件的目录名**就被视为 `Project Name` (项目名称)，查找结束。
    - **注意**: 此处的 `projects.json` 仅作为存在性标记，服务本身不会读取其内容。

2.  **回退到相对路径 (Fallback to Relative Path 回退到相对路径)**:
    - 如果向上查找未能找到任何标记文件，服务会回退到第二种策略。
    - 它会计算文件相对于当前 `watchPath` (监控路径) 的路径。
    - 通常，路径中的**第一个目录名**会被作为项目名。例如，对于 `.../watch_path/my-project/session.json`，项目名就是 `my-project`。
    - **特殊情况**: 如果第一个目录名是 `chats`（例如 `.../chats/my-project/session.json`），系统会认为它是一个通用的容器目录，并会**取第二个目录名** (`my-project`) 作为项目名。

3.  **最终回退 (Final Fallback 最终回退)**:
    - 如果以上策略都无法确定项目名（例如，文件直接位于 `watchPath` 下，但不符合任何规则），则项目名会被设为 `Imported` (已导入)。

## 4. 忽略的目录与文件 (Ignored Entries 忽略条目)

为了提高效率和准确性，服务在扫描时会主动忽略一些常见的目录和配置文件：

- **忽略目录**: `node_modules`, `.git`, `exports`, `dist`, `build`, `logs`, `community-plugins`。
- **忽略的保留配置文件**: `package.json`, `package-lock.json`, `tsconfig.json`, `projects.json`, `vitest.config.ts`。这些文件不会被当作会话文件处理。
