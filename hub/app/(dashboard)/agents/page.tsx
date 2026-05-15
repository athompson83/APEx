import type { Metadata } from 'next';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AgentType, AGENT_METADATA } from '@/lib/agents/types';

export const metadata: Metadata = {
  title: 'AI Agents',
};

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

// ─── Status (static placeholders) ────────────────────────────────────────────

const AGENT_STATUS: Record<AgentType, { status: 'online' | 'idle' | 'offline'; tasks: number }> = {
  [AgentType.CHIEF_OF_STAFF]:     { status: 'online',  tasks: 3 },
  [AgentType.OPERATIONS_MANAGER]: { status: 'online',  tasks: 1 },
  [AgentType.SALES_MANAGER]:      { status: 'idle',    tasks: 5 },
  [AgentType.CUSTOMER_SUCCESS]:   { status: 'online',  tasks: 2 },
  [AgentType.ACCOUNTING]:         { status: 'idle',    tasks: 0 },
  [AgentType.LEGAL_OPS]:          { status: 'offline', tasks: 0 },
  [AgentType.PRODUCT_MANAGER]:    { status: 'online',  tasks: 4 },
};

function statusDotClass(status: 'online' | 'idle' | 'offline') {
  switch (status) {
    case 'online':  return 'bg-emerald-500';
    case 'idle':    return 'bg-amber-500';
    case 'offline': return 'bg-slate-600';
  }
}

function statusLabel(status: 'online' | 'idle' | 'offline') {
  switch (status) {
    case 'online':  return 'Online';
    case 'idle':    return 'Idle';
    case 'offline': return 'Offline';
  }
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agentType }: { agentType: AgentType }) {
  const meta   = AGENT_METADATA[agentType];
  const info   = AGENT_STATUS[agentType];
  const Icon   = ICON_MAP[meta.icon] ?? Crown;

  return (
    <Link href={`/agents/${agentType}`} className="group block">
      <Card className="h-full border-border bg-card transition-colors hover:border-primary/40 hover:bg-accent/30">
        <CardHeader className="pb-2 pt-5 px-5">
          <div className="flex items-start justify-between gap-3">
            {/* Icon */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>

            {/* Status badge */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusDotClass(info.status)}`} />
                <span className="text-xs text-muted-foreground">{statusLabel(info.status)}</span>
              </div>
              {info.tasks > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {info.tasks} active {info.tasks === 1 ? 'task' : 'tasks'}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {meta.name}
            </h3>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {meta.description}
          </p>

          <div className="mt-4 space-y-1">
            {meta.capabilities.slice(0, 3).map((cap) => (
              <div key={cap} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                {cap}
              </div>
            ))}
            {meta.capabilities.length > 3 && (
              <p className="text-xs text-muted-foreground/60 pl-2.5">
                +{meta.capabilities.length - 3} more
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open agent <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const agentTypes = Object.values(AgentType);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Executive Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {agentTypes.length} AI agents ready to support your operations.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks">
            View all tasks <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agentTypes.map((type) => (
          <AgentCard key={type} agentType={type} />
        ))}
      </div>
    </div>
  );
}
