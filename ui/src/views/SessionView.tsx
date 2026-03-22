import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, MessageSquare, Sparkles, Clock, User as UserIcon, Wrench, CheckCircle2, XCircle, ChevronDown, Lightbulb, PanelRightOpen, PanelRightClose } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchSessionDetail } from '../api';
import type { AnalyzedSession, ToolCall, MessageThought } from '../types';
import { SessionInspector } from '../components/SessionInspector';
import { cn } from '../utils';

export function SessionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AnalyzedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (id) {
      if (isMounted) setLoading(true);
      fetchSessionDetail(id)
        .then(data => {
          if (isMounted) {
            setSession(data);
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
      // Add a temporary highlight effect
      element.classList.add('ring-2', 'ring-blue-500/50', 'ring-offset-4', 'ring-offset-[var(--app-bg)]');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500/50', 'ring-offset-4', 'ring-offset-[var(--app-bg)]');
      }, 1000);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--app-bg)] text-slate-600">
      <Loader2 size={32} className="animate-spin text-blue-500/50" />
    </div>
  );

  if (!session) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--app-bg)] text-slate-700 space-y-4">
      <MessageSquare size={48} strokeWidth={1} />
      <p className="text-sm font-medium">Select a session from the sidebar</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--app-bg)] w-full">
      {/* Header */}
      <div className="p-4 h-16 border-b border-[var(--card-border)] bg-[var(--app-bg)] flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/20 tracking-tighter uppercase">
            {session.projectName.split('/').pop()?.substring(0, 15)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tracking-tighter hidden md:block">
            <span className="text-slate-700 mr-2">SESSION_ID:</span> {session.sessionId.substring(0, 32)}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-white/5">
             <Sparkles size={12} className="text-blue-400" />
             <span className="text-[10px] font-bold text-slate-300 tracking-tight">{session.modelId}</span>
          </div>
          <button 
            onClick={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-600 hover:text-white transition-all border border-transparent hover:border-white/10"
            title={isInspectorCollapsed ? "Open Inspector" : "Collapse Inspector"}
          >
            {isInspectorCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
          </button>
        </div>
      </div>
      
      {/* Main Content Split Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-10">
          <div className="max-w-6xl mx-auto space-y-12 pb-20">
            {session.messages.map((m) => (
              <div 
                key={m.id} 
                id={`msg-${m.id}`}
                className={cn(
                  "flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all rounded-2xl",
                  m.type === 'user' ? 'justify-end' : 'justify-start',
                  m.type === 'info' && 'justify-center'
                )}
              >
                <div className={cn(
                  "max-w-[90%] rounded-2xl p-4 px-5 shadow-xl",
                  m.type === 'user' 
                  ? 'bg-[var(--user-bg)] border border-[var(--user-border)]' 
                  : m.type === 'info'
                  ? 'bg-transparent border-none text-slate-600 text-[11px] text-center italic py-2 px-12 opacity-60'
                  : 'bg-[var(--gemini-bg)] border border-[var(--gemini-border)] shadow-black/40'
                )}>
                  {m.type !== 'info' && (
                    <div className="flex items-center justify-between gap-6 mb-3 text-[9px] font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        {m.type === 'user' ? <UserIcon size={11} /> : <Sparkles size={11} className="text-blue-400" />}
                        <span className={cn(m.type === 'gemini' && "text-blue-400/80")}>{m.type === 'gemini' ? session.modelId : 'User'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-mono">
                        <Clock size={10} /> {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                  
                  <div className={cn(
                    "prose prose-invert prose-slate prose-sm max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/5 prose-code:text-blue-400/90 leading-relaxed",
                    m.type === 'user' ? 'text-[var(--user-text)]' : 'text-slate-300'
                  )}>
                    <ReactMarkdown
                      children={m.content || ""}
                      components={{
                        code(props) {
                          const {children, className} = props
                          const match = /language-(\w+)/.exec(className || '')
                          return match ? (
                            <SyntaxHighlighter
                              PreTag="div"
                              children={String(children).replace(/\n$/, '')}
                              language={match[1]}
                              style={vscDarkPlus as any}
                              className="rounded-lg !my-4 !bg-transparent border border-white/5"
                            />
                          ) : (
                            <code className={cn("bg-white/10 px-1.5 py-0.5 rounded text-blue-300", className)}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    />
                  </div>

                  {m.type === 'gemini' && (
                    <>
                      <ThoughtViewer thoughts={m.thoughts} />
                      <ToolTimeline tools={m.toolCalls || []} />
                    </>
                  )}
                </div>
              </div>
            ))}
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
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Wrench size={10} className="text-blue-500/70" /> Execution Chain
      </div>
      <div className="space-y-1.5">
        {tools.map((t, idx) => (
          <div key={idx} className="bg-black/20 rounded-lg border border-white/5 overflow-hidden">
            <button 
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              className="w-full flex items-center justify-between p-2 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                {t.status === 'success' ? <CheckCircle2 size={12} className="text-emerald-500/80" /> : <XCircle size={12} className="text-rose-500/80" />}
                <span className="text-[11px] font-mono text-blue-400/90">{t.name}</span>
              </div>
              <ChevronDown size={12} className={cn("text-slate-700 transition-transform", expandedId === t.id && "rotate-180")} />
            </button>
            {expandedId === t.id && (
              <div className="p-3 bg-black/40 border-t border-white/5 space-y-3">
                <pre className="text-[10px] text-slate-400 bg-black/30 p-2 rounded-md overflow-x-auto border border-white/5">
                  {JSON.stringify(t.args, null, 2)}
                </pre>
                {t.result && (
                  <pre className="text-[10px] text-emerald-400/70 bg-black/30 p-2 rounded-md overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto border border-emerald-900/10">
                    {typeof t.result === 'string' ? t.result : JSON.stringify(t.result, null, 2)}
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
        className="flex items-center gap-2 text-[9px] font-bold text-amber-500/60 uppercase tracking-widest hover:text-amber-500/90 transition-colors"
      >
        <Lightbulb size={11} /> 
        <span>{isOpen ? 'Close Thoughts' : 'Show Thoughts'}</span>
        <ChevronDown size={10} className={cn(isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="mt-3 space-y-2 bg-amber-900/5 border-l border-amber-500/30 pl-4 py-1.5">
          {thoughts.map((thought, i) => (
            <div key={i} className="text-[11px] leading-relaxed text-slate-400/90">
              <span className="text-amber-600/60 font-medium mr-2">#{thought.subject}</span>
              {thought.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
