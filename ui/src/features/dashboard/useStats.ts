import { useQuery } from '@tanstack/react-query';
import { fetchStatsTimeline, fetchModelStats } from '../../api';
import type { StatsTimelinePoint, ModelStat } from '@chat-analyze/shared';

export function useStats() {
  const {
    data: timelineData,
    isLoading: timelineLoading,
    error: timelineError,
  } = useQuery<StatsTimelinePoint[]>({
    queryKey: ['dashboardStatsTimeline'],
    queryFn: fetchStatsTimeline,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: modelStatsData,
    isLoading: modelStatsLoading,
    error: modelStatsError,
  } = useQuery<ModelStat[]>({
    queryKey: ['dashboardModelStats'],
    queryFn: fetchModelStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = Array.isArray(timelineData) ? timelineData : [];
  const models = Array.isArray(modelStatsData) ? modelStatsData : [];
  const loading = timelineLoading || modelStatsLoading;
  const error = (timelineError || modelStatsError) as Error | null;

  return { data, models, loading, error };
}
