/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Refactored Dashboard
 */

import { TrendingUp, Activity, Cpu, Brain, Award, ShieldCheck, Loader2 } from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useStats } from '../../features/dashboard/useStats';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { InsightCard } from './InsightCard';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';

export function Dashboard() {
  const { data, models, loading } = useStats();

  return (
    <div className="flex-1 flex flex-col bg-[var(--app-bg)] overflow-y-auto p-12 space-y-12 pb-32">
      <div className="flex justify-between items-end max-w-7xl mx-auto w-full">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-[0.2em]">
             <TrendingUp size={14} /> Efficiency Evolver
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Intelligence Dashboard</h1>
        </div>
        <div className="text-right space-y-1">
          <Badge variant="ghost">Analysis Engine</Badge>
          <div className="text-xs text-slate-400 font-mono">v1.1.0-EVOLUTION</div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-800" />
        </div>
      ) : (
        <div className="space-y-12 max-w-7xl mx-auto w-full">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Growth Chart */}
            <Card className="lg:col-span-2 group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={120} />
              </div>
              <CardHeader className="flex flex-row items-center gap-2">
                 <div className="bg-blue-500/10 p-2 rounded-lg"><TrendingUp size={16} className="text-blue-500" /></div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expression Growth Curve</span>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} dy={10} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} dx={-10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={3} fill="url(#colorScore)" animationDuration={2000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Model Comparison */}
            <Card className="flex flex-col">
               <CardHeader className="flex flex-row items-center gap-2">
                 <div className="bg-emerald-500/10 p-2 rounded-lg"><Cpu size={16} className="text-emerald-500" /></div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Model IQ Comparison</span>
               </CardHeader>
               <CardContent className="flex-1 flex flex-col justify-center gap-6">
                 {models.map((m) => (
                   <div key={m.modelId} className="space-y-2">
                     <div className="flex justify-between items-end text-[11px]">
                       <span className="font-bold text-slate-300 truncate max-w-[140px]">{m.modelId}</span>
                       <span className="text-emerald-500 font-mono font-bold">{m.avgScore.toFixed(1)}%</span>
                     </div>
                     <Progress value={m.avgScore} indicatorClassName="bg-emerald-500/40" />
                     <div className="flex justify-between text-[9px] text-slate-600">
                       <span>{m.sessionCount} Sessions</span>
                       <span>Avg. {Math.round(m.avgTokens / 1000)}k tokens</span>
                     </div>
                   </div>
                 ))}
               </CardContent>
            </Card>
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-3 gap-6">
            <InsightCard 
              icon={<Brain className="text-amber-500" />} 
              title="Intelligence Peak" 
              value={data.length > 0 ? `${Math.max(...data.map(d => d.avgScore))}%` : '--'}
              desc="Highest daily average prompt quality"
            />
            <InsightCard 
              icon={<Award className="text-blue-500" />} 
              title="Champion Model" 
              value={models[0]?.modelId.split('/').pop() || '--'}
              desc="Best performing model by avg score"
            />
            <InsightCard 
              icon={<ShieldCheck className="text-emerald-500" />} 
              title="Skill Potentials" 
              value="12" 
              desc="High-score sessions ready for incubation"
            />
          </div>
        </div>
      )}
    </div>
  );
}
