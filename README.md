# 🚀 Gemini Chat Analyze & Evolver

[English] | [中文版](./README.zh-CN.md)

A localized, private session auditing and evolution engine designed for Gemini CLI. It monitors your AI interaction records in real-time, provides feedback on prompt quality via the **Coach Module**, and tracks performance across different models and tasks using SQLite.

---

## ✨ Current Features

### 1. Real-time Auditing

- **Watcher**: Automatically monitors JSON changes in `~/.gemini/tmp`, enabling instant analysis upon message generation.
- **Parser**: Extracts Markdown content, Tool Chains, Token usage, and Chain-of-Thoughts.
- **Project-Centric**: Detects project ownership and recovers names from path structures for long-hash project IDs.

### 2. Coach Module

- **Scoring**: 0-100 quality score based on correction frequency, length, and ambiguity.
- **Suggestions**: Generates tips for improving prompts (e.g., reducing ambiguous pronouns, adding context).
- **Classification**: Detects task types (Coding, Ops, Research, Arch, Learning, General).

### 3. Data & Visualization

- **Local Storage**: Privacy-first persistence with SQLite. No data leaves your machine.
- **Dashboard**:
  - **Trend Analysis**: 30-day quality score timeline.
  - **Model Comparison**: Stats for average score, token efficiency, and turns across different models.
- **Skill Export**: Export high-quality sessions as Gemini CLI `.md` skill files.

---

## 📅 Future Roadmap

### Short-term

- [ ] **Multi-Session Comparison**: A/B testing for different models on the same prompt.
- [ ] **Custom Scoring Rules**: User-configurable auditing logic.
- [ ] **Code Diff Analysis**: Deep integration with `replace` logic to analyze accuracy and regression risks.

### Long-term

- [ ] **Smart Rewrite Engine**: Auto-rewrite low-score prompts using local LLMs.
- [ ] **IDE Integration**: View history and AI suggestions directly in VS Code.
- [ ] **Team Knowledge Base**: Extract technical decisions to generate ADRs.

---

## 🏗️ Technical Architecture

- **Backend**: Node.js + TypeScript + Express
- **Storage**: SQLite (`better-sqlite3`)
- **Frontend**: React + Vite + Tailwind CSS
- **Monitor**: Chokidar (FS Watcher)

---

## 🛠️ Getting Started

### Prerequisites

- Node.js v18+
- [Gemini CLI](https://github.com/google/gemini-cli)

### Installation

```bash
npm install
cd ui && npm install && cd ..
```

### Run

```bash
# Starts Watcher, API Server, and UI Dashboard
npm run dev
```

---

## 🏛️ Directory Structure

- `server/`: Backend Core
  - `core/`: Parser, Watcher, Manager
  - `api/`: RESTful API Service
  - `db/`: SQLite Storage
- `ui/`: React Dashboard
