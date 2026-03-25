/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Refactored Sidebar
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Folder, MessageSquare, Plus, Zap, ChevronRight, LayoutDashboard, Database } from 'lucide-react';
import { fetchProjects, fetchSessions } from '../../api';
import type { AnalyzedSession } from '../../types';
import { cn } from '../../utils';
import { Badge } from '../ui/Badge';

export function Sidebar() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AnalyzedSession[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchSessions(selectedProject).then(setSessions);
    }
  }, [selectedProject]);

  const filteredProjects = projects.filter(p => p.toLowerCase().includes(search.toLowerCase()));

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
            placeholder="Search projects..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-black transition-all"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
        <NavLink 
          to="/"
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all",
            isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-white/5"
          )}
        >
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>

        <div className="pt-6 pb-2 px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center justify-between">
          <span>Active Projects</span>
          <Plus size={12} className="cursor-pointer hover:text-white transition-colors" />
        </div>

        {filteredProjects.map((project) => (
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
                  <NavLink
                    key={session.sessionId}
                    to={`/session/${session.sessionId}`}
                    className={({ isActive }) => cn(
                      "flex flex-col gap-1 p-3 rounded-xl transition-all group border border-transparent",
                      isActive ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "hover:bg-white/5 text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                         <MessageSquare size={12} className={cn(selectedProject === project ? "opacity-100" : "opacity-40")} />
                         <span className="text-[11px] font-bold truncate max-w-[120px]">
                           {new Date(session.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                         </span>
                      </div>
                      <Badge variant={session.expressionQuality.score >= 80 ? 'secondary' : 'primary'}>
                        {session.expressionQuality.score}
                      </Badge>
                    </div>
                    <div className="text-[9px] font-mono opacity-40 truncate">
                      {session.sessionId.substring(0, 12)}
                    </div>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-[var(--card-border)] bg-black/20">
        <div className="bg-gradient-to-br from-blue-600/10 to-emerald-600/10 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tighter">
            <Database size={12} className="text-blue-400" /> Database Healthy
          </div>
          <div className="text-[10px] text-slate-500 leading-snug">
            All AI sessions are safely stored in your local encrypted vault.
          </div>
        </div>
      </div>
    </aside>
  );
}
