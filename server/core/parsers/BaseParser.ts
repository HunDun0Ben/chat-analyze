import { CoachService } from '../services/CoachService.js';
import { ParserOutput } from '../parsing/result.js';
import { SessionSource } from '../parsing/source.js';

export abstract class BaseParser {
  constructor(protected coachService: CoachService) {}

  /**
   * Parses one source into zero or more sessions.
   *
   * The source is the only input: parsers must not read `process.cwd()`,
   * re-read the file themselves, or rely on callers having parsed the payload.
   */
  abstract parse(source: SessionSource): Promise<ParserOutput>;
}
