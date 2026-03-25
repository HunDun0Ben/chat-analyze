/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Refactored SessionInspector
 */

import { Activity, Zap, MessageSquare, ShieldCheck, BarChart3, Download, Loader2, CheckCircle2, ArrowUpRight } from 'lucide-react';
import type { AnalyzedSession } from '../../types';
import { cn } from '../../utils';
import { useSessionExport } from '../../features/session/useSession';
import { Tabs } from '../ui/Tabs';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { TokenBar } from './TokenBar';
import { Button } from '../ui/Button';
import { useState } from 'react';

export function SessionInspector({ 
  session, 
  onSelectMessage, 
  isCollapsed 
}: { 
  session: AnalyzedSession, 
  onSelectMessage?: (id: string) => void,
  isCollapsed?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'intel' | 'timeline'>('timeline');
  const { handleExport, exporting, exported } = useSessionExport();

  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-emerald-500';
    if (s >= 70) return 'text-amber-500';
    return 'text-rose-500';
  };

  const tabs = [
    { id: 'timeline', label: 'Timeline', icon: <MessageSquare size={14} /> },
    { id: 'intel', label: 'Intel', icon: <Activity size={14} />, activeColor: "text-blue-400 bg-blue-500/5 border-blue-500" }
  ];

  return (
    <aside className={cn(
      "border-l border-[var(--card-border)] bg-[var(--sidebar-bg)]/30 flex flex-col h-full shrink-0 transition-all duration-300 overflow-hidden",
      isCollapsed ? "w-0 border-l-0" : "w-80"
    )}>
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={(id) => setActiveTab(id as any)} 
      />
      
      <div className="flex-1 overflow-y-auto min-w-[320px]">
        {activeTab === 'intel' ? (
          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Quality Score */}
            <div className="space-y-4">
               <div className="flex justify-between items-end">
                 <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Expression Score</div>
                 <div className={cn("text-2xl font-black font-mono leading-none", getScoreColor(session.expressionQuality.score))}>
                   {session.expressionQuality.score}
                 </div>
               </div>
               <Progress 
                 value={session.expressionQuality.score} 
                 indicatorClassName={cn(
                   session.expressionQuality.score >= 90 ? 'bg-emerald-500' : 
                   session.expressionQuality.score >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                 )}
               />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Category</div>
                <div className="text-xs font-bold text-blue-400 flex items-center gap-1">
                  <Zap size={10} /> {session.category}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[9px] text-slate-500 font-bold mb-1 uppercase">Total Turns</div>
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <MessageSquare size={10} className="text-slate-400" /> {session.stats.turns}
                </div>
              </div>
            </div>

            {/* Coach Suggestion */}
            <div className="bg-blue-600/5 rounded-xl p-4 border border-blue-500/20 space-y-3">
              <div className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
                <ShieldCheck size={14} /> Coach Suggestion
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{session.expressionQuality.suggestion}"
              </p>
              {session.expressionQuality.ambiguities.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1.5 border-t border-blue-500/10">
                  {session.expressionQuality.ambiguities.map((a, i) => (
                    <Badge key={i} variant="primary" className="whitespace-nowrap">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Resource Usage */}
            <div className="space-y-4">
               <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter flex items-center gap-2">
                 <BarChart3 size={12} /> Resource Usage
               </div>
               <div className="space-y-2">
                 <TokenBar label="Total Tokens" value={session.stats.tokenUsage.total} max={100000} color="bg-blue-500/40" />
                 <TokenBar label="Input (Prompt)" value={session.stats.tokenUsage.input} max={100000} color="bg-slate-700" />
                 <TokenBar label="Output (Gemini)" value={session.stats.tokenUsage.output} max={20000} color="bg-emerald-500/40" />
               </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-4">Chat Timeline</div>
            <div className="space-y-1">
              {session.messages.filter(m => m.type !== 'info').map((m) => (
                <button 
                  key={m.id} 
                  onClick={() => onSelectMessage?.(m.id)}
                  className="w-full text-left group relative pl-6 pb-4 border-l border-slate-800 last:pb-0 block"
                >
                  <div className={cn(
                    "absolute left-[-4.5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-slate-900 transition-colors",
                    m.type === 'user' ? "bg-slate-600 group-hover:bg-slate-400" : "bg-blue-500 group-hover:bg-blue-400"
                  )} />
                  <div className="text-[9px] font-mono text-slate-600 mb-1 flex justify-between">
                    <span className={m.type === 'user' ? "text-slate-500" : "text-blue-400/80"}>
                      {m.type === 'user' ? 'USER' : session.modelId}
                    </span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={cn(
                    "text-[11px] leading-snug truncate-2-lines p-2 rounded-md border transition-all",
                    m.type === 'user' 
                      ? "bg-slate-900/40 border-slate-800/50 text-slate-400 group-hover:bg-slate-800/60 group-hover:border-slate-700" 
                      : "bg-blue-500/5 border-blue-500/10 text-slate-300 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 group-hover:text-white"
                  )}>
                    {m.content?.substring(0, 60)}{m.content?.length > 60 ? '...' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-auto p-6 border-t border-[var(--card-border)] shrink-0 space-y-3 bg-[var(--sidebar-bg)]/50 min-w-[320px]">
        <Button 
          variant={exported ? 'success' : 'primary'}
          onClick={() => handleExport(session.sessionId)}
          disabled={exporting}
          className="w-full"
        >
          {exporting ? <Loader2 className="animate-spin" size={14} /> : exported ? <CheckCircle2 size={14} /> : <Download size={14} />}
          {exported ? "Skill Exported" : "Incubate to SKILL.md"}
        </Button>
        <Button variant="secondary" className="w-full">
          Generate Full Report <ArrowUpRight size={14} />
        </Button>
      </div>
    </aside>
  );
}
