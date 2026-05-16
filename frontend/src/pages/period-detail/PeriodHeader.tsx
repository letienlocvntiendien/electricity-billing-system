import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { periodStatusLabel, periodStatusVariant } from '@/lib/statusMaps'
import type { PeriodResponse } from '@/types/api'

interface Props {
  period: PeriodResponse
  isAccountant: boolean
  onEditClick: () => void
}

export function PeriodHeader({ period, isAccountant, onEditClick }: Props) {
  return (
    <div className="flex items-start gap-3">
      <Link
        to="/periods"
        className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg md:text-2xl font-bold leading-tight">{period.name}</h1>
          <Badge variant={periodStatusVariant[period.status]}>
            {periodStatusLabel[period.status]}
          </Badge>
          {isAccountant && !['APPROVED', 'CLOSED'].includes(period.status) && (
            <button
              onClick={onEditClick}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              title="Chỉnh sửa kỳ"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          {period.startDate} → {period.endDate}
        </p>
      </div>
    </div>
  )
}
