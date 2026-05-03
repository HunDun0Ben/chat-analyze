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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--app-bg)]">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-400" />
            My Questions
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
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
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? 'Copied!' : 'Copy Current View'}
          </Button>
        </div>
      </header>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.slice(0, 4).map((s) => (
          <Card
            key={s.projectName}
            className={`cursor-pointer transition-all ${selectedProject === s.projectName ? 'border-blue-500 bg-blue-500/5' : 'border-[var(--border-color)] hover:border-blue-500/30'}`}
            onClick={() =>
              setSelectedProject(
                selectedProject === s.projectName ? null : s.projectName,
              )
            }
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-bold">
                    {s.projectName}
                  </p>
                  <p className="text-xl font-bold text-white">
                    {s.totalQuestions}
                  </p>
                  <p className="text-[var(--text-muted)] text-[10px]">
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

      <div className="flex flex-wrap items-center gap-4 bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-color)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search in questions..."
            className="pl-10 pr-4 py-1.5 bg-[var(--app-bg)] border border-[var(--border-color)] rounded-lg text-xs focus:outline-none focus:border-blue-500 w-48"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="bg-[var(--app-bg)] border border-[var(--border-color)] rounded-lg text-xs px-3 py-1.5 text-white outline-none focus:border-blue-500"
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
          className="bg-[var(--app-bg)] border border-[var(--border-color)] rounded-lg text-xs px-3 py-1.5 text-white outline-none focus:border-blue-500"
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
        >
          <option value="0">All Scores</option>
          <option value="80">Good Only (&gt;80)</option>
          <option value="1">Problematic Only (&lt;80)</option>
        </select>

        <div className="ml-auto text-[var(--text-muted)] text-xs">
          Showing <strong>{filteredData.length}</strong> sessions
        </div>
      </div>

      <div className="grid gap-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            No questions found for the selected filters.
          </div>
        ) : (
          filteredData.map((session) => (
            <Card
              key={session.sessionId}
              className="overflow-hidden border-[var(--border-color)]"
            >
              <CardHeader
                className="cursor-pointer hover:bg-[var(--card-hover)] transition-colors py-3"
                onClick={() => toggleSession(session.sessionId)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    {expandedSessions.has(session.sessionId) ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">
                          {session.sessionTitle ||
                            session.questions[0]?.slice(0, 60) + '...'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-5"
                        >
                          {session.projectName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[var(--text-muted)] text-[10px] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(session.startTime).toLocaleString()}
                        </span>
                        <span className="text-[var(--text-muted)] text-[10px] flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {session.questions.length} questions
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/session/${session.sessionId}`}
                    className="p-1 hover:bg-blue-500/10 rounded text-blue-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </CardHeader>
              {expandedSessions.has(session.sessionId) && (
                <CardContent className="pt-0 pb-4 px-6 border-t border-[var(--border-color)]">
                  <ul className="space-y-3 mt-4">
                    {session.questions.map((question, idx) => (
                      <li key={idx} className="flex gap-3 group">
                        <span className="text-[var(--text-muted)] font-mono text-xs mt-1">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <div className="bg-[var(--app-bg)] p-3 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-main)] group-hover:border-blue-500/30 transition-colors flex-1 whitespace-pre-wrap">
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
