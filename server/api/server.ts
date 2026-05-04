import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '../core/manager.js';
import { UserQuestionsSession } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startServer(manager: SessionManager) {
  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  // --- User Questions API ---
  app.get('/api/user-questions', async (req, res) => {
    try {
      const { project, category, minScore, maxScore, limit, offset } =
        req.query;
      let sessions = manager.getAllSessions();

      // Apply filters
      if (project) {
        sessions = sessions.filter((s) => s.projectName === project);
      }
      if (category) {
        sessions = sessions.filter((s) => s.category === category);
      }
      if (minScore) {
        sessions = sessions.filter(
          (s) => s.expressionQuality.score >= parseInt(minScore as string),
        );
      }
      if (maxScore) {
        sessions = sessions.filter(
          (s) => s.expressionQuality.score <= parseInt(maxScore as string),
        );
      }

      const userQuestions: UserQuestionsSession[] = sessions
        .map((s) => ({
          sessionId: s.sessionId,
          projectName: s.projectName,
          sessionTitle: s.sessionTitle,
          startTime: s.startTime,
          questions: s.messages
            .filter((m) => m.type === 'user')
            .map((m) => m.content.trim())
            .filter((q) => q.length > 0),
        }))
        .filter((s) => s.questions.length > 0)
        .sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        );

      // Pagination
      const start = parseInt(offset as string) || 0;
      const count = parseInt(limit as string) || userQuestions.length;
      const paginatedData = userQuestions.slice(start, start + count);

      const isTextRequested =
        req.headers.accept?.includes('text/plain') ||
        req.query.format === 'text' ||
        req.query.format === 'prompt';

      if (isTextRequested) {
        if (
          req.query.format === 'prompt' ||
          req.query.includePrompt === 'true'
        ) {
          const promptHeader = `<instruction>
      你是一位专业的软件工程沟通专家。下面是用户在项目 [${project || '所有项目'}] 中的连续提问记录。
      请根据这些记录执行深度审计，识别用户在提问时的思维模型、逻辑断层以及表达精确度。

      请严格按照以下结构输出你的分析报告：
      # 提问模式审计报告
      ## 1. 思维模型观察 (分析用户是如何理解技术问题的)
      ## 2. 核心问题识别 (列出 3 个最影响沟通效率的缺陷，并引用具体提问作为证据)
      ## 3. 针对性进化建议 (提供具体的提问模板或改进后的表达方式)
      </instruction>

      <conversation_data>
      `;
          const sessionsXml = paginatedData
            .map((s) => {
              const title =
                s.sessionTitle || s.questions[0]?.slice(0, 50) + '...';
              return `  <session id="${s.sessionId}" project="${s.projectName}" title="${title}">
      <questions>
      ${s.questions.map((q: string) => `      <q>${q.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</q>`).join('\n')}
      </questions>
      </session>`;
            })
            .join('\n');

          const promptFooter = `
      </conversation_data>

      请根据上述数据开始你的专业审计。`;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.send(`${promptHeader}${sessionsXml}${promptFooter}`);
        }

        const markdown = paginatedData
          .map((s) => {
            const title =
              s.sessionTitle || s.questions[0]?.slice(0, 50) + '...';
            return `### Session: ${title} (Project: ${s.projectName})\n${s.questions.map((q: string) => `- ${q}`).join('\n')}`;
          })
          .join('\n\n');

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(markdown);
      }

      res.json({
        total: userQuestions.length,
        data: paginatedData,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/user-questions/stats', async (req, res) => {
    try {
      const sessions = manager.getAllSessions();
      const statsMap: Record<
        string,
        {
          projectName: string;
          sessionCount: number;
          avgScore: number;
          totalQuestions: number;
          totalScore: number;
        }
      > = {};

      sessions.forEach((s) => {
        if (!statsMap[s.projectName]) {
          statsMap[s.projectName] = {
            projectName: s.projectName,
            sessionCount: 0,
            avgScore: 0,
            totalQuestions: 0,
            totalScore: 0,
          };
        }
        const userQCount = s.messages.filter((m) => m.type === 'user').length;
        if (userQCount > 0) {
          statsMap[s.projectName].sessionCount++;
          statsMap[s.projectName].totalQuestions += userQCount;
          statsMap[s.projectName].totalScore += s.expressionQuality.score;
        }
      });

      const result = Object.values(statsMap)
        .filter((stat) => stat.sessionCount > 0)
        .map((stat) => ({
          projectName: stat.projectName,
          sessionCount: stat.sessionCount,
          totalQuestions: stat.totalQuestions,
          avgScore: Math.round(stat.totalScore / stat.sessionCount),
        }))
        .sort((a, b) => b.totalQuestions - a.totalQuestions);

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // --- Session API ---
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
