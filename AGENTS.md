# Gemini Chat Analyze & Evolver

## Project Context & Principles

**使用中文回复**
**使用 `gh` 完成对 github 的操作. `gh` 的版本为: gh version 2.45.0 (2025-07-18 Ubuntu 2.45.0-1ubuntu0.3)**

- **目的**: 为 Gemini CLI 提供本地化、私有的会话审计与进化引擎。
- **技术栈**: Node.js (>=20.0.0), TypeScript, React, Vite, Vitest, SQLite (better-sqlite3), Tailwind CSS.
- **架构**: Monorepo (npm workspaces).
  - `server/`: 后端逻辑、文件监听 (Watcher)、解析器 (Parser) 与 REST API。
  - `ui/`: 基于 React 和 Vite 的前端仪表盘。

## Testing and Quality Mandates (Preflight)

在提交 PR 或完成代码修改任务前，**必须执行以下全量验证步骤**以确保没有引入回归或类型错误：

1. **Linting**: `npm run lint -w ui` (UI 工作区).
2. **Type Check**:
   - UI: `cd ui && npx tsc -b`
   - Server: `cd server && npx tsc --noEmit`
3. **Testing**: `npm run test --workspaces` (运行 Vitest 和 Playwright 测试).
4. **Build**: `npm run build --workspaces` (确保编译通过).

**只有在上述所有检查均通过后，方可宣布任务完成。** 对于简单的非代码修改（如文档更新），可跳过此流程。

## Development Conventions

- **Type Safety**: **严禁使用 `any` 类型**。必须定义明确的接口或使用 `unknown` / `Record<string, unknown>`。
- **Commit Messages**: 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 标准。
- **ESM Imports (Server)**: 在 `server` 工作区中，由于启用了 `type: "module"`，所有相对导入**必须包含 `.js` 扩展名**（例如 `import { Foo } from './Foo.js'`).
- **React Components**: 
  - 避免在 `useEffect` 中同步调用 `setState` 触发级联渲染。
  - 使用渲染时状态同步 (State Sync during render) 模式处理基于 Props/ID 变化的状态重置。
  - 确保 `useMemo` 依赖项完整。

## Testing Conventions (Vitest)

- **Environment Variables**: 在测试依赖环境变量的代码时，在 `beforeEach` 中使用 `vi.stubEnv('NAME', 'value')`，并在 `afterEach` 中使用 `vi.unstubAllEnvs()`。严禁直接修改 `process.env`。

## Coach Module & Auditing Logic

`server/core/services/CoachService.ts` 中的审计逻辑是项目的核心。任何对解析逻辑的更改都必须针对评分公式进行测试，该公式会对修正、模糊术语和上下文缺失进行扣分。
