export const API_BASE = 'http://localhost:3001/api';

export const fetchProjects = (provider?: 'gemini' | 'chatgpt') => {
  const url = provider
    ? `${API_BASE}/projects?provider=${provider}`
    : `${API_BASE}/projects`;
  return fetch(url).then((r) => r.json());
};

export const fetchSessions = (slug: string) =>
  fetch(`${API_BASE}/projects/${encodeURIComponent(slug)}/sessions`).then((r) =>
    r.json(),
  );

export const fetchSessionsSummary = () =>
  fetch(`${API_BASE}/sessions/summary`).then((r) => r.json());

export const fetchSessionDetail = (id: string) =>
  fetch(`${API_BASE}/sessions/${id}`).then((r) => {
    if (!r.ok) throw new Error('Not Found');
    return r.json();
  });

export const fetchStatsTimeline = () =>
  fetch(`${API_BASE}/stats/timeline`).then((r) => r.json());

export const fetchModelStats = () =>
  fetch(`${API_BASE}/stats/models`).then((r) => r.json());

export const fetchUserQuestions = (
  params: {
    project?: string;
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {},
) => {
  const query = new URLSearchParams();
  if (params.project) query.append('project', params.project);
  if (params.limit) query.append('limit', params.limit.toString());
  if (params.offset) query.append('offset', params.offset.toString());
  if (params.minScore) query.append('minScore', params.minScore.toString());

  return fetch(`${API_BASE}/user-questions?${query.toString()}`).then((r) =>
    r.json(),
  );
};

export const fetchUserQuestionsStats = () =>
  fetch(`${API_BASE}/user-questions/stats`).then((r) => r.json());

export const exportSkill = (id: string) =>
  fetch(`${API_BASE}/sessions/${id}/export-skill`, { method: 'POST' }).then(
    (r) => r.json(),
  );
