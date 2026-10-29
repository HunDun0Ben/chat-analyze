import type express from 'express';
import type { RouteDeps } from '../types.js';
import { SkillExportService } from '../services/SkillExport.js';

/** `POST /api/sessions/:id/export-skill` */
export function registerSkillRoutes(
  app: express.Express,
  deps: RouteDeps,
): void {
  const exporter = new SkillExportService(deps.exportsDir);

  app.post('/api/sessions/:id/export-skill', async (req, res) => {
    const session = deps.manager.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const exportPath = exporter.exportSession(session);
    return res.json({ success: true, path: exportPath });
  });
}
