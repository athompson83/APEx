"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CheckSquare,
  Search,
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
  Link2,
  Building2,
  Users,
  KeyRound,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "online" | "idle" | "offline"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

interface AgentNavItem extends NavItem {
  status: AgentStatus
  color: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface AgentSection {
  title: string
  items: AgentNavItem[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const workspaceNav: NavSection = {
  title: "WORKSPACE",
  items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tasks", href: "/tasks", icon: CheckSquare },
    { label: "Search", href: "/search", icon: Search },
  ],
}

const agentsNav: AgentSection = {
  title: "AI AGENTS",
  items: [
    {
      label: "Chief of Staff",
      href: "/agents/chief-of-staff",
      icon: Crown,
      status: "online",
      color: "bg-violet-500",
    },
    {
      label: "Operations",
      href: "/agents/operations",
      icon: Settings,
      status: "online",
      color: "bg-indigo-500",
    },
    {
      label: "Sales",
      href: "/agents/sales",
      icon: TrendingUp,
      status: "idle",
      color: "bg-emerald-500",
    },
    {
      label: "Customer Success",
      href: "/agents/customer-success",
      icon: Heart,
      status: "online",
      color: "bg-rose-500",
    },
    {
      label: "Finance",
      href: "/agents/finance",
      icon: DollarSign,
      status: "idle",
      color: "bg-amber-500",
    },
    {
      label: "Legal",
      href: "/agents/legal",
      icon: Scale,
      status: "offline",
      color: "bg-slate-500",
    },
    {
      label: "Product",
      href: "/agents/product",
      icon: Package,
      status: "online",
      color: "bg-sky-500",
    },
  ],
}

const knowledgeNav: NavSection = {
  title: "KNOWLEDGE",
  items: [
    { label: "Documents", href: "/documents", icon: FileText },
    { label: "Memory", href: "/memory", icon: Brain },
    { label: "Knowledge Bases", href: "/knowledge-bases", icon: Database },
  ],
}

const automationNav: NavSection = {
  title: "AUTOMATION",
  items: [
    { label: "Workflows", href: "/workflows", icon: Zap },
    { label: "Integrations", href: "/integrations", icon: Link2 },
  ],
}

const settingsNav: NavSection = {
  title: "SETTINGS",
  items: [
    { label: "Organization", href: "/settings/organization", icon: Building2 },
    { label: "Team", href: "/settings/team", icon: Users },
    { label: "API Keys", href: "/settings/api-keys", icon: KeyRound },
  ],
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        status === "online" && "bg-emerald-500",
        status === "idle" && "bg-amber-500",
        status === "offline" && "bg-slate-600"
      )}
    />
  )
}

// ─── Nav Link ─────────────────────────────────────────────────────────────────

function NavLink({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-indigo-600/20 text-indigo-300 font-medium"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
        )}
      />
      <span className="truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-medium text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  )
}

function AgentNavLink({
  item,
  pathname,
}: {
  item: AgentNavItem
  pathname: string
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-indigo-600/20 text-indigo-300 font-medium"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      )}
    >
      <div className={cn("h-4 w-4 shrink-0 rounded flex items-center justify-center", item.color + "/20")}>
        <Icon
          className={cn(
            "h-3 w-3 transition-colors",
            isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
          )}
        />
      </div>
      <span className="truncate flex-1">{item.label}</span>
      <StatusDot status={item.status} />
    </Link>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function NavSectionGroup({
  section,
  pathname,
  isAgent = false,
}: {
  section: NavSection | AgentSection
  pathname: string
  isAgent?: boolean
}) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        {section.title}
      </p>
      <div className="space-y-0.5">
        {section.items.map((item) =>
          isAgent ? (
            <AgentNavLink
              key={item.href}
              item={item as AgentNavItem}
              pathname={pathname}
            />
          ) : (
            <NavLink key={item.href} item={item} pathname={pathname} />
          )
        )}
      </div>
    </div>
  )
}

// ─── Org Selector ─────────────────────────────────────────────────────────────

function OrgSelector() {
  return (
    <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-slate-800 group">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-600 to-violet-600 text-[10px] font-bold text-white">
        A
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-xs font-medium text-slate-200">Acme Corp</p>
        <p className="truncate text-[10px] text-slate-500">Free plan</p>
      </div>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-400" />
    </button>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-slate-800 bg-[hsl(var(--sidebar-background))]">
      {/* Logo + Org */}
      <div className="flex flex-col gap-2 border-b border-slate-800 px-3 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 pb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-100">
            APEx Hub
          </span>
          <span className="ml-auto rounded bg-indigo-600/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-400 border border-indigo-600/30">
            AI
          </span>
        </div>

        {/* Org Selector */}
        <OrgSelector />
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <NavSectionGroup section={workspaceNav} pathname={pathname} />
        <NavSectionGroup section={agentsNav} pathname={pathname} isAgent />
        <NavSectionGroup section={knowledgeNav} pathname={pathname} />
        <NavSectionGroup section={automationNav} pathname={pathname} />
        <NavSectionGroup section={settingsNav} pathname={pathname} />
      </ScrollArea>
    </aside>
  )
}
