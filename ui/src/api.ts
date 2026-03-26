export const API_BASE = 'http://localhost:3001/api';

export const fetchProjects = (provider?: 'gemini' | 'chatgpt') => {
  const url = provider ? `${API_BASE}/projects?provider=${provider}` : `${API_BASE}/projects`;
  return fetch(url).then(r => r.json());
};

export const fetchSessions = (slug: string) => fetch(`${API_BASE}/projects/${encodeURIComponent(slug)}/sessions`).then(r => r.json());

export const fetchSessionsSummary = () => fetch(`${API_BASE}/sessions/summary`).then(r => r.json());

export const fetchSessionDetail = (id: string) => fetch(`${API_BASE}/sessions/${id}`).then(r => {
  if (!r.ok) throw new Error('Not Found');
  return r.json();
});

export const fetchStatsTimeline = () => fetch(`${API_BASE}/stats/timeline`).then(r => r.json());

export const fetchModelStats = () => fetch(`${API_BASE}/stats/models`).then(r => r.json());

export const exportSkill = (id: string) => fetch(`${API_BASE}/sessions/${id}/export-skill`, { method: 'POST' }).then(r => r.json());
