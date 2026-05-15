'use client';

import { use, useState } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Crown,
  Settings2,
  TrendingUp,
  HeartHandshake,
  Calculator,
  Scale,
  Layers,
  Plus,
  MessageSquare,
  Brain,
  FileText,
  CheckSquare,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { AgentType, AGENT_METADATA } from '@/lib/agents/types';
import { formatRelativeTime } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface Memory {
  id: string;
  content: string;
  type: string;
  confidence: number;
}

interface Document {
  id: string;
  name: string;
  type: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
}

interface AgentPageData {
  conversations: Conversation[];
  recentMemories: Memory[];
  relevantDocuments: Document[];
  suggestedTasks: Task[];
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Crown,
  Settings2,
  TrendingUp,
  HeartHandshake,
  Calculator,
  Scale,
  Layers,
};

// ─── Chat Interface ───────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function ChatInterface({ agentType }: { agentType: AgentType }) {
  const meta = AGENT_METADATA[agentType];
  const Icon = ICON_MAP[meta.icon] ?? Crown;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${agentType}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content ?? data.response ?? 'No response received.',
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Agent header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{meta.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{meta.description.slice(0, 60)}…</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${meta.color}`}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            <p className="font-semibold text-foreground">{meta.name}</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{meta.description}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {meta.capabilities.slice(0, 3).map((cap) => (
                <button
                  key={cap}
                  onClick={() => setInput(cap)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {cap}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-border px-5 py-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e as unknown as React.FormEvent);
              }
            }}
            placeholder={`Message ${meta.name}…`}
            rows={2}
            className="resize-none text-sm"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()} className="self-end">
            Send
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">Shift+Enter for new line</p>
      </form>
    </div>
  );
}

// ─── Context Panel ────────────────────────────────────────────────────────────

function ContextPanel({
  agentType,
  onNewConversation,
}: {
  agentType: AgentType;
  onNewConversation: () => void;
}) {
  const { data, isLoading } = useQuery<AgentPageData>({
    queryKey: ['agent-context', agentType],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentType}/conversations`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {/* New conversation */}
        <Button className="w-full" size="sm" onClick={onNewConversation}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Conversation
        </Button>

        {/* Previous conversations */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" /> History
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !data?.conversations?.length ? (
            <p className="text-xs text-muted-foreground">No previous conversations.</p>
          ) : (
            <div className="space-y-1">
              {data.conversations.slice(0, 8).map((conv) => (
                <button
                  key={conv.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground">{conv.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatRelativeTime(conv.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Recent memories */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Brain className="h-3 w-3" /> Recent Memories
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data?.recentMemories?.length ? (
            <p className="text-xs text-muted-foreground">No memories stored yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentMemories.slice(0, 4).map((mem) => (
                <div key={mem.id} className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="line-clamp-2 text-xs text-foreground">{mem.content}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                      {mem.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(mem.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Relevant documents */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3 w-3" /> Relevant Docs
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !data?.relevantDocuments?.length ? (
            <p className="text-xs text-muted-foreground">No documents linked.</p>
          ) : (
            <div className="space-y-1">
              {data.relevantDocuments.slice(0, 5).map((doc) => (
                <Link
                  key={doc.id}
                  href="/documents"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                >
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground">{doc.name}</span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Suggested tasks */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckSquare className="h-3 w-3" /> Suggested Tasks
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !data?.suggestedTasks?.length ? (
            <p className="text-xs text-muted-foreground">No suggested tasks.</p>
          ) : (
            <div className="space-y-1">
              {data.suggestedTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <CheckSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-foreground">{task.title}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentPage({ params }: { params: Promise<{ agentType: string }> }) {
  const { agentType: agentTypeParam } = use(params);
  const [chatKey, setChatKey] = useState(0);

  // Validate agentType
  const validTypes = Object.values(AgentType) as string[];
  if (!validTypes.includes(agentTypeParam)) {
    notFound();
  }

  const agentType = agentTypeParam as AgentType;
  const meta = AGENT_METADATA[agentType];
  const Icon = ICON_MAP[meta.icon] ?? Crown;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h1 className="font-semibold text-foreground">{meta.name}</h1>
        <Badge variant="secondary" className="ml-auto text-xs">
          Agent
        </Badge>
        <Button variant="outline" size="sm" asChild>
          <Link href="/agents">All Agents</Link>
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat (wider left column) */}
        <div className="flex flex-[2] flex-col border-r border-border overflow-hidden">
          <ChatInterface key={chatKey} agentType={agentType} />
        </div>

        {/* Context panel (right) */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden bg-card">
          <ContextPanel
            agentType={agentType}
            onNewConversation={() => setChatKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}
