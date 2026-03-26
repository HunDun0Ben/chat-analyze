import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '../core/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startServer(manager: SessionManager) {
  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  // --- Session API ---
  // ... (保持之前定义的 API 不变)

  app.get('/api/projects', async (req, res) => {
    try {
      const { provider } = req.query;
      res.json(
        manager.getProjects(provider as 'gemini' | 'chatgpt' | undefined),
      );
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/projects/:projectName/sessions', async (req, res) => {
    try {
      res.json(manager.getSessionsByProject(req.params.projectName));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/sessions/summary', async (req, res) => {
    try {
      const sessions = manager.getAllSessions();
      // 返回精简版，用于搜索和侧边栏显示
      const summary = sessions.map((s) => ({
        sessionId: s.sessionId,
        sessionTitle: s.sessionTitle,
        projectName: s.projectName,
        provider: s.provider,
        startTime: s.startTime,
        isCheckpoint: s.isCheckpoint,
        expressionQuality: { score: s.expressionQuality.score },
        // 只取第一条用户消息作为标题回退
        firstMessage: s.messages.find((m) => m.type === 'user')?.content || '',
      }));
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/sessions/:id', async (req, res) => {
    try {
      const session = manager.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // --- Stats API (Directly from Memory) ---

  app.get('/api/stats/summary', async (req, res) => {
    try {
      res.json(manager.getStats());
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/stats/timeline', async (req, res) => {
    try {
      const sessions = manager.getAllSessions();
      const groups: Record<string, { totalScore: number; count: number }> = {};

      sessions.forEach((s) => {
        const date = s.startTime.split('T')[0];
        if (!groups[date]) groups[date] = { totalScore: 0, count: 0 };
        groups[date].totalScore += s.expressionQuality.score;
        groups[date].count++;
      });

      const timeline = Object.entries(groups)
        .map(([date, data]) => ({
          date,
          avgScore: Math.round(data.totalScore / data.count),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/stats/models', async (req, res) => {
    try {
      const sessions = manager.getAllSessions();
      const modelStats: Record<
        string,
        {
          count: number;
          totalScore: number;
          totalTokens: number;
          totalTurns: number;
        }
      > = {};

      sessions.forEach((s) => {
        const mid = s.modelId || 'unknown';
        if (!modelStats[mid])
          modelStats[mid] = {
            count: 0,
            totalScore: 0,
            totalTokens: 0,
            totalTurns: 0,
          };
        modelStats[mid].count++;
        modelStats[mid].totalScore += s.expressionQuality.score;
        modelStats[mid].totalTokens += s.stats.tokenUsage.total;
        modelStats[mid].totalTurns += s.stats.turns;
      });

      const result = Object.entries(modelStats).map(([modelId, data]) => ({
        modelId,
        sessionCount: data.count,
        avgScore: Math.round(data.totalScore / data.count),
        avgTokens: Math.round(data.totalTokens / data.count),
        avgTurns: Math.round(data.totalTurns / data.count),
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sessions/:id/export-skill', async (req, res) => {
    try {
      const session = manager.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const skillName =
        session.sessionTitle ||
        session.projectName.split('/').pop() ||
        'new-skill';
      const skillContent = `# ${skillName}\n\n## Instructions\n${session.expressionQuality.suggestion}\n\n## Tools\n${session.stats.toolChain.join(', ')}\n\n## Examples\n- **Input**: ${session.messages.find((m: { type: string; content: string }) => m.type === 'user')?.content || 'N/A'}\n- **Model**: ${session.modelId}\n`;

      const exportDir = path.resolve(__dirname, '../../exports/skills');
      const exportPath = path.join(
        exportDir,
        `${skillName.replace(/[/\\?%*:|"<>\s]/g, '_')}-${session.sessionId.slice(0, 8)}.md`,
      );

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
