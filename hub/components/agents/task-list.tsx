"use client"

import * as React from "react"
import {
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  Loader2,
  Crown,
  Settings,
  TrendingUp,
  Heart,
  DollarSign,
  Scale,
  Package,
  Plus,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  Inbox,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatRelativeTime } from "@/lib/utils"
import type { AgentType } from "./agent-card"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "running" | "completed" | "failed"
export type TaskPriority = "critical" | "high" | "medium" | "low"

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  agentType?: AgentType
  createdAt: Date | string
  updatedAt?: Date | string
  dueAt?: Date | string
}

interface TaskListProps {
  tasks?: Task[]
  onStatusChange?: (taskId: string, status: TaskStatus) => void
  onNewTask?: () => void
  isLoading?: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const agentIcons: Record<AgentType, React.ElementType> = {
  "chief-of-staff": Crown,
  operations: Settings,
  sales: TrendingUp,
  "customer-success": Heart,
  finance: DollarSign,
  legal: Scale,
  product: Package,
}

const priorityConfig: Record<
  TaskPriority,
  { label: string; border: string; dot: string }
> = {
  critical: {
    label: "Critical",
    border: "border-l-red-500",
    dot: "bg-red-500",
  },
  high: {
    label: "High",
    border: "border-l-orange-500",
    dot: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    border: "border-l-slate-600",
    dot: "bg-slate-600",
  },
}

const statusConfig: Record<
  TaskStatus,
  {
    label: string
    icon: React.ElementType
    iconClass: string
    badge: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  }
> = {
  pending: {
    label: "Pending",
    icon: Circle,
    iconClass: "text-slate-500",
    badge: "outline",
  },
  running: {
    label: "Running",
    icon: Loader2,
    iconClass: "text-indigo-400 animate-spin",
    badge: "info",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    badge: "success",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    iconClass: "text-red-500",
    badge: "destructive",
  },
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onStatusChange,
}: {
  task: Task
  onStatusChange?: (id: string, status: TaskStatus) => void
}) {
  const priority = priorityConfig[task.priority]
  const status = statusConfig[task.status]
  const StatusIcon = status.icon
  const AgentIcon = task.agentType ? agentIcons[task.agentType] : null

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3.5",
        "border-l-2 transition-colors hover:border-slate-700",
        priority.border
      )}
    >
      {/* Status icon */}
      <button
        className="mt-0.5 shrink-0 transition-transform hover:scale-110"
        onClick={() => {
          if (!onStatusChange) return
          const next: Record<TaskStatus, TaskStatus> = {
            pending: "running",
            running: "completed",
            completed: "pending",
            failed: "pending",
          }
          onStatusChange(task.id, next[task.status])
        }}
      >
        <StatusIcon className={cn("h-4 w-4", status.iconClass)} />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              task.status === "completed"
                ? "line-through text-slate-500"
                : "text-slate-200"
            )}
          >
            {task.title}
          </p>

          <div className="flex shrink-0 items-center gap-1.5">
            {AgentIcon && (
              <AgentIcon className="h-3.5 w-3.5 text-slate-600" />
            )}
            <Badge variant={status.badge} className="text-[10px]">
              {status.label}
            </Badge>
          </div>
        </div>

        {task.description && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-1">
            {task.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-700">
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
            {priority.label}
          </span>
          {task.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {formatRelativeTime(task.createdAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNewTask }: { onNewTask?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/50">
        <Inbox className="h-7 w-7 text-slate-600" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-300">No tasks</h3>
      <p className="mt-1 text-xs text-slate-600">
        Tasks created by agents will appear here.
      </p>
      {onNewTask && (
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={onNewTask}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Create Task
        </Button>
      )}
    </div>
  )
}

// ─── TaskList ─────────────────────────────────────────────────────────────────

const ALL_STATUSES: TaskStatus[] = ["pending", "running", "completed", "failed"]
const ALL_PRIORITIES: TaskPriority[] = ["critical", "high", "medium", "low"]

export function TaskList({
  tasks = [],
  onStatusChange,
  onNewTask,
  isLoading = false,
}: TaskListProps) {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<Set<TaskStatus>>(
    new Set(ALL_STATUSES)
  )
  const [priorityFilter, setPriorityFilter] = React.useState<Set<TaskPriority>>(
    new Set(ALL_PRIORITIES)
  )

  const filtered = tasks.filter((t) => {
    const matchSearch =
      search.trim() === "" ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter.has(t.status)
    const matchPriority = priorityFilter.has(t.priority)
    return matchSearch && matchStatus && matchPriority
  })

  const toggleStatus = (s: TaskStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const togglePriority = (p: TaskPriority) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 flex-1 text-xs"
        />

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Filter className="h-3 w-3" />
              Status
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilter.has(s)}
                onCheckedChange={() => toggleStatus(s)}
              >
                {statusConfig[s].label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <SlidersHorizontal className="h-3 w-3" />
              Priority
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={priorityFilter.has(p)}
                onCheckedChange={() => togglePriority(p)}
              >
                {priorityConfig[p].label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {onNewTask && (
          <Button size="sm" variant="ai" className="h-8 gap-1 text-xs" onClick={onNewTask}>
            <Plus className="h-3.5 w-3.5" />
            New Task
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNewTask={onNewTask} />
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-1">
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-center text-[10px] text-slate-700">
          {filtered.length} task{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== tasks.length && ` (filtered from ${tasks.length})`}
        </p>
      )}
    </div>
  )
}
