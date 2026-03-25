# Refactoring Plan - Gemini Chat Analyze & Evolver

## 1. Backend Refactoring (Modular & Extensible)

### 1.1 Core Architecture (Strategy Pattern)
- **`server/core/parsers/`**: 
    - `BaseParser.ts`: Interface and abstract base class for all session parsers.
    - `GeminiParser.ts`: Implementation for Gemini session JSONs.
    - `ChatGPTParser.ts`: Implementation for ChatGPT JSONs.
- **`server/core/services/`**:
    - `CoachService.ts`: Quality scoring, ambiguity detection, and suggestion generation logic.
    - `DiscoveryService.ts`: Project discovery, path scanning, and `projects.json` mapping.
- **`server/core/manager.ts`**: Refactored to coordinate between parsers, discovery, and storage.

### 1.2 Persistence Layer
- **`server/db/storage.ts`**: Fully integrate into `SessionManager`. 
- Every new session or update should be persisted to SQLite.

### 1.3 Testing
- Unit tests for each parser strategy.
- Integration tests for `SessionManager` and `Storage`.

## 2. UI Componentization & Clean Code

### 2.1 Directory Structure
- `ui/src/components/ui/`: Atomic components (Card, Button, Badge, ScrollArea, etc.).
- `ui/src/components/features/`: Complex components (ChartCard, MessageBubble, InspectorPanel).
- `ui/src/features/`: Feature-specific logic/hooks (e.g., `dashboard/useStats.ts`, `session/useSession.ts`).

### 2.2 Refactoring Views
- **`Dashboard.tsx`**: Split into `StatsOverview`, `TimelineChart`, `ModelPerformance`.
- **`SessionView.tsx`**: Split into `MessageList`, `SessionHeader`, `Inspector`.
- **`Sidebar.tsx`**: Improve project list rendering and navigation.

## 3. Directory Structure Support (Gemini/ChatGPT)
- Update `DiscoveryService` to:
    - Support scanning `~/.gemini/tmp/<project>/chats/session-*.json` (Gemini).
    - Support scanning directories for ChatGPT exports (JSON files with mapping/id).
    - Handle `.project_root` and `projects.json` if available.

## 4. Verification & Validation Strategy (Definition of Done)

### 4.1 Automated Unit Testing
- **Parser Validation**: Tests for `GeminiParser` and `ChatGPTParser` with mock JSONs to ensure 100% field mapping accuracy.
- **Logic Validation**: Tests for `CoachService` scoring and suggestions.
- **Storage Validation**: CRUD tests for `SessionStorage` to ensure data integrity in SQLite.

### 4.2 Regression & Integrity
- **Existing Tests**: Run `npm run test --workspaces` after each backend change.
- **Static Analysis**: Run `npm run lint` and `tsc` to ensure no type or linting regressions in UI/Server.

### 4.3 API & Integration Check
- **Contract Testing**: Verify API responses (`/api/projects`, `/api/sessions/:id`) match the frontend types.
- **Watcher Simulation**: Manually trigger file additions/changes to verify the `ChatWatcher` -> `Manager` -> `Storage` pipeline.

### 4.4 UI & UX Validation
- **Visual Regression**: Use `mcp_playwright_browser_snapshot` to capture and verify component rendering and layout.
- **Interactive Smoke Test**: Verify navigation and real-time updates in the dashboard.

## 5. Implementation Steps

1. **Step 1: Backend Strategy Pattern & Services**
   - Create `BaseParser`, `GeminiParser`, `ChatGPTParser`, and `CoachService`.
   - **Validate**: Run unit tests for each new service/parser.
2. **Step 2: Integration & Storage**
   - Update `SessionManager` to use parsers and `SessionStorage`.
   - **Validate**: Run integration tests and existing test suites.
3. **Step 3: UI Atoms & Reorganization**
   - Create reusable UI components and reorganize `ui/src`.
   - **Validate**: Run `tsc` and capture UI snapshots.
4. **Step 4: View Refactoring**
   - Refactor `Dashboard` and `SessionView`.
   - **Validate**: Perform interactive smoke tests and visual regression checks.
5. **Step 5: Directory Structure Support**
   - Finalize `DiscoveryService` for robust Gemini/ChatGPT folder support.
   - **Validate**: Test with multiple project root scenarios.
