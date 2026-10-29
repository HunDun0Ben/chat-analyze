import type express from 'express';
import type { RouteDeps } from '../types.js';

/** Read-only aggregates, computed from the in-memory index. */
export function registerStatsRoutes(
  app: express.Express,
  deps: RouteDeps,
): void {
  app.get('/api/stats/summary', async (req, res) => {
    res.json(deps.manager.getStats());
  });

  app.get('/api/stats/timeline', async (req, res) => {
    res.json(deps.stats.timeline(deps.manager.getAllSessions()));
  });

  app.get('/api/stats/models', async (req, res) => {
    res.json(deps.stats.byModel(deps.manager.getAllSessions()));
  });
}
