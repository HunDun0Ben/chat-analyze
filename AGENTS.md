# Gemini Chat Analyze & Evolver

## Project Overview

This is a Node.js and TypeScript monorepo containing a localized, private session auditing and evolution engine designed for Gemini CLI. It monitors AI interaction records in real-time, provides feedback on prompt quality via the **Coach Module**, and tracks performance across different models and tasks using SQLite.

The project is structured into two main workspaces:

- **`server/` (Backend):** Built with Node.js, Express, TypeScript, and `better-sqlite3`. It includes a `Watcher` to monitor `~/.gemini/tmp` for JSON changes, a `Parser` to extract session metadata and calculate Coach Module scores, and a REST API to serve the data.
- **`ui/` (Frontend):** Built with React, Vite, and Tailwind CSS. It provides a responsive dashboard for visualizing session analysis, quality trends, and model comparisons.

## Building and Running

### Prerequisites

- Node.js v18+
- Gemini CLI installed and generating session logs in `~/.gemini/tmp`

### Installation

```bash
npm install
cd ui && npm install && cd ..
```

### Running the Application (Development)

Starts the backend Watcher, API Server, and the UI Dashboard concurrently:

```bash
npm run dev
```

### Building for Production

```bash
npm run build --workspaces
```

### Testing

Run tests across all workspaces:

```bash
npm run test --workspaces
```

_Note: The server tests use `vitest`, while the UI uses Playwright and Vite-based testing._

## Development Conventions

- **Monorepo Management:** Uses npm workspaces (`server` and `ui`). Scripts in the root `package.json` coordinate tasks across both.
- **Language:** TypeScript is strictly used across both backend and frontend codebases.
- **Backend Architecture:** Decoupled design. The `core` handles parsing and filesystem watching, `db` encapsulates SQLite interactions, and `api` defines the REST endpoints.
- **Frontend Architecture:** Component-based React architecture with Tailwind CSS used via Design Tokens defined in `ui/src/index.css`. Uses `recharts` for visualization.
- **Code Quality:** The UI directory incorporates `eslint` for linting. Ensure code follows standard TypeScript/React best practices.
- **Coach Module:** The auditing logic in `server/core/parser.ts` is central to the project. Changes to the parsing logic should be tested against the scoring formula which penalizes corrections, ambiguous terms, and missing context.
