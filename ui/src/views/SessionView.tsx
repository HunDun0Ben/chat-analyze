import React, { useState, useEffect, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  MessageSquare,
  Sparkles,
  Clock,
  User as UserIcon,
  Wrench,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Lightbulb,
  PanelRightOpen,
  PanelRightClose,
  Eye,
  EyeOff,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  vscDarkPlus,
  prism,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchSessionDetail } from '../api';
import type {
  AnalyzedSession,
  ToolCall,
  MessageThought,
  SessionMessage,
} from '../types';
import { SessionInspector } from '../components/features/SessionInspector';
import { cn } from '../utils';
import { Badge } from '../components/ui/Badge';
import { useTheme } from '../features/theme/useTheme';

const MemoizedCodeBlock = memo(
  ({
    language,
    value,
    theme,
  }: {
    language: string;
    value: string;
    theme: string;
  }) => {
    return (
      <SyntaxHighlighter
        PreTag="div"
        children={value}
        language={language}
        style={
          (theme === 'dark' ? vscDarkPlus : prism) as Record<
            string,
            React.CSSProperties
          >
        }
        className="rounded-lg !my-4 !bg-[var(--gemini-bg)] border border-[var(--card-border)]"
      />
    );
  },
);

const MemoizedMessage = memo(
  ({
    m,
    sessionModelId,
    theme,
    showInternals,
  }: {
    m: SessionMessage;
    sessionModelId: string;
    theme: string;
    showInternals: boolean;
  }) => {
    return (
      <div
        id={`msg-${m.id}`}
        className={cn(
          'flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all rounded-2xl',
          m.type === 'user' ? 'justify-end' : 'justify-start',
          m.type === 'info' && 'justify-center',
        )}
      >
        <div
          className={cn(
            'max-w-[90%] rounded-2xl p-4 px-5 shadow-xl',
            m.type === 'user'
              ? 'bg-[var(--user-bg)] border border-[var(--user-border)]'
              : m.type === 'info'
                ? 'bg-transparent border-none text-[var(--text-dim)] text-[11px] text-center italic py-2 px-12 opacity-60'
                : 'bg-[var(--gemini-bg)] border border-[var(--gemini-border)] shadow-black/5 dark:shadow-black/40',
          )}
        >
          {m.type !== 'info' && (
            <div className="flex items-center justify-between gap-6 mb-3 text-[9px] font-bold uppercase tracking-wider border-b border-[var(--card-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                {m.type === 'user' ? (
                  <UserIcon size={11} />
                ) : (
                  <Sparkles size={11} className="text-blue-500" />
                )}
                <span className={cn(m.type === 'gemini' && 'text-blue-500/80')}>
                  {m.type === 'gemini' ? sessionModelId : 'User'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[var(--text-dim)] font-mono">
                <Clock size={10} />{' '}
                {new Date(m.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          )}

          {!!m.content && (
            <div
              className={cn(
                'prose prose-slate dark:prose-invert prose-sm max-w-none prose-pre:bg-black/5 dark:prose-pre:bg-black/40 prose-pre:border prose-pre:border-[var(--card-border)] prose-code:text-blue-500 prose-code:font-bold prose-hr:my-8 prose-hr:border-[var(--card-border)] leading-relaxed',
                m.type === 'user'
                  ? 'text-[var(--user-text)]'
                  : 'text-[var(--text-main)]',
              )}
            >
              <ReactMarkdown
                children={(m.content as string) || ''}
                components={{
                  hr() {
                    return <hr className="my-12 border-[var(--card-border)]" />;
                  },
                  code({ children, className }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <MemoizedCodeBlock
                        language={match[1]}
                        value={String(children).replace(/\n$/, '')}
                        theme={theme}
                      />
                    ) : (
                      <code
                        className={cn(
                          'bg-[var(--sidebar-hover)] px-1.5 py-0.5 rounded text-blue-500 font-mono font-bold border border-[var(--card-border)] mx-0.5 shadow-sm text-[0.85em]',
                          className,
                        )}
                      >
                        {String(children)}
                      </code>
                    );
                  },
                }}
              />
            </div>
          )}

          {m.type === 'gemini' && showInternals && (
            <>
              <ThoughtViewer thoughts={m.thoughts} />
              <ToolTimeline tools={m.toolCalls || []} />
            </>
          )}
        </div>
      </div>
    );
  },
);

function mergeMessages(messages: SessionMessage[]): SessionMessage[] {
  const processed: SessionMessage[] = [];
  let pendingInternals: { thoughts: MessageThought[]; toolCalls: ToolCall[] } =
    {
      thoughts: [],
      toolCalls: [],
    };

  for (const m of messages) {
    if (m.type === 'gemini') {
      if (!m.content) {
        // Accumulate thoughts and tools
        if (m.thoughts) pendingInternals.thoughts.push(...m.thoughts);
        if (m.toolCalls) pendingInternals.toolCalls.push(...m.toolCalls);
      } else {
        // Has content, flush pending internals into this message
        const newThoughts = m.thoughts
          ? [...pendingInternals.thoughts, ...m.thoughts]
          : pendingInternals.thoughts;
        const newTools = m.toolCalls
          ? [...pendingInternals.toolCalls, ...m.toolCalls]
          : pendingInternals.toolCalls;

        processed.push({
          ...m,
          thoughts: newThoughts.length > 0 ? newThoughts : undefined,
          toolCalls: newTools.length > 0 ? newTools : undefined,
        });
        pendingInternals = { thoughts: [], toolCalls: [] }; // Reset
      }
    } else {
      // If there were pending internals before a user/info message, flush them as a separate message
      if (
        pendingInternals.thoughts.length > 0 ||
        pendingInternals.toolCalls.length > 0
      ) {
        processed.push({
          id: `pending-${m.id}`,
          type: 'gemini',
          timestamp: new Date(
            new Date(m.timestamp).getTime() - 1,
          ).toISOString(),
          content: '',
          thoughts:
            pendingInternals.thoughts.length > 0
              ? pendingInternals.thoughts
              : undefined,
          toolCalls:
            pendingInternals.toolCalls.length > 0
              ? pendingInternals.toolCalls
              : undefined,
        });
        pendingInternals = { thoughts: [], toolCalls: [] };
      }
      processed.push(m);
    }
  }

  // Handle trailing pending internals (e.g. still thinking)
  if (
    pendingInternals.thoughts.length > 0 ||
    pendingInternals.toolCalls.length > 0
  ) {
    processed.push({
      id: `pending-final`,
      type: 'gemini',
      timestamp: new Date().toISOString(),
      content: '',
      thoughts:
        pendingInternals.thoughts.length > 0
          ? pendingInternals.thoughts
          : undefined,
      toolCalls:
        pendingInternals.toolCalls.length > 0
          ? pendingInternals.toolCalls
          : undefined,
    });
  }

  return processed;
}

export function SessionView() {
  const { theme } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AnalyzedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [showInternals, setShowInternals] = useState(false);
  const [prevId, setPrevId] = useState<string | undefined>(undefined);

  // Synchronously adjust state when id changes to avoid useEffect setState warning
  if (id !== prevId) {
    setPrevId(id);
    if (id) setLoading(true);
  }

  useEffect(() => {
    let isMounted = true;
    if (id) {
      fetchSessionDetail(id)
        .then((data) => {
          if (isMounted) {
            setSession({ ...data, messages: mergeMessages(data.messages) });
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLoading(false);
            navigate('/');
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [id, navigate]);

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add(
        'ring-2',
        'ring-blue-500/50',
        'ring-offset-4',
        'ring-offset-[var(--app-bg)]',
      );
      setTimeout(() => {
        element.classList.remove(
          'ring-2',
          'ring-blue-500/50',
          'ring-offset-4',
          'ring-offset-[var(--app-bg)]',
        );
      }, 1000);
    }
  };

  const renderedMessages = useMemo(() => {
    if (!session) return null;
    return session.messages.map((m) => (
      <MemoizedMessage
        key={m.id}
        m={m}
        sessionModelId={session.modelId}
        theme={theme}
        showInternals={showInternals}
      />
    ));
  }, [session, theme, showInternals]);

  if (loading)
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--app-bg)] text-[var(--text-muted)]">
        <Loader2 size={32} className="animate-spin text-blue-500/50" />
      </div>
    );

  if (!session)
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--app-bg)] text-[var(--text-muted)] space-y-4">
        <MessageSquare size={48} strokeWidth={1} />
        <p className="text-sm font-medium">Select a session from the sidebar</p>
      </div>
    );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--app-bg)] w-full text-[var(--text-main)] transition-colors duration-200">
      {/* Header */}
      <div className="p-4 h-16 border-b border-[var(--card-border)] bg-[var(--app-bg)] flex justify-between items-center z-10 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <Badge variant="primary" className="px-2 py-0.5 tracking-tighter">
            {session.projectName.split('/').pop()?.substring(0, 15)}
          </Badge>
          <div className="text-[11px] text-[var(--text-muted)] font-mono tracking-tighter hidden md:block">
            <span className="text-[var(--text-dim)] mr-2">SESSION_ID:</span>{' '}
            {session.sessionId.substring(0, 32)}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/5 dark:bg-slate-900/50 px-3 py-1.5 rounded-full border border-[var(--card-border)]">
            <Sparkles size={12} className="text-blue-500" />
            <span className="text-[10px] font-bold text-[var(--text-main)] tracking-tight">
              {session.modelId}
            </span>
          </div>
          <button
            onClick={() => setShowInternals(!showInternals)}
            className={cn(
              'p-1.5 rounded-md transition-all border flex items-center gap-2 px-3',
              showInternals
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                : 'hover:bg-[var(--sidebar-hover)] text-[var(--text-muted)] border-transparent hover:border-[var(--card-border)]',
            )}
            title={showInternals ? 'Hide Thoughts' : 'Show Thoughts'}
          >
            {showInternals ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block">
              {showInternals ? 'Hide Thoughts' : 'Show Thoughts'}
            </span>
          </button>
          <button
            onClick={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
            className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all border border-transparent hover:border-[var(--card-border)]"
            title={
              isInspectorCollapsed ? 'Open Inspector' : 'Collapse Inspector'
            }
          >
            {isInspectorCollapsed ? (
              <PanelRightOpen size={18} />
            ) : (
              <PanelRightClose size={18} />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Split Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-10">
          <div className="max-w-6xl mx-auto space-y-12 pb-20">
            {renderedMessages}
          </div>
        </div>

        {/* Right Inspector Panel */}
        <SessionInspector
          session={session}
          onSelectMessage={scrollToMessage}
          isCollapsed={isInspectorCollapsed}
        />
      </div>
    </div>
  );
}

function ToolTimeline({ tools }: { tools: ToolCall[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!tools || tools.length === 0) return null;

  return (
    <div className="mt-6 border-t border-[var(--card-border)] pt-4">
      <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center gap-2">
        <Wrench size={10} className="text-blue-500/70" /> Execution Chain
      </div>
      <div className="space-y-1.5">
        {tools.map((t, idx) => (
          <div
            key={idx}
            className="bg-black/5 dark:bg-black/20 rounded-lg border border-[var(--card-border)] overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              className="w-full flex items-center justify-between p-2 hover:bg-[var(--sidebar-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                {t.status === 'success' ? (
                  <CheckCircle2 size={12} className="text-emerald-500/80" />
                ) : (
                  <XCircle size={12} className="text-rose-500/80" />
                )}
                <span className="text-[11px] font-mono text-blue-500/90">
                  {t.name}
                </span>
              </div>
              <ChevronDown
                size={12}
                className={cn(
                  'text-[var(--text-dim)] transition-transform',
                  expandedId === t.id && 'rotate-180',
                )}
              />
            </button>
            {expandedId === t.id && (
              <div className="p-3 bg-black/5 dark:bg-black/40 border-t border-[var(--card-border)] space-y-3">
                <pre className="text-[10px] text-[var(--text-muted)] bg-black/5 dark:bg-black/30 p-2 rounded-md overflow-x-auto border border-[var(--card-border)]">
                  {JSON.stringify(t.args, null, 2)}
                </pre>
                {!!t.result && (
                  <pre className="text-[10px] text-emerald-600 dark:text-emerald-400/70 bg-black/5 dark:bg-black/30 p-2 rounded-md overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto border border-emerald-900/10">
                    {typeof t.result === 'string'
                      ? t.result
                      : JSON.stringify(
                          t.result as Record<string, unknown>,
                          null,
                          2,
                        )}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThoughtViewer({ thoughts }: { thoughts?: MessageThought[] }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[9px] font-bold text-amber-600 dark:text-amber-500/60 uppercase tracking-widest hover:text-amber-500 transition-colors"
      >
        <Lightbulb size={11} />
        <span>{isOpen ? 'Close Thoughts' : 'Show Thoughts'}</span>
        <ChevronDown size={10} className={cn(isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="mt-3 space-y-2 bg-amber-500/5 border-l border-amber-500/30 pl-4 py-1.5">
          {thoughts.map((thought, i) => (
            <div
              key={i}
              className="text-[11px] leading-relaxed text-[var(--text-muted)]"
            >
              <span className="text-amber-600 font-medium mr-2">
                #{thought.subject}
              </span>
              {thought.description as string}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
