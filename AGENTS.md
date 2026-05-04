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

在提交 PR 或完成代码修改任务前，**必须先执行 `npx prettier --write .` 进行代码格式化，然后再执行 `npm run preflight` 命令**，以确保没有引入格式错误、回归或类型错误。

`npm run preflight` 会运行以下全量验证步骤：

1. **Linting**: 代码风格检查
2. **Type Check**: TypeScript 类型检查
3. **Testing**: Vitest 和 Playwright 测试
4. **Build**: 编译检查

**只有在 `preflight` 命令成功通过后，方可宣布任务完成。** 对于简单的非代码修改（如文档更新），可跳过此流程。

## Development Conventions

- **Type Safety**: **严禁使用 `any` 类型**。必须定义明确的接口或使用 `unknown` / `Record<string, unknown>`。
- **模块契约与接口**:
  - 在组件、Hooks 和服务之间，**务必明确定义数据结构和函数签名**。避免不明确的输入输出，使用 TypeScript 提供的类型系统进行严格约束。
  - 命名导出与默认导出必须保持一致，并在导入时正确匹配。
- **导入路径管理**:
  - 优先使用项目配置的路径别名（例如 `@/` 或 `~/`），以简化模块导入路径，减少相对路径过深导致的错误。
  - 如必须使用相对路径，请仔细核对，确保路径的准确性。
- **组件库使用**:
  - 在开发新功能时，**优先复用 `ui/src/components/ui/` 目录下已定义的通用 UI 组件**。
  - 在引入新组件或修改现有组件时，务必同步更新其接口定义和文档。通用 UI 组件应具备清晰、稳定的属性（props）接口。
- **Theming & Design Tokens**: 本项目支持 Light/Dark 模式。**严禁在组件中硬编码颜色值**。请务必阅读 [Theming Guide](./docs/THEMING.md) 并使用 CSS 变量（Tokens）进行开发。
- **Commit Messages**: 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 标准。每次完成一个独立、功能完整的小任务后，及时提交代码。提交信息应清晰地说明本次提交的目的、内容和影响范围。
- **ESM Imports (Server)**: 在 `server` 工作区中，由于启用了 `type: "module"`，所有相对导入**必须包含 `.js` 扩展名**（例如 `import { Foo } from './Foo.js'`).
- **React Components**:
  - 避免在 `useEffect` 中同步调用 `setState` 触发级联渲染。
  - 使用渲染时状态同步 (State Sync during render) 模式处理基于 Props/ID 变化的状态重置。
  - 确保 `useMemo` 依赖项完整。

## Testing Conventions (Vitest)

- **单元与集成测试**: 对于核心逻辑、React 组件（包括 Hooks、通用 UI 组件、Feature 组件）及服务模块，**必须编写单元测试和/或集成测试**。依赖 `useEffect` 或进行数据处理的 Hooks 尤其需要充分测试。
- **测试隔离**: 确保不同测试框架（如 Vitest 和 Playwright）的测试文件和配置相互独立，避免交叉执行与错误。
- **精准断言**: 测试断言应具体且精确，避免使用可能匹配到多个不相关元素的模糊查询（如 `getByText('0')`），优先使用 `getByRole`、`getByTestId` 或结合 `within` 等更具语义和精确性的查询方法。
- **Environment Variables**: 在测试依赖环境变量的代码时，在 `beforeEach` 中使用 `vi.stubEnv('NAME', 'value')`，并在 `afterEach` 中使用 `vi.unstubAllEnvs()`。严禁直接修改 `process.env`。

## Coach Module & Auditing Logic

`server/core/services/CoachService.ts` 中的审计逻辑是项目的核心。任何对解析逻辑的更改都必须针对评分公式进行测试，该公式会对修正、模糊术语和上下文缺失进行扣分。
