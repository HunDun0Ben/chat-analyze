import express from 'express';
import cors from 'cors';
import { StatsService } from './core/stats/StatsService.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { registerProjectRoutes } from './api/routes/projects.js';
import { registerQuestionRoutes } from './api/routes/questions.js';
import { registerSessionRoutes } from './api/routes/sessions.js';
import { registerSkillRoutes } from './api/routes/skills.js';
import { registerStatsRoutes } from './api/routes/stats.js';
import type { AppDeps } from './api/types.js';

export type { AppDeps, SessionManagerLike } from './api/types.js';

const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/**
 * The dashboard is a local tool that reads private conversations, so CORS is
 * restricted to the known UI origins instead of allowing every site.
 */
function getCorsOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_CORS_ORIGINS;
}

/**
 * Builds the Express app without binding a port. Tests use this directly,
 * `startServer` wraps it for the real process.
 */
export function createApp({ manager, exportsDir }: AppDeps): express.Express {
  const app = express();
  const deps = { manager, exportsDir, stats: new StatsService() };

  app.use(cors({ origin: getCorsOrigins() }));
  app.use(express.json());

  registerQuestionRoutes(app, deps);
  registerProjectRoutes(app, deps);
  registerSessionRoutes(app, deps);
  registerStatsRoutes(app, deps);
  registerSkillRoutes(app, deps);

  app.use(errorHandler);

  return app;
}
