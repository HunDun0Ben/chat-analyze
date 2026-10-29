import { AnalyzedSession } from '../../types/index.js';

/** A non-fatal problem encountered while reading one file. */
export interface ParseWarning {
  filePath: string;
  reason: string;
}

/**
 * What a single provider parser produces. `warnings` carries skipped records
 * (bad JSONL lines, unsupported entries in an export array) so callers never
 * have to guess why a session is missing.
 */
export interface ParserOutput {
  sessions: AnalyzedSession[];
  warnings: ParseWarning[];
}

/** Result of analysing one file: zero or more sessions plus diagnostics. */
export type ParseResult = ParserOutput;
