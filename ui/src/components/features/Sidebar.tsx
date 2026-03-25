import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ChevronRight, ChevronDown, Hash, Loader2, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { fetchProjects, fetchSessions } from '../api';
import type { SessionSummary } from '../types';
import { cn } from '../utils';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects()
      .then(projs => {
        setProjects(projs);
        if (projs.length > 0) setExpanded([projs[0]]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredProjects = projects.filter(p => 
    p.toLowerCase().includes(search.toLowerCase())
  );

  const toggleProject = (p: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setExpanded([p]);
      return;
    }
    setExpanded(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <div className={cn(
      "bg-[var(--sidebar-bg)] text-slate-400 flex flex-col h-screen border-r border-[var(--card-border)] shrink-0 z-20 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4 h-16 border-b border-[var(--card-border)] overflow-hidden">
        {!isCollapsed && (
          <Link to="/" className="flex items-center gap-3 font-bold text-white hover:text-blue-400 transition-colors truncate">
            <div className="bg-blue-600/20 p-1.5 rounded-lg border border-blue-500/30 shrink-0">
              <LayoutDashboard size={18} className="text-blue-400" />
            </div>
            <span className="tracking-tight text-sm truncate animate-in fade-in slide-in-from-left-2">Chat Analyze</span>
          </Link>
        )}
        {isCollapsed && (
          <div className="bg-blue-600/20 p-1.5 rounded-lg border border-blue-500/30 mx-auto">
            <LayoutDashboard size={18} className="text-blue-400" />
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-md hover:bg-white/5 text-slate-600 hover:text-white transition-all",
            isCollapsed && "mt-2"
          )}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-3 animate-in fade-in slide-in-from-top-2">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors" />
            <input 
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/50 border border-[var(--card-border)] rounded-md py-1.5 pl-9 pr-3 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-700"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-4">
        <div className={cn(isCollapsed && "flex flex-col items-center")}>
          {!isCollapsed && (
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
              <Hash size={10} /> Projects
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center p-2 text-xs text-slate-600"><Loader2 size={12} className="animate-spin" /></div>
          ) : filteredProjects.length === 0 ? (
            !isCollapsed && <div className="px-2 py-4 text-[11px] text-slate-600 italic">No projects found</div>
          ) : filteredProjects.map(p => (
            <div key={p} className="mb-1">
              <button 
                onClick={() => toggleProject(p)}
                title={isCollapsed ? p : undefined}
                className={cn(
                  "w-full flex items-center gap-2 p-2 hover:bg-white/5 rounded-md transition-all text-[13px] group",
                  expanded.includes(p) && !isCollapsed && "text-white",
                  isCollapsed && "justify-center"
                )}
              >
                {isCollapsed ? (
                   <div className="w-8 h-8 flex items-center justify-center bg-slate-800/50 rounded-md border border-white/5 text-[10px] font-bold uppercase text-slate-500 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all">
                     {p.split('/').pop()?.substring(0, 2)}
                   </div>
                ) : (
                  <>
                    {expanded.includes(p) ? <ChevronDown size={14} className="text-slate-600" /> : <ChevronRight size={14} className="text-slate-600" />}
                    <span className="truncate flex-1 text-left">{p}</span>
                  </>
                )}
              </button>
              {expanded.includes(p) && !isCollapsed && <ProjectSessions slug={p} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectSessions({ slug }: { slug: string }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  useEffect(() => {
    fetchSessions(slug).then(setSessions);
  }, [slug]);

  return (
    <div className="ml-3 mt-1 pl-3 border-l border-[var(--card-border)] space-y-1">
      {sessions.map(s => (
        <Link 
          key={s.sessionId}
          to={`/session/${s.sessionId}`}
          className="group block p-2 text-[11px] hover:text-white hover:bg-white/5 rounded transition-all truncate"
        >
          <div className="flex justify-between items-center">
            <span className="truncate">{s.sessionId.substring(0, 10)}...</span>
            <span className="text-[9px] text-slate-600 group-hover:text-slate-500 font-mono">
              {new Date(s.startTime).toLocaleDateString([], {month: 'numeric', day: 'numeric'})}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
