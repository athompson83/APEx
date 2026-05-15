"use client"

import * as React from "react"
import { MessageSquare, Clock, CheckSquare2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentType =
  | "chief-of-staff"
  | "operations"
  | "sales"
  | "customer-success"
  | "finance"
  | "legal"
  | "product"

export type AgentStatus = "active" | "idle" | "offline"

export interface AgentCardProps {
  agentType: AgentType
  name: string
  description: string
  icon: React.ElementType
  color: string
  taskCount: number
  lastActivity?: Date | string | null
  status?: AgentStatus
  onChat: () => void
}

// ─── Status Indicator ─────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: AgentStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          status === "active" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
          status === "idle" && "bg-amber-500",
          status === "offline" && "bg-slate-600"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium",
          status === "active" && "text-emerald-400",
          status === "idle" && "text-amber-400",
          status === "offline" && "text-slate-500"
        )}
      >
        {status === "active" ? "Active" : status === "idle" ? "Idle" : "Offline"}
      </span>
    </div>
  )
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

export function AgentCard({
  agentType,
  name,
  description,
  icon: Icon,
  color,
  taskCount,
  lastActivity,
  status = "idle",
  onChat,
}: AgentCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:border-slate-700 hover:shadow-lg hover:shadow-black/20",
        "border-slate-800 bg-slate-900"
      )}
    >
      {/* Color accent top bar */}
      <div
        className={cn("absolute inset-x-0 top-0 h-0.5 opacity-60", color)}
      />

      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                color.replace("bg-", "bg-") + "/15"
              )}
            >
              <Icon
                className={cn("h-5 w-5", color.replace("bg-", "text-"))}
              />
            </div>

            {/* Name + status */}
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{name}</h3>
              <StatusIndicator status={status} />
            </div>
          </div>

          {/* Task count badge */}
          {taskCount > 0 && (
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              <CheckSquare2 className="mr-1 h-3 w-3" />
              {taskCount}
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="mt-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
          {description}
        </p>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2">
          {/* Last activity */}
          <div className="flex min-w-0 items-center gap-1 text-[11px] text-slate-600">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {lastActivity
                ? formatRelativeTime(lastActivity)
                : "No recent activity"}
            </span>
          </div>

          {/* CTA */}
          <Button
            size="sm"
            variant="ai"
            className="h-7 shrink-0 px-3 text-xs opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onChat}
          >
            <MessageSquare className="mr-1.5 h-3 w-3" />
            Start Chat
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
