"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Bell,
  Search,
  ChevronRight,
  Plus,
  Upload,
  Zap,
  LogOut,
  User,
  Settings,
  Moon,
  Sun,
  HelpCircle,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { getInitials } from "@/lib/utils"

// ─── Breadcrumb helpers ───────────────────────────────────────────────────────

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  search: "Search",
  agents: "Agents",
  "chief-of-staff": "Chief of Staff",
  operations: "Operations",
  sales: "Sales",
  "customer-success": "Customer Success",
  finance: "Finance",
  legal: "Legal",
  product: "Product",
  documents: "Documents",
  memory: "Memory",
  "knowledge-bases": "Knowledge Bases",
  workflows: "Workflows",
  integrations: "Integrations",
  settings: "Settings",
  organization: "Organization",
  team: "Team",
  "api-keys": "API Keys",
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return (
      <span className="text-sm font-medium text-slate-200">Dashboard</span>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1">
      {segments.map((segment, idx) => {
        const href = "/" + segments.slice(0, idx + 1).join("/")
        const label = routeLabels[segment] ?? segment
        const isLast = idx === segments.length - 1

        return (
          <React.Fragment key={href}>
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            )}
            {isLast ? (
              <span className="text-sm font-medium text-slate-200">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="text-sm text-slate-500 transition-colors hover:text-slate-300"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsButton() {
  const notificationCount = 3 // TODO: wire to real API

  return (
    <Button variant="ghost" size="icon" className="relative h-8 w-8 text-slate-400">
      <Bell className="h-4 w-4" />
      {notificationCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
          {notificationCount > 9 ? "9+" : notificationCount}
        </span>
      )}
      <span className="sr-only">Notifications ({notificationCount})</span>
    </Button>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
          <Plus className="h-4 w-4" />
          <span className="sr-only">Quick actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Search className="mr-2 h-4 w-4 text-slate-400" />
          New Chat with AI
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Upload className="mr-2 h-4 w-4 text-slate-400" />
          Upload Document
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Zap className="mr-2 h-4 w-4 text-slate-400" />
          Run Workflow
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── User Menu ────────────────────────────────────────────────────────────────

function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user
  const initials = getInitials(user?.name ?? "U")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 rounded-full ring-2 ring-transparent transition-all hover:ring-slate-700 focus:outline-none focus:ring-indigo-500">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.image ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <HelpCircle className="mr-2 h-4 w-4" />
            Help & Docs
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-400 focus:text-red-400"
          onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Search Trigger ───────────────────────────────────────────────────────────

function SearchTrigger({ onOpen }: { onOpen?: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3",
        "text-sm text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-400",
        "focus:outline-none focus:ring-1 focus:ring-indigo-500"
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="ml-2 hidden rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
        ⌘K
      </kbd>
    </button>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  onSearchOpen?: () => void
}

export function Header({ onSearchOpen }: HeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 flex h-12 w-full items-center gap-4 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <Breadcrumbs pathname={pathname} />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <SearchTrigger onOpen={onSearchOpen} />
        <NotificationsButton />
        <QuickActionsMenu />
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
