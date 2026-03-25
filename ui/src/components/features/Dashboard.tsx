import { useState, useEffect } from 'react';
import { TrendingUp, Activity, Cpu, Brain, Award, ShieldCheck, Loader2 } from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { fetchStatsTimeline, fetchModelStats } from '../api';
import type { StatsTimeline, ModelStat } from '../types';

export function Dashboard() {
  const [data, setData] = useState<StatsTimeline[]>([]);
  const [models, setModels] = useState<ModelStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStatsTimeline(), fetchModelStats()])
      .then(([timeline, modelStats]) => {
        setData(timeline);
        setModels(modelStats);
        setLoading(false);
      });
  }, []);

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
          <div className="text-[10px] font-bold text-slate-600 uppercase">Analysis Engine</div>
          <div className="text-xs text-slate-400 font-mono">v1.1.0-EVOLUTION</div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-slate-800" /></div>
      ) : (
        <div className="space-y-12 max-w-7xl mx-auto w-full">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Growth Chart */}
            <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--card-border)] p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={120} />
              </div>
              <div className="flex items-center gap-2 mb-8">
                 <div className="bg-blue-500/10 p-2 rounded-lg"><TrendingUp size={16} className="text-blue-500" /></div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expression Growth Curve</span>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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
            </div>

            {/* Model Comparison */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] p-8 rounded-[2rem] shadow-2xl flex flex-col">
               <div className="flex items-center gap-2 mb-8">
                 <div className="bg-emerald-500/10 p-2 rounded-lg"><Cpu size={16} className="text-emerald-500" /></div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Model IQ Comparison</span>
               </div>
               <div className="flex-1 flex flex-col justify-center gap-6">
                 {models.map((m) => (
                   <div key={m.modelId} className="space-y-2">
                     <div className="flex justify-between items-end text-[11px]">
                       <span className="font-bold text-slate-300 truncate max-w-[140px]">{m.modelId}</span>
                       <span className="text-emerald-500 font-mono font-bold">{m.avgScore.toFixed(1)}%</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                       <div 
                        className="h-full bg-emerald-500/40 rounded-full" 
                        style={{ width: `${m.avgScore}%` }} 
                       />
                     </div>
                     <div className="flex justify-between text-[9px] text-slate-600">
                       <span>{m.sessionCount} Sessions</span>
                       <span>Avg. {Math.round(m.avgTokens / 1000)}k tokens</span>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
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

function InsightCard({ icon, title, value, desc }: { icon: React.ReactNode, title: string, value: string, desc: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-3 hover:bg-white/[0.04] transition-colors group">
      <div className="flex items-center gap-3">
        <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">{icon}</div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-white truncate">{value}</div>
        <div className="text-[10px] text-slate-600 leading-tight mt-1">{desc}</div>
      </div>
    </div>
  );
}
