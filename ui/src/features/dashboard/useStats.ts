/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Dashboard Stats Hook
 */

import { useState, useEffect } from 'react';
import { fetchStatsTimeline, fetchModelStats } from '../../api';
import type { StatsTimeline, ModelStat } from '../../types';

export function useStats() {
  const [data, setData] = useState<StatsTimeline[]>([]);
  const [models, setModels] = useState<ModelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatsTimeline(), fetchModelStats()])
      .then(([timeline, modelStats]) => {
        setData(timeline);
        setModels(modelStats);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, models, loading, error };
}
