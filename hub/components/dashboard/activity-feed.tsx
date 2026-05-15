"use client"

import * as React from "react"
import Link from "next/link"
import {
  MessageSquare,
  CheckCircle2,
  Upload,
  Zap,
  Brain,
  Crown,
  Settings,
  TrendingUp,
  Heart,
  DollarSign,
  Scale,
  Package,
  Loader2,
  RefreshCw,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | "chat"
  | "task_completed"
  | "document_uploaded"
  | "workflow_run"
  | "memory_added"
  | "task_created"
  | "task_failed"

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  description?: string
  href?: string
  agentType?: string
  timestamp: Date | string
  metadata?: Record<string, unknown>
}

interface ActivityFeedProps {
  items?: ActivityItem[]
  isLoading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  className?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; iconBg: string; iconColor: string; label: string }
> = {
  chat: {
    icon: MessageSquare,
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-400",
    label: "Chat",
  },
  task_completed: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    label: "Task completed",
  },
  task_created: {
    icon: CheckCircle2,
    iconBg: "bg-slate-700/50",
    iconColor: "text-slate-400",
    label: "Task created",
  },
  task_failed: {
    icon: CheckCircle2,
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    label: "Task failed",
  },
  document_uploaded: {
    icon: Upload,
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
    label: "Document uploaded",
  },
  workflow_run: {
    icon: Zap,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    label: "Workflow run",
  },
  memory_added: {
    icon: Brain,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    label: "Memory added",
  },
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── Activity Row ─────────────────────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = activityConfig[item.type]
  const Icon = config.icon

  const content = (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors",
        item.href && "cursor-pointer hover:bg-slate-800/50"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          config.iconBg
        )}
      >
        <Icon className={cn("h-4 w-4", config.iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-300 leading-snug line-clamp-1">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 text-xs text-slate-600 leading-snug line-clamp-1">
            {item.description}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-[10px] text-slate-700 whitespace-nowrap mt-0.5">
        {formatRelativeTime(item.timestamp)}
      </span>
    </div>
  )

  if (item.href) {
    return <Link href={item.href}>{content}</Link>
  }
  return content
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────

export function ActivityFeed({
  items = [],
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onRefresh,
  className,
}: ActivityFeedProps) {
  const [loadingMore, setLoadingMore] = React.useState(false)

  const handleLoadMore = async () => {
    if (!onLoadMore || loadingMore) return
    setLoadingMore(true)
    await onLoadMore()
    setLoadingMore(false)
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-200">Activity</span>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:text-slate-300"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1 -mx-2">
        {isLoading ? (
          <div className="px-2">
            <ActivitySkeleton />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-8 w-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">No recent activity</p>
            <p className="mt-1 text-xs text-slate-700">
              Activity from agents and workflows will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50 px-2">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-slate-500 hover:text-slate-300"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
