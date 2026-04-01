import { useMemo } from 'react';
import {
  TrendingUp,
  Activity,
  Cpu,
  Brain,
  Award,
  ShieldCheck,
  Loader2,
  AlertCircle,
  BarChart2,
  Users,
  MessageSquare,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useStats } from '../../features/dashboard/useStats';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useTheme } from '../../features/theme/useTheme';

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

export function Dashboard() {
  const { data, models, loading, error } = useStats();
  const { theme } = useTheme();

  const summary = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalSessions: 0,
        totalTokens: 0,
        averageTokens: 0,
        peakScore: 0,
      };
    }
    const totalSessions = data.reduce((sum, d) => sum + d.sessionCount, 0);
    const totalTokens = data.reduce((sum, d) => sum + d.totalTokens, 0);
    const peakScore = Math.max(...data.map((d) => d.avgScore));
    const averageTokens = totalSessions > 0 ? totalTokens / totalSessions : 0;
    return {
      totalSessions,
      totalTokens,
      averageTokens: Math.round(averageTokens),
      peakScore: Math.round(peakScore),
    };
  }, [data]);

  const championModel = useMemo(() => {
    if (!models || models.length === 0) return null;
    return [...models].sort((a, b) => b.avgScore - a.avgScore)[0];
  }, [models]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <h3 className="font-bold text-lg text-[var(--text-main)]">
            Loading stats...
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Please wait while we crunch the numbers.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">
          Error: {error.message}
        </h2>
        <p className="text-[var(--text-muted)] max-w-md">
          Failed to load dashboard data. Please ensure the server is running
          and accessible.
        </p>
      </div>
    );
  }

  const chartColors = {
    grid: theme === 'dark' ? 'hsl(var(--border))' : 'hsl(var(--border))',
    tick: 'hsl(var(--muted-foreground))',
    tooltipBg: 'hsl(var(--background))',
    tooltipBorder: 'hsl(var(--border))',
  };

  return (
    <main className="flex-1 bg-[var(--app-bg)] p-6 sm:p-8 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)]">
            Intelligence Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            An overview of your agent's performance and evolution.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Sessions
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalSessions}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(summary.totalTokens)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Tokens/Session
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(summary.averageTokens)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peak Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.peakScore}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-5">
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Session Growth</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient
                      id="colorScore"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartColors.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartColors.tick, fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartColors.tick, fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      border: `1px solid ${chartColors.tooltipBorder}`,
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorScore)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Model Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center gap-4">
              {models.length > 0 ? (
                [...models]
                  .sort((a, b) => b.avgScore - a.avgScore)
                  .map((m, index) => (
                    <div key={m.modelId}>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="w-8 h-8 flex items-center justify-center"
                        >
                          {index === 0 ? (
                            <Award className="w-4 h-4 text-amber-500" />
                          ) : (
                            index + 1
                          )}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium truncate text-[var(--text-main)]">
                            {m.modelId.split('/').pop()}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {m.sessionCount} sessions
                          </p>
                        </div>
                        <p className="text-lg font-bold text-emerald-500">
                          {m.avgScore.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-center text-[var(--text-muted)]">
                  No model data available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
