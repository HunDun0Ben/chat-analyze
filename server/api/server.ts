/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Express API Server
 */

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { SessionManager } from '../core/manager.js';

export function startServer(manager: SessionManager) {
  const app = express();
  const port = 3001;

  app.use(cors());
  app.use(express.json());

  // API: List all projects
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = manager.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API: List sessions under a project
  app.get('/api/projects/:slug/sessions', async (req, res) => {
    try {
      const { slug } = req.params;
      const sessions = manager.getSessionsByProject(slug);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API: Get full session details
  app.get('/api/sessions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const session = manager.getSessionById(id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API: Get stats timeline
  app.get('/api/stats/timeline', (req, res) => {
    try {
      const timeline = manager.getStatsTimeline();
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API: Get model performance stats
  app.get('/api/stats/models', (req, res) => {
    try {
      const stats = manager.getModelStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // API: Export session as SKILL.md
  app.post('/api/sessions/:id/export-skill', (req, res) => {
    try {
      const session = manager.getSessionById(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const skillName = session.projectName.split('/').pop() || 'new-skill';
      const skillContent = `# ${skillName}\n\n## Instructions\n${session.expressionQuality.suggestion}\n\n## Tools\n${session.stats.toolChain.join(', ')}\n\n## Examples\n- **Input**: ${session.messages[0].content}\n- **Model**: ${session.modelId}\n`;

      const exportDir = './exports/skills';
      const exportPath = `${exportDir}/${skillName}-${session.sessionId.slice(0, 8)}.md`;
      
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      fs.writeFileSync(exportPath, skillContent);

      res.json({ success: true, path: exportPath });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.listen(port, () => {
    console.log(`[Server] API running at http://localhost:${port}`);
  });
}
