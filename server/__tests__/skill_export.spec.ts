import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SkillExportService,
  buildSkillMarkdown,
  sanitizeSkillName,
} from '../api/services/SkillExport.js';
import type { AnalyzedSession } from '../types/index.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-analyze-export-'));
  tempDirs.push(dir);
  return dir;
}

function makeSession(
  overrides: Partial<AnalyzedSession> = {},
): AnalyzedSession {
  return {
    sessionId: 'abcdef1234567890',
    projectName: 'demo/project',
    sessionTitle: 'Redis / cache: "flush"',
    projectHash: 'h',
    modelId: 'gemini-pro',
    category: 'Coding',
    provider: 'gemini',
    startTime: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    expressionQuality: {
      score: 80,
      scoreable: true,
      ambiguities: [],
      suggestion: 'Ask for the exact cache key.',
    },
    stats: {
      turns: 2,
      totalMessages: 2,
      userTurns: 1,
      assistantTurns: 1,
      corrections: 0,
      toolChain: ['run_shell_command'],
      tokenUsage: { input: 0, output: 0, thoughts: 0, total: 0 },
    },
    messages: [
      {
        id: 'u',
        type: 'user',
        timestamp: '2026-01-01T00:00:00.000Z',
        content: 'how do I flush the cache?',
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('sanitizeSkillName', () => {
  it('strips path separators and reserved characters', () => {
    expect(sanitizeSkillName('../Redis / cache: "flush"')).toBe(
      '.._Redis_cache_flush',
    );
  });

  it('falls back for an empty name', () => {
    expect(sanitizeSkillName('   ')).toBe('new-skill');
  });
});

describe('buildSkillMarkdown', () => {
  it('renders instructions, tools and the first question', () => {
    const markdown = buildSkillMarkdown(makeSession());

    expect(markdown).toContain('# Redis / cache: "flush"');
    expect(markdown).toContain('## Instructions');
    expect(markdown).toContain('Ask for the exact cache key.');
    expect(markdown).toContain('run_shell_command');
    expect(markdown).toContain('how do I flush the cache?');
  });
});

describe('SkillExportService', () => {
  it('writes the skill atomically without leaving a .tmp file', () => {
    const exportsDir = path.join(makeTempDir(), 'nest', 'exports');
    const exporter = new SkillExportService(exportsDir);

    const exportPath = exporter.exportSession(makeSession());

    expect(fs.existsSync(exportPath)).toBe(true);
    expect(path.dirname(exportPath)).toBe(exportsDir);
    expect(fs.readdirSync(exportsDir)).toEqual([path.basename(exportPath)]);
    expect(fs.readFileSync(exportPath, 'utf-8')).toContain('## Instructions');
  });

  it('keeps concurrent exports in separate files', () => {
    const exportsDir = makeTempDir();
    const exporter = new SkillExportService(exportsDir);

    const first = exporter.exportSession(
      makeSession({ sessionId: 'aaaaaaaa1111' }),
    );
    const second = exporter.exportSession(
      makeSession({ sessionId: 'bbbbbbbb2222' }),
    );

    expect(first).not.toBe(second);
    expect(fs.readdirSync(exportsDir)).toHaveLength(2);
  });
});
