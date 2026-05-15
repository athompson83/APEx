import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-indigo-600 text-white hover:bg-indigo-500",
        secondary:
          "border-transparent bg-slate-800 text-slate-300 hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-900/50 text-red-400 border-red-800",
        outline:
          "border-slate-700 text-slate-300",
        success:
          "border-transparent bg-emerald-900/50 text-emerald-400 border-emerald-800",
        warning:
          "border-transparent bg-amber-900/50 text-amber-400 border-amber-800",
        info:
          "border-transparent bg-sky-900/50 text-sky-400 border-sky-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
