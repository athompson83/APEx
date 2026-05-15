'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Crown,
  Settings2,
  TrendingUp,
  HeartHandshake,
  Calculator,
  Scale,
  Layers,
  ArrowRight,
  CheckSquare,
  FileText,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  priorityBrief: string;
  openTasks: number;
  documentsIndexed: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    agent?: string;
    timestamp: string;
  }>;
  priorityActions: Array<{
    id: string;
    title: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    agent: string;
  }>;
  recentConversations: Array<{
    id: string;
    title: string;
    agentType: string;
    updatedAt: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function priorityColor(p: string) {
  switch (p) {
    case 'CRITICAL': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'HIGH':     return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'MEDIUM':   return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:         return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

const AGENT_LINKS: Record<string, { href: string; icon: React.ElementType; color: string }> = {
  CHIEF_OF_STAFF:     { href: '/agents/CHIEF_OF_STAFF',     icon: Crown,         color: 'bg-violet-600' },
  OPERATIONS_MANAGER: { href: '/agents/OPERATIONS_MANAGER', icon: Settings2,      color: 'bg-blue-600' },
  SALES_MANAGER:      { href: '/agents/SALES_MANAGER',      icon: TrendingUp,     color: 'bg-green-600' },
  CUSTOMER_SUCCESS:   { href: '/agents/CUSTOMER_SUCCESS',   icon: HeartHandshake, color: 'bg-teal-600' },
  ACCOUNTING:         { href: '/agents/ACCOUNTING',         icon: Calculator,     color: 'bg-amber-600' },
  LEGAL_OPS:          { href: '/agents/LEGAL_OPS',          icon: Scale,          color: 'bg-slate-600' },
  PRODUCT_MANAGER:    { href: '/agents/PRODUCT_MANAGER',    icon: Layers,         color: 'bg-rose-600' },
};

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  note,
  loading,
}: {
  label: string;
  value: string | number;
  note?: string;
  loading?: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/agents/CHIEF_OF_STAFF">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Ask Chief of Staff
          </Link>
        </Button>
      </div>

      {/* ── AI Priority Brief ───────────────────────────────────────────── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Crown className="h-4 w-4" />
            AI Priority Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : (
            <p className="text-sm text-foreground/90 leading-relaxed">
              {data?.priorityBrief ??
                'Your Chief of Staff is analyzing today\'s priorities. Check back shortly for your briefing.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Metric Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="MRR" value="—" note="Connect accounting" loading={isLoading} />
        <MetricCard label="Active Customers" value="—" note="Connect CRM" loading={isLoading} />
        <MetricCard
          label="Open Tasks"
          value={data?.openTasks ?? '—'}
          note="Across all agents"
          loading={isLoading}
        />
        <MetricCard
          label="Docs Indexed"
          value={data?.documentsIndexed ?? '—'}
          note="In knowledge bases"
          loading={isLoading}
        />
      </div>

      {/* ── Two-column content ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activity Feed */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !data?.recentActivity?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No recent activity yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.agent && <span className="font-medium">{item.agent} · </span>}
                        {formatRelativeTime(item.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Actions */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">Priority Actions</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {isLoading ? (
              <div className="space-y-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : !data?.priorityActions?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No priority actions.
              </p>
            ) : (
              <div className="space-y-2">
                {data.priorityActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors"
                  >
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground leading-snug">{action.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{action.agent}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityColor(action.priority)}`}
                    >
                      {action.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Access Agents ────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          AI Executive Team
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(AGENT_LINKS).map(([type, { href, icon: Icon, color }]) => (
            <Button key={type} variant="outline" size="sm" asChild>
              <Link href={href} className="flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded ${color}`}>
                  <Icon className="h-2.5 w-2.5 text-white" />
                </span>
                {type
                  .toLowerCase()
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* ── Recent Conversations ───────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              Recent Conversations
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
              <Link href="/agents/CHIEF_OF_STAFF">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isLoading ? (
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.recentConversations?.length ? (
            <div className="empty-state">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <Button size="sm" className="mt-3" asChild>
                <Link href="/agents/CHIEF_OF_STAFF">Start a conversation</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {data.recentConversations.map((conv) => {
                const agentInfo = AGENT_LINKS[conv.agentType];
                const Icon = agentInfo?.icon ?? MessageSquare;
                return (
                  <Link
                    key={conv.id}
                    href={agentInfo?.href ?? '/agents/CHIEF_OF_STAFF'}
                    className="flex items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${agentInfo?.color ?? 'bg-muted'}`}
                    >
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <span className="flex-1 truncate font-medium text-foreground">
                      {conv.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
