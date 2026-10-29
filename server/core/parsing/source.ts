import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

/**
 * Uniform input for every parser.
 *
 * Static formats read the whole document via `readJson()`, incremental formats
 * stream via `lines()`. Both are derived from the same file, so parsers no
 * longer need to know whether the caller already parsed the payload.
 */
export interface SessionSource {
  filePath: string;
  fileName: string;
  /** File metadata; parsed sessions must be deterministic, so timestamps fall
   * back to `mtimeMs` instead of "now". */
  stat: { mtimeMs: number; size: number };
  /** Position inside a multi-session file (e.g. a ChatGPT bulk export). */
  index?: number;
  readJson(): Promise<unknown>;
  lines(): AsyncIterable<string>;
}

async function* readLines(filePath: string): AsyncIterable<string> {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      yield line;
    }
  } finally {
    rl.close();
    stream.close();
  }
}

export async function createFileSource(
  filePath: string,
): Promise<SessionSource> {
  const stat = await fsp.stat(filePath);

  return {
    filePath,
    fileName: path.basename(filePath),
    stat: { mtimeMs: stat.mtimeMs, size: stat.size },
    readJson: async () => JSON.parse(await fsp.readFile(filePath, 'utf-8')),
    lines: () => readLines(filePath),
  };
}

/**
 * In-memory source for tests and for individual entries of a multi-session
 * file. Keeps the parser contract identical to the file-backed case.
 */
export function createMemorySource(options: {
  filePath: string;
  fileName?: string;
  data?: unknown;
  lines?: string[];
  mtimeMs?: number;
  index?: number;
}): SessionSource {
  const lines = options.lines ?? [];

  return {
    filePath: options.filePath,
    fileName: options.fileName ?? path.basename(options.filePath),
    stat: { mtimeMs: options.mtimeMs ?? 0, size: 0 },
    index: options.index,
    readJson: async () => options.data,
    lines: async function* () {
      for (const line of lines) yield line;
    },
  };
}
