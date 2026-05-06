import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, TrendingUp, Zap } from 'lucide-react'
import { periodsApi } from '@/api/periods'
import { Badge } from '@/components/ui/badge'
import { periodStatusLabel, periodStatusVariant } from '@/lib/statusMaps'
import type { PeriodResponse } from '@/types/api'

export default function DashboardPage() {
  const [periods, setPeriods] = useState<PeriodResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    periodsApi.list()
      .then(setPeriods)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const openPeriod = periods.find((p) =>
    p.status === 'OPEN' || p.status === 'READING_DONE' || p.status === 'CALCULATED'
  )
  const approvedPeriods = periods.filter((p) => p.status === 'APPROVED')
  const closedPeriods = periods.filter((p) => p.status === 'CLOSED')

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Tổng quan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tình trạng hệ thống điện khu phố</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-glow rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Kỳ đang xử lý
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground leading-tight">
                {openPeriod?.name ?? '—'}
              </p>
              {openPeriod && (
                <Badge variant={periodStatusVariant[openPeriod.status]} className="mt-2">
                  {periodStatusLabel[openPeriod.status]}
                </Badge>
              )}
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
            >
              <Zap className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="card-glow rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Kỳ đã duyệt
              </p>
              <p className="mt-2 font-mono text-3xl font-bold text-foreground">
                {approvedPeriods.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">kỳ chờ đóng sổ</p>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: 'hsl(152 60% 40% / 0.12)', color: 'hsl(152 60% 40%)' }}
            >
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="card-glow rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tổng số kỳ
              </p>
              <p className="mt-2 font-mono text-3xl font-bold text-foreground">
                {periods.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{closedPeriods.length} đã đóng</p>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: 'hsl(215 80% 60% / 0.12)', color: 'hsl(215 80% 60%)' }}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Period list */}
      <div className="rounded-lg border bg-card">
        <div
          className="flex items-center gap-2.5 px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Danh sách kỳ thanh toán</span>
        </div>
        <div className="p-3 space-y-1">
          {loading ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Đang tải...</p>
          ) : periods.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Chưa có kỳ nào.</p>
          ) : (
            periods.map((p) => (
              <Link
                key={p.id}
                to={`/periods/${p.id}`}
                className="data-row flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-accent/60 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    {p.startDate} → {p.endDate}
                  </p>
                </div>
                <Badge variant={periodStatusVariant[p.status]}>
                  {periodStatusLabel[p.status]}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
