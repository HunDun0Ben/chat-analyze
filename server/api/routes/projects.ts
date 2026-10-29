import type express from 'express';
import type { RouteDeps } from '../types.js';
import { parseProjectsQuery } from '../query.js';

export function registerProjectRoutes(
  app: express.Express,
  deps: RouteDeps,
): void {
  app.get('/api/projects', async (req, res) => {
    const { provider } = parseProjectsQuery(req.query);
    res.json(deps.manager.getProjects(provider));
  });

  app.get('/api/projects/:projectName/sessions', async (req, res) => {
    res.json(deps.manager.getSessionsByProject(req.params.projectName));
  });
}
