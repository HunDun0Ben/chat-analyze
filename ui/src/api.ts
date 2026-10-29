import type {
  AnalyzedSession,
  ModelStat,
  ProjectStat,
  Provider,
  SessionIndexEntry,
  StatsSummary,
  StatsTimelinePoint,
  UserQuestionsResponse,
} from '@chat-analyze/shared';

export const API_BASE = 'http://localhost:3001/api';

/** Narrow `fetch(...).json()` (typed `any`) once, at the network boundary. */
async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

export const fetchProjects = (provider?: Provider): Promise<string[]> =>
  getJson(
    provider
      ? `${API_BASE}/projects?provider=${provider}`
      : `${API_BASE}/projects`,
  );

export const fetchSessions = (slug: string): Promise<AnalyzedSession[]> =>
  getJson(`${API_BASE}/projects/${encodeURIComponent(slug)}/sessions`);

export const fetchSessionsSummary = (): Promise<SessionIndexEntry[]> =>
  getJson(`${API_BASE}/sessions/summary`);

export const fetchSessionDetail = (id: string): Promise<AnalyzedSession> =>
  getJson(`${API_BASE}/sessions/${id}`);

export const fetchStatsSummary = (): Promise<StatsSummary> =>
  getJson(`${API_BASE}/stats/summary`);

export const fetchStatsTimeline = (): Promise<StatsTimelinePoint[]> =>
  getJson(`${API_BASE}/stats/timeline`);

export const fetchModelStats = (): Promise<ModelStat[]> =>
  getJson(`${API_BASE}/stats/models`);

export const fetchUserQuestions = (
  params: {
    project?: string;
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {},
): Promise<UserQuestionsResponse> => {
  const query = new URLSearchParams();
  if (params.project) query.append('project', params.project);
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.offset) query.append('offset', params.offset.toString());
  if (params.minScore) query.append('minScore', params.minScore.toString());

  return getJson(`${API_BASE}/user-questions?${query.toString()}`);
};

export const fetchUserQuestionsStats = (): Promise<ProjectStat[]> =>
  getJson(`${API_BASE}/user-questions/stats`);

export const exportSkill = (
  id: string,
): Promise<{ success: boolean; path?: string; error?: string }> =>
  getJson(`${API_BASE}/sessions/${id}/export-skill`, { method: 'POST' });
