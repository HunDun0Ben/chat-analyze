import type express from 'express';
import type { SessionIndexEntry } from '@chat-analyze/shared';
import type { RouteDeps } from '../types.js';

export function registerSessionRoutes(
  app: express.Express,
  deps: RouteDeps,
): void {
  app.get('/api/sessions/summary', async (req, res) => {
    // Compact projection used by the sidebar and the search index.
    const summary: SessionIndexEntry[] = deps.manager
      .getAllSessions()
      .map((session) => ({
        sessionId: session.sessionId,
        sessionTitle: session.sessionTitle,
        projectName: session.projectName,
        provider: session.provider,
        startTime: session.startTime,
        isCheckpoint: session.isCheckpoint,
        expressionQuality: { score: session.expressionQuality.score },
        // First user message is the title fallback.
        firstMessage:
          session.messages.find((message) => message.type === 'user')
            ?.content || '',
      }));

    res.json(summary);
  });

  app.get('/api/sessions/:id', async (req, res) => {
    const session = deps.manager.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });
}
