"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Crown,
  Settings,
  TrendingUp,
  Heart,
  DollarSign,
  Scale,
  Package,
  FileText,
  Brain,
  Database,
  Zap,
  LayoutDashboard,
  Upload,
  MessageSquare,
  CheckSquare,
  ArrowRight,
  Clock,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandAction {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  iconColor?: string
  href?: string
  action?: () => void
  shortcut?: string
  group: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const quickActions: CommandAction[] = [
  {
    id: "chat-cos",
    label: "New Chat with Chief of Staff",
    description: "Start a strategic conversation",
    icon: Crown,
    iconColor: "text-violet-400",
    href: "/agents/chief-of-staff",
    shortcut: "⌘1",
    group: "Quick Actions",
  },
  {
    id: "upload-doc",
    label: "Upload Document",
    description: "Add to your knowledge base",
    icon: Upload,
    iconColor: "text-sky-400",
    href: "/documents?upload=true",
    group: "Quick Actions",
  },
  {
    id: "run-workflow",
    label: "Run Workflow",
    description: "Trigger an automation",
    icon: Zap,
    iconColor: "text-amber-400",
    href: "/workflows",
    group: "Quick Actions",
  },
]

const pages: CommandAction[] = [
  {
    id: "page-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    group: "Pages",
  },
  {
    id: "page-tasks",
    label: "Tasks",
    icon: CheckSquare,
    href: "/tasks",
    group: "Pages",
  },
  {
    id: "page-documents",
    label: "Documents",
    icon: FileText,
    href: "/documents",
    group: "Pages",
  },
  {
    id: "page-memory",
    label: "Memory",
    icon: Brain,
    href: "/memory",
    group: "Pages",
  },
  {
    id: "page-kbs",
    label: "Knowledge Bases",
    icon: Database,
    href: "/knowledge-bases",
    group: "Pages",
  },
  {
    id: "page-workflows",
    label: "Workflows",
    icon: Zap,
    href: "/workflows",
    group: "Pages",
  },
  {
    id: "page-settings",
    label: "Settings",
    icon: Settings,
    href: "/settings",
    group: "Pages",
  },
]

const agents: CommandAction[] = [
  {
    id: "agent-cos",
    label: "Chief of Staff",
    description: "Strategic planning & prioritization",
    icon: Crown,
    iconColor: "text-violet-400",
    href: "/agents/chief-of-staff",
    group: "Agents",
  },
  {
    id: "agent-ops",
    label: "Operations Manager",
    description: "Process optimization & execution",
    icon: Settings,
    iconColor: "text-indigo-400",
    href: "/agents/operations",
    group: "Agents",
  },
  {
    id: "agent-sales",
    label: "Sales Manager",
    description: "Pipeline & revenue growth",
    icon: TrendingUp,
    iconColor: "text-emerald-400",
    href: "/agents/sales",
    group: "Agents",
  },
  {
    id: "agent-cs",
    label: "Customer Success",
    description: "Retention & satisfaction",
    icon: Heart,
    iconColor: "text-rose-400",
    href: "/agents/customer-success",
    group: "Agents",
  },
  {
    id: "agent-fin",
    label: "Finance",
    description: "Financial analysis & reporting",
    icon: DollarSign,
    iconColor: "text-amber-400",
    href: "/agents/finance",
    group: "Agents",
  },
  {
    id: "agent-legal",
    label: "Legal",
    description: "Contract review & compliance",
    icon: Scale,
    iconColor: "text-slate-400",
    href: "/agents/legal",
    group: "Agents",
  },
  {
    id: "agent-product",
    label: "Product",
    description: "Roadmap & feature planning",
    icon: Package,
    iconColor: "text-sky-400",
    href: "/agents/product",
    group: "Agents",
  },
]

const recentItems: CommandAction[] = [
  {
    id: "recent-1",
    label: "Q3 Strategy Review",
    description: "Conversation with Chief of Staff · 2h ago",
    icon: MessageSquare,
    iconColor: "text-slate-400",
    href: "/agents/chief-of-staff?conversation=1",
    group: "Recent",
  },
  {
    id: "recent-2",
    label: "Sales Pipeline Analysis",
    description: "Document · Uploaded yesterday",
    icon: FileText,
    iconColor: "text-slate-400",
    href: "/documents/1",
    group: "Recent",
  },
  {
    id: "recent-3",
    label: "Weekly Report Workflow",
    description: "Last run 3h ago",
    icon: Zap,
    iconColor: "text-slate-400",
    href: "/workflows/1",
    group: "Recent",
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()

  const runAction = React.useCallback(
    (action: CommandAction) => {
      onOpenChange(false)
      if (action.action) {
        action.action()
      } else if (action.href) {
        router.push(action.href)
      }
    },
    [router, onOpenChange]
  )

  // Global keyboard shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  const allActions = [...quickActions, ...agents, ...pages, ...recentItems]

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, agents, documents..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-slate-400">No results found.</p>
            <p className="text-xs text-slate-600">Try searching for agents, documents, or workflows.</p>
          </div>
        </CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <CommandItem
                key={action.id}
                value={action.label + " " + (action.description ?? "")}
                onSelect={() => runAction(action)}
                className="gap-3"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800">
                  <Icon className={cn("h-4 w-4", action.iconColor ?? "text-slate-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{action.label}</p>
                  {action.description && (
                    <p className="text-xs text-slate-500">{action.description}</p>
                  )}
                </div>
                {action.shortcut && (
                  <CommandShortcut>{action.shortcut}</CommandShortcut>
                )}
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Agents */}
        <CommandGroup heading="AI Agents">
          {agents.map((action) => {
            const Icon = action.icon
            return (
              <CommandItem
                key={action.id}
                value={action.label + " agent " + (action.description ?? "")}
                onSelect={() => runAction(action)}
                className="gap-3"
              >
                <Icon className={cn("h-4 w-4 shrink-0", action.iconColor ?? "text-slate-400")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{action.label}</p>
                  {action.description && (
                    <p className="text-xs text-slate-500">{action.description}</p>
                  )}
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Pages */}
        <CommandGroup heading="Pages">
          {pages.map((action) => {
            const Icon = action.icon
            return (
              <CommandItem
                key={action.id}
                value={action.label + " page"}
                onSelect={() => runAction(action)}
                className="gap-3"
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="text-sm">{action.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Recent */}
        <CommandGroup heading="Recent">
          {recentItems.map((action) => {
            const Icon = action.icon
            return (
              <CommandItem
                key={action.id}
                value={"recent " + action.label}
                onSelect={() => runAction(action)}
                className="gap-3"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{action.label}</p>
                  {action.description && (
                    <p className="text-xs text-slate-500">{action.description}</p>
                  )}
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2">
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-700 bg-slate-800 px-1">↵</kbd> to select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-700 bg-slate-800 px-1">↑↓</kbd> to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-700 bg-slate-800 px-1">esc</kbd> to close
          </span>
        </div>
      </div>
    </CommandDialog>
  )
}

// small cn helper for inline use
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ")
}
