import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, TrendingUp, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { periodsApi } from '@/api/periods'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { periodStatusLabel, periodStatusVariant } from '@/lib/statusMaps'
import type { PeriodResponse } from '@/types/api'

type SortKey = 'startDate' | 'name' | 'status'
type StatusFilter = 'all' | 'active' | 'APPROVED' | 'CLOSED'

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Tất cả',
  active: 'Đang xử lý',
  APPROVED: 'Đã duyệt',
  CLOSED: 'Đã đóng',
}

export default function DashboardPage() {
  const [periods, setPeriods] = useState<PeriodResponse[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('startDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    periodsApi.list()
      .then(setPeriods)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Stat cards always computed from full list — not affected by search/filter
  const openPeriod = periods.find((p) =>
    p.status === 'OPEN' || p.status === 'READING_DONE' || p.status === 'CALCULATED'
  )
  const approvedPeriods = periods.filter((p) => p.status === 'APPROVED')
  const closedPeriods = periods.filter((p) => p.status === 'CLOSED')

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir(col === 'startDate' ? 'desc' : 'asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const displayPeriods = useMemo(() => {
    let r = periods
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    }
    if (statusFilter === 'active') r = r.filter(p => ['OPEN', 'READING_DONE', 'CALCULATED'].includes(p.status))
    else if (statusFilter !== 'all') r = r.filter(p => p.status === statusFilter)
    return [...r].sort((a, b) => {
      const cmp = sortKey === 'name' ? a.name.localeCompare(b.name)
                : sortKey === 'status' ? a.status.localeCompare(b.status)
                : a.startDate.localeCompare(b.startDate)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [periods, search, statusFilter, sortKey, sortDir])

  const isFiltered = search.trim() !== '' || statusFilter !== 'all'

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Tổng quan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tình trạng hệ thống điện khu phố</p>
      </div>

      {/* Stat cards — always from full periods list */}
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
        {/* Card header */}
        <div
          className="flex items-center justify-between gap-2.5 px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Danh sách kỳ thanh toán</span>
            {!loading && isFiltered && (
              <span className="font-mono text-xs text-muted-foreground">
                ({displayPeriods.length} / {periods.length})
              </span>
            )}
          </div>
          {/* Sort controls */}
          {!loading && periods.length > 0 && (
            <div className="flex items-center gap-1">
              {(['startDate', 'name', 'status'] as const).map(col => (
                <button
                  key={col}
                  onClick={() => handleSort(col)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 h-7 rounded text-xs transition-colors',
                    sortKey === col
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                  )}
                >
                  {col === 'startDate' ? 'Ngày' : col === 'name' ? 'Tên' : 'Trạng thái'}
                  <SortIcon col={col} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search + filter */}
        {!loading && periods.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo tên kỳ..."
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center rounded-md border divide-x overflow-hidden text-xs">
              {(['all', 'active', 'APPROVED', 'CLOSED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 h-8 transition-colors',
                    statusFilter === s
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                  )}
                >
                  {STATUS_FILTER_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 space-y-1">
          {loading ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Đang tải...</p>
          ) : periods.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Chưa có kỳ nào.</p>
          ) : displayPeriods.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Không tìm thấy kết quả.</p>
          ) : (
            displayPeriods.map((p) => (
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
