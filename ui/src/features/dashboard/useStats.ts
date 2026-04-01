import { useQuery } from '@tanstack/react-query';
import { fetchStatsTimeline, fetchModelStats } from '../../api';
import type { StatsTimeline, ModelStat } from '../../types';

export function useStats() {
  const { data: timelineData, isLoading: timelineLoading, isError: timelineError } = useQuery<StatsTimeline[]>({
    queryKey: ['dashboardStatsTimeline'],
    queryFn: fetchStatsTimeline,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: modelStatsData, isLoading: modelStatsLoading, isError: modelStatsError } = useQuery<ModelStat[]>({
    queryKey: ['dashboardModelStats'],
    queryFn: fetchModelStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = Array.isArray(timelineData) ? timelineData : [];
  const models = Array.isArray(modelStatsData) ? modelStatsData : [];
  const loading = timelineLoading || modelStatsLoading;
  const error = timelineError || modelStatsError;

  return { data, models, loading, error };
}
