import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-primary/15 text-primary border border-primary/25',
        secondary:
          'bg-secondary text-secondary-foreground border border-border',
        destructive:
          'bg-destructive/15 text-destructive border border-destructive/25',
        outline:
          'border border-border text-muted-foreground',
        success:
          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
        warning:
          'bg-amber-500/10 text-amber-400 border border-amber-500/25',
        partial:
          'bg-orange-500/10 text-orange-400 border border-orange-500/25',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
