# 🎨 Gemini Audit Theming & Tokenizer

本项目采用 **Design Tokens (设计令牌)** 体系来管理样式，以支持 Light/Dark 模式的无缝切换。

## 核心设计理念

禁止在代码中直接使用 hardcoded 的十六进制颜色值。所有颜色必须通过 `index.css` 中定义的 CSS 变量引用。

## 设计令牌 (Design Tokens)

### 基础背景 (Backgrounds)

| Token           | Light Value | Dark Value | 描述          |
| :-------------- | :---------- | :--------- | :------------ |
| `--app-bg`      | `#f8fafc`   | `#020617`  | 应用主背景    |
| `--sidebar-bg`  | `#ffffff`   | `#0b0f1a`  | 侧边栏背景    |
| `--card-bg`     | `#ffffff`   | `#111827`  | 卡片/容器背景 |
| `--card-border` | `#e2e8f0`   | `#1f2937`  | 默认边框      |

### 文字颜色 (Text)

| Token          | Light Value | Dark Value | 描述          |
| :------------- | :---------- | :--------- | :------------ |
| `--text-main`  | `#0f172a`   | `#f1f5f9`  | 主要文字      |
| `--text-muted` | `#475569`   | `#94a3b8`  | 次要/说明文字 |
| `--text-dim`   | `#64748b`   | `#64748b`  | 最弱的文字    |

### 气泡颜色 (Bubbles)

| Token         | Light Value | Dark Value | 描述            |
| :------------ | :---------- | :--------- | :-------------- |
| `--user-bg`   | `#f1f5f9`   | `#1e293b`  | 用户消息背景    |
| `--gemini-bg` | `#f8fafc`   | `#111827`  | Gemini 消息背景 |

## 如何使用

在 Tailwind 插件或直接在组件中使用 `var(--token-name)`。例如：

```tsx
<div className="bg-[var(--app-bg)] text-[var(--text-main)]">Content</div>
```

## 切换逻辑

系统通过给 `<html>` 标签添加/移除 `.dark` 类来实现主题切换。状态通过 `localStorage` 持久化。
