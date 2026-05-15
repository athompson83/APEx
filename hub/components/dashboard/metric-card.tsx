"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricType =
  | "revenue"
  | "tasks"
  | "conversations"
  | "documents"
  | "agents"
  | "workflows"
  | "default"

export interface SparklinePoint {
  value: number
  label?: string
}

export interface MetricCardProps {
  label: string
  value: string | number
  previousValue?: number
  trendPercent?: number
  trendDirection?: "up" | "down" | "neutral"
  trendPositive?: boolean
  subtitle?: string
  sparkline?: SparklinePoint[]
  metricType?: MetricType
  isLoading?: boolean
  className?: string
}

// ─── Color config ─────────────────────────────────────────────────────────────

const metricColors: Record<MetricType, { gradient: string; stroke: string; fill: string }> = {
  revenue: {
    gradient: "url(#grad-revenue)",
    stroke: "#10b981",
    fill: "rgba(16,185,129,0.15)",
  },
  tasks: {
    gradient: "url(#grad-tasks)",
    stroke: "#6366f1",
    fill: "rgba(99,102,241,0.15)",
  },
  conversations: {
    gradient: "url(#grad-conversations)",
    stroke: "#8b5cf6",
    fill: "rgba(139,92,246,0.15)",
  },
  documents: {
    gradient: "url(#grad-documents)",
    stroke: "#0ea5e9",
    fill: "rgba(14,165,233,0.15)",
  },
  agents: {
    gradient: "url(#grad-agents)",
    stroke: "#f59e0b",
    fill: "rgba(245,158,11,0.15)",
  },
  workflows: {
    gradient: "url(#grad-workflows)",
    stroke: "#f97316",
    fill: "rgba(249,115,22,0.15)",
  },
  default: {
    gradient: "url(#grad-default)",
    stroke: "#6366f1",
    fill: "rgba(99,102,241,0.15)",
  },
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  metricType = "default",
}: {
  data: SparklinePoint[]
  metricType?: MetricType
}) {
  const color = metricColors[metricType]
  const gradId = `spark-grad-${metricType}`

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color.stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <RechartsTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 shadow-lg">
                {payload[0].value}
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color.stroke}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: color.stroke }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  trendPercent,
  trendDirection,
  trendPositive,
  subtitle,
  sparkline,
  metricType = "default",
  isLoading = false,
  className,
}: MetricCardProps) {
  const isPositive = trendPositive ?? trendDirection === "up"
  const isNegative = !isPositive && trendDirection !== "neutral"

  if (isLoading) {
    return (
      <Card className={cn("border-slate-800 bg-slate-900", className)}>
        <CardContent className="p-4">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-12 w-full mt-3" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "border-slate-800 bg-slate-900 transition-shadow hover:shadow-lg hover:shadow-black/20",
        className
      )}
    >
      <CardContent className="p-4">
        {/* Label */}
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>

        {/* Value */}
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="font-mono text-2xl font-bold tracking-tight text-slate-100">
            {value}
          </span>

          {/* Trend */}
          {trendPercent != null && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                isPositive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : isNegative
                  ? "bg-red-500/10 text-red-400"
                  : "bg-slate-800 text-slate-500"
              )}
            >
              {trendDirection === "up" && <TrendingUp className="h-3 w-3" />}
              {trendDirection === "down" && <TrendingDown className="h-3 w-3" />}
              {trendDirection === "neutral" && <Minus className="h-3 w-3" />}
              {Math.abs(trendPercent).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        )}

        {/* Sparkline */}
        {sparkline && sparkline.length > 0 && (
          <div className="mt-3 -mx-1">
            <Sparkline data={sparkline} metricType={metricType} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
