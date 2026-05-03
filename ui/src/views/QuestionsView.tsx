import { useEffect, useState, useMemo } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Filter,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { fetchUserQuestions, fetchUserQuestionsStats } from '../api';
import type { UserQuestionsSession } from '../types';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';

interface ProjectStat {
  projectName: string;
  sessionCount: number;
  totalQuestions: number;
  avgScore: number;
}

export function QuestionsView() {
  const [data, setData] = useState<UserQuestionsSession[]>([]);
  const [stats, setStats] = useState<ProjectStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [minScore, setMinScore] = useState<number>(0);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [res, statsRes] = await Promise.all([
          fetchUserQuestions({
            project: selectedProject || undefined,
            minScore: minScore || undefined,
          }),
          fetchUserQuestionsStats(),
        ]);

        if (!active) return;

        setData(res.data);
        setStats(statsRes);
        setLoading(false);
        setExpandedSessions(
          new Set(
            res.data.slice(0, 5).map((s: UserQuestionsSession) => s.sessionId),
          ),
        );
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch questions:', err);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [selectedProject, minScore]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter(
      (s: UserQuestionsSession) =>
        s.projectName.toLowerCase().includes(lowerSearch) ||
        (s.sessionTitle?.toLowerCase() || '').includes(lowerSearch) ||
        s.questions.some((q) => q.toLowerCase().includes(lowerSearch)),
    );
  }, [data, searchTerm]);

  const toggleSession = (id: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSessions(newExpanded);
  };

  const copyToClipboard = () => {
    const markdown = filteredData
      .map((s) => {
        const title = s.sessionTitle || s.questions[0]?.slice(0, 50) + '...';
        return `### Session: ${title} (Project: ${s.projectName})\n${s.questions.map((q) => `- ${q}`).join('\n')}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--app-bg)] text-[var(--text-main)]">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-main)]">
            <MessageCircle className="h-6 w-6 text-blue-400" />
            My Questions
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Browse and export your questioning history. Use filters to manage
            LLM context limits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={copyToClipboard}
            className="flex items-center gap-2 whitespace-nowrap"
            disabled={filteredData.length === 0}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy Current View'}
          </Button>
        </div>
      </header>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.slice(0, 4).map((s) => (
          <Card
            key={s.projectName}
            className={`cursor-pointer transition-all ${selectedProject === s.projectName ? 'border-blue-500 bg-blue-500/5' : 'border-[var(--card-border)] hover:border-blue-500/30'}`}
            onClick={() =>
              setSelectedProject(
                selectedProject === s.projectName ? null : s.projectName,
              )
            }
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {s.projectName}
                  </p>
                  <p className="text-xl font-bold text-[var(--text-main)]">
                    {s.totalQuestions}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Questions across {s.sessionCount} sessions
                  </p>
                </div>
                <Badge
                  variant={
                    s.avgScore > 80
                      ? 'secondary'
                      : s.avgScore > 60
                        ? 'primary'
                        : 'outline'
                  }
                >
                  {s.avgScore}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search in questions..."
            className="w-48 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] py-1.5 pl-10 pr-4 text-xs text-[var(--text-main)] outline-none focus:border-blue-500 focus:bg-[var(--input-focus)]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-blue-500"
          value={selectedProject || ''}
          onChange={(e) => setSelectedProject(e.target.value || null)}
        >
          <option value="">All Projects</option>
          {stats.map((s) => (
            <option key={s.projectName} value={s.projectName}>
              {s.projectName}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-blue-500"
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
        >
          <option value="0">All Scores</option>
          <option value="80">Good Only (&gt;80)</option>
          <option value="1">Problematic Only (&lt;80)</option>
        </select>

        <div className="ml-auto text-xs text-[var(--text-muted)]">
          Showing <strong>{filteredData.length}</strong> sessions
        </div>
      </div>

      <div className="grid gap-4">
        {filteredData.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)]">
            No questions found for the selected filters.
          </div>
        ) : (
          filteredData.map((session) => (
            <Card
              key={session.sessionId}
              className="overflow-hidden border-[var(--card-border)]"
            >
              <CardHeader
                className="cursor-pointer py-3 transition-colors hover:bg-[var(--sidebar-hover)]"
                onClick={() => toggleSession(session.sessionId)}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {expandedSessions.has(session.sessionId) ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-[var(--text-main)]">
                          {session.sessionTitle ||
                            session.questions[0]?.slice(0, 60) + '...'}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 py-0 text-[10px]"
                        >
                          {session.projectName}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                          <Calendar className="h-3 w-3" />
                          {new Date(session.startTime).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                          <BarChart3 className="h-3 w-3" />
                          {session.questions.length} questions
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/session/${session.sessionId}`}
                    className="rounded p-1 text-blue-400 transition-colors hover:bg-blue-500/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>
              {expandedSessions.has(session.sessionId) && (
                <CardContent className="border-t border-[var(--card-border)] px-6 pb-4 pt-0">
                  <ul className="mt-4 space-y-3">
                    {session.questions.map((question, idx) => (
                      <li key={idx} className="group flex gap-3">
                        <span className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <div className="flex-1 whitespace-pre-wrap rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-3 text-sm text-[var(--text-main)] transition-colors group-hover:border-blue-500/30">
                          {question}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
