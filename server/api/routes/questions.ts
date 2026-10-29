import type express from 'express';
import type { RouteDeps } from '../types.js';
import { parseUserQuestionsQuery } from '../query.js';
import {
  collectUserQuestions,
  renderQuestionList,
} from '../services/UserQuestionsService.js';
import {
  buildCoachAuditPrompt,
  buildSkillExtractionPrompt,
} from '../services/PromptBuilder.js';

/** `GET /api/user-questions` (JSON, markdown or a ready-to-send prompt). */
export function registerQuestionRoutes(
  app: express.Express,
  deps: RouteDeps,
): void {
  app.get('/api/user-questions', async (req, res) => {
    const {
      project,
      category,
      minScore,
      maxScore,
      limit,
      offset,
      format,
      includePrompt,
      mode,
    } = parseUserQuestionsQuery(req.query);

    const userQuestions = collectUserQuestions(deps.manager.getAllSessions(), {
      project,
      category,
      minScore,
      maxScore,
    });
    const paginatedData = userQuestions.slice(offset, offset + limit);

    const wantsText =
      req.headers.accept?.includes('text/plain') ||
      format === 'text' ||
      format === 'prompt';

    if (!wantsText) {
      return res.json({ total: userQuestions.length, data: paginatedData });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    if (format === 'prompt' || includePrompt === 'true') {
      const context = {
        project,
        skillsDir: deps.exportsDir,
        sessions: paginatedData,
      };
      return res.send(
        mode === 'skill'
          ? buildSkillExtractionPrompt(context)
          : buildCoachAuditPrompt(context),
      );
    }

    return res.send(renderQuestionList(paginatedData));
  });

  app.get('/api/user-questions/stats', async (req, res) => {
    res.json(deps.stats.byProject(deps.manager.getAllSessions()));
  });
}
