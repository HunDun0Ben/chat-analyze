/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Refactored Sidebar with Filename Titles
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Folder, MessageSquare, Zap, ChevronRight, LayoutDashboard, Database, Sparkles, MessageCircle } from 'lucide-react';
import { fetchProjects, fetchSessions } from '../../api';
import type { AnalyzedSession } from '../../types';
import { cn } from '../../utils';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';

type ProviderType = 'gemini' | 'chatgpt';

export function Sidebar() {
  const [activeProvider, setActiveProvider] = useState<ProviderType>('gemini');
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AnalyzedSession[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProjects(activeProvider).then(setProjects);
    setSelectedProject(null);
    setSessions([]);
  }, [activeProvider]);

  useEffect(() => {
    if (selectedProject) {
      fetchSessions(selectedProject).then(setSessions);
    }
  }, [selectedProject]);

  const filteredProjects = projects.filter(p => p.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { id: 'gemini', label: 'Gemini', icon: <Sparkles size={14} />, activeColor: "text-blue-400 border-blue-500 bg-blue-500/5" },
    { id: 'chatgpt', label: 'ChatGPT', icon: <MessageCircle size={14} />, activeColor: "text-emerald-400 border-emerald-500 bg-emerald-500/5" }
  ];

  return (
    <aside className="w-72 border-r border-[var(--card-border)] bg-[var(--sidebar-bg)] flex flex-col h-full shrink-0 z-20">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <div className="font-bold text-white tracking-tight">Gemini Audit</div>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={14} />
          <input 
            type="text" 
            placeholder={`Search ${activeProvider}...`} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-black transition-all"
          />
        </div>
      </div>

      <Tabs 
        tabs={tabs} 
        activeTab={activeProvider} 
        onTabChange={(id) => {
          setActiveProvider(id as any);
          setSelectedProject(null);
          setSessions([]);
        }} 
        className="mx-4 mb-4 border-b-0 gap-1"
      />

      <nav className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
        <NavLink 
          to="/"
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-4",
            isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-white/5"
          )}
        >
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>

        <div className="pt-2 pb-2 px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
          {activeProvider === 'gemini' ? 'Active Projects' : 'Imported History'}
        </div>

        {activeProvider === 'gemini' ? (
          // Gemini View: Classic Project Tree
          filteredProjects.map((project) => (
            <div key={project} className="space-y-1">
              <button 
                onClick={() => setSelectedProject(selectedProject === project ? null : project)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group",
                  selectedProject === project ? "bg-white/5 text-blue-400" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <Folder size={16} className={selectedProject === project ? "text-blue-500" : "text-slate-600"} />
                  <span className="truncate max-w-[140px]">{project}</span>
                </div>
                <ChevronRight size={14} className={cn("transition-transform text-slate-700", selectedProject === project && "rotate-90 text-blue-500")} />
              </button>

              {selectedProject === project && (
                <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200">
                  {sessions.map((session) => (
                    <SessionLink key={session.sessionId} session={session} />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          // ChatGPT View: Handle single folder flat display and grouped display
          <div className="space-y-1">
            {filteredProjects.map((group) => (
               <ChatGPTGroup key={group} title={group} />
            ))}
          </div>
        )}
      </nav>

      <div className="p-6 mt-auto border-t border-[var(--card-border)] bg-black/20">
        <div className="bg-gradient-to-br from-blue-600/10 to-emerald-600/10 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tighter">
            <Database size={12} className="text-blue-400" /> Database Healthy
          </div>
          <div className="text-[10px] text-slate-500 leading-snug">
            AI sessions indexed from {activeProvider} source.
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChatGPTGroup({ title }: { title: string }) {
  const [sessions, setSessions] = useState<AnalyzedSession[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded || title === 'Imported') {
      fetchSessions(title).then(setSessions);
    }
  }, [expanded, title]);

  // 如果项目名为 'Imported'（表示文件直接在根目录下），则不显示折叠层，直接平铺
  if (title === 'Imported') {
    return (
      <div className="space-y-1">
        {sessions.map(s => <SessionLink key={s.sessionId} session={s} variant="emerald" />)}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button 
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group",
          expanded ? "bg-white/5 text-emerald-400" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
        )}
      >
        <div className="flex items-center gap-3">
          <MessageCircle size={16} className={expanded ? "text-emerald-500" : "text-slate-600"} />
          <span className="truncate max-w-[140px] text-left">{title}</span>
        </div>
        <ChevronRight size={14} className={cn("transition-transform text-slate-700", expanded && "rotate-90 text-emerald-500")} />
      </button>
      {expanded && (
        <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200">
          {sessions.map(s => <SessionLink key={s.sessionId} session={s} variant="emerald" />)}
        </div>
      )}
    </div>
  );
}

function SessionLink({ session, variant = 'blue' }: { session: AnalyzedSession, variant?: 'blue' | 'emerald' }) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
  };

  // 优先级：sessionTitle (文件名) -> messages[0] -> sessionId
  const displayTitle = session.sessionTitle || session.messages.find(m => m.type === 'user')?.content || session.sessionId;

  return (
    <NavLink
      to={`/session/${session.sessionId}`}
      className={({ isActive }) => cn(
        "flex flex-col gap-1.5 p-3 rounded-xl transition-all group border border-transparent",
        isActive ? colors[variant] : "hover:bg-white/5 text-slate-500 hover:text-slate-300"
      )}
    >
      {({ isActive }) => (
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
             <div className={cn(
               "text-[11px] font-bold truncate leading-tight mb-0.5",
               isActive ? (variant === 'blue' ? "text-blue-300" : "text-emerald-300") : "text-slate-300 group-hover:text-white"
             )}>
               {displayTitle}
             </div>
             
             <div className="flex items-center justify-between mt-1 gap-2">
               <span className={cn(
                 "font-mono text-[10px] font-bold tracking-tight shrink-0",
                 isActive 
                   ? (variant === 'blue' ? "text-blue-200" : "text-emerald-200") 
                   : (variant === 'blue' ? "text-blue-500/80" : "text-emerald-500/80")
               )}>
                 {session.sessionId.substring(0, 8)}
               </span>

               <span className="text-[9px] font-medium opacity-40 whitespace-nowrap overflow-hidden text-right">
                 {new Date(session.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
               </span>
             </div>
          </div>

          <Badge 
            variant={session.expressionQuality.score >= 80 ? 'secondary' : 'primary'}
            className="shrink-0 mt-0.5"
          >
            {session.expressionQuality.score}
          </Badge>
        </div>
      )}
    </NavLink>
  );
}
