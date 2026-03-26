import { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import {
  Search,
  Folder,
  Zap,
  ChevronRight,
  LayoutDashboard,
  Database,
  Sparkles,
  MessageCircle,
  Sun,
  Moon,
} from "lucide-react";
import { fetchProjects, fetchSessions, fetchSessionsSummary } from "../../api";
import type { AnalyzedSession, SidebarSession } from "../../types";
import { cn } from "../../utils";
import { Badge } from "../ui/Badge";
import { Tabs } from "../ui/Tabs";
import { useTheme } from "../../features/theme/useTheme";

type ProviderType = "gemini" | "chatgpt";

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const [activeProvider, setActiveProvider] = useState<ProviderType>("gemini");
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AnalyzedSession[]>([]);
  const [allSessions, setAllSessions] = useState<SidebarSession[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProjects(activeProvider).then(setProjects);
    // 同时获取所有会话概要用于搜索和树构建
    fetchSessionsSummary().then(setAllSessions);
  }, [activeProvider]);

  // 当点击项目且非搜索模式时，加载具体会话
  useEffect(() => {
    if (selectedProject && !search) {
      fetchSessions(selectedProject).then(setSessions);
    }
  }, [selectedProject, search]);

  // --- 核心搜索/过滤逻辑 ---

  // 计算每个项目在搜索模式下的状态
  const projectSearchData = useMemo(() => {
    const terms = search
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (terms.length === 0) return null;

    const results: Record<
      string,
      {
        matches: boolean;
        visibleSessions: SidebarSession[];
      }
    > = {};

    projects.forEach((projectName) => {
      // 检查项目名称是否包含所有关键词
      const projectMatches = terms.every((t) =>
        projectName.toLowerCase().includes(t),
      );
      const projectSessions = allSessions.filter(
        (s) => s.projectName === projectName && s.provider === activeProvider,
      );

      const matchingSessions = projectSessions.filter((s) => {
        // 检查该会话的所有字段“加起来”是否包含所有关键词
        const combinedText = [
          s.sessionId,
          s.projectName,
          s.sessionTitle,
          s.firstMessage,
        ]
          .join(" ")
          .toLowerCase();

        return terms.every((t) => combinedText.includes(t));
      });

      // 规则：目录命中显示全部，否则仅显示匹配的会话
      if (projectMatches || matchingSessions.length > 0) {
        results[projectName] = {
          matches: projectMatches,
          visibleSessions: projectMatches ? projectSessions : matchingSessions,
        };
      }
    });
    return results;
  }, [search, projects, allSessions, activeProvider]);

  const visibleProjectList = search
    ? Object.keys(projectSearchData || {})
    : projects;

  const tabs = [
    {
      id: "gemini",
      label: "Gemini",
      icon: <Sparkles size={14} />,
      activeColor: "text-blue-400 border-blue-500 bg-blue-500/5",
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      icon: <MessageCircle size={14} />,
      activeColor: "text-emerald-400 border-emerald-500 bg-emerald-500/5",
    },
  ];

  return (
    <aside className="w-72 border-r border-[var(--card-border)] bg-[var(--sidebar-bg)] flex flex-col h-full shrink-0 z-20">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-white" fill="white" />
            </div>
            <div className="font-bold text-[var(--text-main)] tracking-tight">
              Gemini Audit
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--text-muted)] transition-colors"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="relative group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] group-focus-within:text-blue-500 transition-colors"
            size={14}
          />
          <input
            type="text"
            placeholder={`Search ID, title, or projects...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl py-2 pl-10 pr-4 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-[var(--input-focus)] transition-all placeholder:text-[var(--text-dim)]"
          />
        </div>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeProvider}
        onTabChange={(id) => {
          setActiveProvider(id as ProviderType);
          setSelectedProject(null);
          setSessions([]);
        }}
        className="mx-4 mb-4 border-b-0 gap-1"
      />

      <nav className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-4",
              isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-400 hover:bg-white/5",
            )
          }
        >
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>

        <div className="pt-2 pb-2 px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest flex justify-between items-center">
          <span>
            {activeProvider === "gemini"
              ? "Active Projects"
              : "Imported History"}
          </span>
          {search && (
            <Badge variant="primary" className="text-[9px] px-1.5 py-0">
              {visibleProjectList.length}
            </Badge>
          )}
        </div>

        {visibleProjectList.length > 0 ? (
          visibleProjectList.map((project) => {
            const isExpanded = search ? true : selectedProject === project;
            const displaySessions = search
              ? projectSearchData?.[project]?.visibleSessions || []
              : sessions;

            return (
              <div key={project} className="space-y-1">
                <button
                  onClick={() =>
                    setSelectedProject(
                      selectedProject === project ? null : project,
                    )
                  }
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group",
                    isExpanded
                      ? "bg-white/5 text-blue-400"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                    search &&
                      projectSearchData?.[project]?.matches &&
                      "text-blue-300 ring-1 ring-blue-500/20 bg-blue-500/5",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Folder
                      size={16}
                      className={
                        isExpanded ? "text-blue-500" : "text-slate-600"
                      }
                    />
                    <span className="truncate max-w-[140px] text-left">
                      {project}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className={cn(
                      "transition-transform text-slate-700",
                      isExpanded && "rotate-90 text-blue-500",
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200">
                    {displaySessions.length > 0
                      ? displaySessions.map(
                          (session: AnalyzedSession | SidebarSession) => (
                            <SessionLink
                              key={session.sessionId}
                              session={session}
                              variant={
                                activeProvider === "gemini" ? "blue" : "emerald"
                              }
                            />
                          ),
                        )
                      : !search && (
                          <div className="p-2 text-[10px] text-slate-600 italic">
                            Loading sessions...
                          </div>
                        )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="px-3 py-8 text-center text-slate-500 text-xs italic">
            No results found.
          </div>
        )}
      </nav>

      <div className="p-6 mt-auto border-t border-[var(--card-border)] bg-[var(--sidebar-hover)]">
        <div className="bg-gradient-to-br from-blue-600/5 to-emerald-600/5 dark:from-blue-600/10 dark:to-emerald-600/10 border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-main)] uppercase tracking-tighter">
            <Database size={12} className="text-blue-400" />{" "}
            {allSessions.length} Sessions Indexed
          </div>
          <div className="text-[10px] text-[var(--text-muted)] leading-snug">
            {search
              ? "Filtering hierarchical view."
              : "Browse indexed AI sessions."}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SessionLink({
  session,
  variant = "blue",
}: {
  session: AnalyzedSession | SidebarSession;
  variant?: "blue" | "emerald";
}) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
    emerald:
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  };

  // 兼容逻辑：优先使用 sessionTitle (文件名) -> firstMessage (针对概要数据) -> messages[0] -> sessionId
  const displayTitle =
    session.sessionTitle ||
    ("firstMessage" in session
      ? session.firstMessage
      : "messages" in session
        ? (session as AnalyzedSession).messages.find((m) => m.type === "user")
            ?.content
        : "") ||
    session.sessionId;

  return (
    <NavLink
      to={`/session/${session.sessionId}`}
      data-testid={`session-link-${session.sessionId}`}
      className={({ isActive }) =>
        cn(
          "flex flex-col gap-1.5 p-3 rounded-xl transition-all group border border-transparent",
          isActive
            ? colors[variant]
            : "hover:bg-[var(--sidebar-hover)] hover:border-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--text-main)]",
        )
      }
    >
      {({ isActive }) => (
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-[11px] font-bold truncate leading-tight mb-0.5 flex items-center gap-1.5",
                isActive
                  ? variant === "blue"
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-emerald-700 dark:text-emerald-300"
                  : "text-[var(--text-muted)] group-hover:text-[var(--text-main)]",
              )}
            >
              <span className="truncate">{displayTitle}</span>
            </div>

            <div className="flex items-center justify-between mt-1 gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-mono text-[10px] font-bold tracking-tight shrink-0",
                    isActive
                      ? variant === "blue"
                        ? "text-blue-600 dark:text-blue-200"
                        : "text-emerald-600 dark:text-emerald-200"
                      : variant === "blue"
                        ? "text-blue-500/80"
                        : "text-emerald-500/80",
                  )}
                >
                  {session.sessionId.substring(0, 8)}
                </span>

                {session.isCheckpoint && (
                  <span className="shrink-0 bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] px-1 rounded border border-blue-500/30 uppercase tracking-tighter">
                    CP
                  </span>
                )}
              </div>

              <span className="text-[9px] font-medium opacity-60 dark:opacity-40 whitespace-nowrap overflow-hidden text-right text-[var(--text-dim)]">
                {new Date(session.startTime).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <Badge
            variant={
              session.expressionQuality.score >= 80 ? "secondary" : "primary"
            }
            className="shrink-0 mt-0.5"
          >
            {session.expressionQuality.score}
          </Badge>
        </div>
      )}
    </NavLink>
  );
}
