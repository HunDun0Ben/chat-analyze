# 🔍 Discovery & Project Resolution

## 1. Context

Session files come from multiple providers (Gemini CLI, ChatGPT exports, and
future tools) and can live in arbitrary directories. The system separates two
concerns:

1. **Discovery** — find candidate session files under the configured watch
   paths. This step is provider-agnostic.
2. **Project resolution** — decide which project a parsed session belongs to.
   This step is provider-specific.

```
watchPaths ──► DiscoveryService ──► SessionAnalyzer ──► ProjectResolver
                (files only)        (provider id)     (final projectName)
```

`SessionManager` uses the same flow for both the boot scan (`init`) and the
watcher (`upsertFromFile`), so a session's project name is identical no matter
how it was loaded.

## 2. Scan Strategy (`DiscoveryService.scan`)

1. Iterate every configured `watchPath` in order.
2. Collect session files:
   - root-level files directly under the watch path;
   - all files under non-ignored subdirectories (recursively).
3. Only `.json` and `.jsonl` files are considered, and reserved configuration
   files are skipped (see §4).
4. Results are de-duplicated by absolute path (overlapping watch paths are
   allowed) and sorted for deterministic output.
5. A failure while reading one watch path or subdirectory is logged and does
   not abort the remaining paths.

`DiscoveryResult` contains only `filePath` and `watchRoot`. No project name
is inferred at this layer; the final name is produced by `ProjectResolver`
after parsing.

## 3. Project Resolution (`ProjectResolver`)

Resolution only applies when the parser produced a placeholder name. Otherwise
the parser-provided name (for example a name stored inside a Gemini session) is
kept.

| Provider  | Root-level file  | Nested file                                                                         | Markers                                                                                  |
| --------- | ---------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `gemini`  | `Imported`       | first directory below the watch root; `chats/<project>/...` resolves to `<project>` | Walks upwards for `.project_root` or `projects.json`; the containing directory name wins |
| `chatgpt` | `ChatGPT Import` | first directory below the watch root                                                | None                                                                                     |
| unknown   | `Imported`       | first directory below the watch root                                                | None                                                                                     |

Additional rules:

- The most specific (longest) watch root containing the file is used, so
  `/data/end` does not match `/data/end2`.
- A file outside every watch path resolves to `Unknown`.
- Placeholder detection lives in `ProjectResolver.isPlaceholder` and is
  provider-specific (for example Gemini's 64-character project hash).

## 4. Ignored Entries

The ignore rules are defined once in
`server/core/services/discovery/ignored.ts` and shared by `DiscoveryService`
and `ChatWatcher`.

- **Ignored directories**: `node_modules`, `.git`, `exports`, `dist`, `build`,
  `logs`, `community-plugins`, `.obsidian`, `.trash`.
- **Ignored files**: `package.json`, `package-lock.json`, `tsconfig.json`,
  `projects.json`, `vitest.config.ts`, `community-plugins.json`.

`.obsidian` and `.trash` are ignored because exported notes directories often
contain configuration JSON that is not a session (and `.trash` may contain
corrupted files).

## 5. Extending a Provider

1. Add a parser under `server/core/parsers/` and register it in
   `PARSER_REGISTRATIONS` (`server/core/parsing/registry.ts`).
2. Add a naming function in
   `server/core/services/discovery/projectNaming.ts`.
3. Route the provider in `ProjectResolver.resolve` and add its placeholder rule
   in `ProjectResolver.isPlaceholder`.
4. Add tests for the parser, naming rules, and boot/watcher consistency.
