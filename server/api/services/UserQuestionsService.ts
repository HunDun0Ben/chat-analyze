import type {
  AnalyzedSession,
  TaskCategory,
  UserQuestionsSession,
} from '../../types/index.js';
import { formatSessionTitle } from '../prompts/format.js';

export interface UserQuestionFilters {
  project?: string;
  category?: TaskCategory;
  minScore?: number;
  maxScore?: number;
}

/**
 * Projects sessions onto the question list used by the questions API.
 * Sessions without any user question are dropped, newest first.
 */
export function collectUserQuestions(
  sessions: AnalyzedSession[],
  filters: UserQuestionFilters,
): UserQuestionsSession[] {
  return sessions
    .filter((session) => {
      if (filters.project && session.projectName !== filters.project) {
        return false;
      }
      if (filters.category && session.category !== filters.category) {
        return false;
      }
      if (
        filters.minScore !== undefined &&
        session.expressionQuality.score < filters.minScore
      ) {
        return false;
      }
      if (
        filters.maxScore !== undefined &&
        session.expressionQuality.score > filters.maxScore
      ) {
        return false;
      }
      return true;
    })
    .map((session) => ({
      sessionId: session.sessionId,
      projectName: session.projectName,
      sessionTitle: session.sessionTitle,
      startTime: session.startTime,
      filePath: session.filePath,
      questions: session.messages
        .filter((message) => message.type === 'user')
        .map((message) => message.content.trim())
        .filter((question) => question.length > 0),
    }))
    .filter((session) => session.questions.length > 0)
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
}

/** Plain-markdown rendering used when the client asks for `format=text`. */
export function renderQuestionList(sessions: UserQuestionsSession[]): string {
  return sessions
    .map(
      (session) =>
        `### Session: ${formatSessionTitle(session)} (Project: ${session.projectName})\n` +
        session.questions.map((question) => `- ${question}`).join('\n'),
    )
    .join('\n\n');
}
