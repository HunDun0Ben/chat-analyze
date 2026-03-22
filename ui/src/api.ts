export const API_BASE = 'http://localhost:3001/api';

export const fetchProjects = () => fetch(`${API_BASE}/projects`).then(r => r.json());

export const fetchSessions = (slug: string) => fetch(`${API_BASE}/projects/${slug}/sessions`).then(r => r.json());

export const fetchSessionDetail = (id: string) => fetch(`${API_BASE}/sessions/${id}`).then(r => {
  if (!r.ok) throw new Error('Not Found');
  return r.json();
});

export const fetchStatsTimeline = () => fetch(`${API_BASE}/stats/timeline`).then(r => r.json());

export const fetchModelStats = () => fetch(`${API_BASE}/stats/models`).then(r => r.json());

export const exportSkill = (id: string) => fetch(`${API_BASE}/sessions/${id}/export-skill`, { method: 'POST' }).then(r => r.json());
