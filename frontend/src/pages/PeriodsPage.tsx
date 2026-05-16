import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, Pencil, Loader2, AlertCircle, AlertTriangle, ChevronRight, Search, X } from 'lucide-react'
import { SortIcon } from '@/components/SortIcon'
import { periodsApi } from '@/api/periods'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { periodStatusLabel, periodStatusVariant } from '@/lib/statusMaps'
import { useAuth } from '@/context/AuthContext'
import type { PeriodResponse, CreatePeriodRequest, UpdatePeriodRequest } from '@/types/api'

const LOCKED = new Set(['APPROVED', 'CLOSED'])

type SortKey = 'name' | 'startDate' | 'status' | 'evnKwh' | 'unitPrice'
type StatusFilter = 'all' | 'active' | 'APPROVED' | 'CLOSED'

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Tất cả',
  active: 'Đang xử lý',
  APPROVED: 'Đã duyệt',
  CLOSED: 'Đã đóng',
}

export default function PeriodsPage() {
  const { isAdmin } = useAuth()
  const [periods, setPeriods] = useState<PeriodResponse[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PeriodResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<CreatePeriodRequest>({
    name: '', startDate: '', endDate: '', serviceFee: 10000,
  })
  const [editForm, setEditForm] = useState<UpdatePeriodRequest>({})

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

  function openCreate() {
    setCreateForm({ name: '', startDate: '', endDate: '', serviceFee: 10000 })
    setSaveError(null)
    setCreateOpen(true)
  }

  function openEdit(p: PeriodResponse) {
    setEditTarget(p)
    setEditForm({ name: p.name, extraFee: p.extraFee, serviceFee: p.serviceFee })
    setSaveError(null)
  }

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir(col === 'startDate' || col === 'evnKwh' || col === 'unitPrice' ? 'desc' : 'asc') }
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
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'startDate') cmp = a.startDate.localeCompare(b.startDate)
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortKey === 'evnKwh') cmp = a.evnTotalKwh - b.evnTotalKwh
      else if (sortKey === 'unitPrice') cmp = (a.unitPrice ?? 0) - (b.unitPrice ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [periods, search, statusFilter, sortKey, sortDir])

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const created = await periodsApi.create(createForm)
      setPeriods((prev) => [created, ...prev])
      setCreateOpen(false)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setSaveError(e.response?.data?.error ?? 'Không thể tạo kỳ.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await periodsApi.update(editTarget.id, editForm)
      setPeriods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setEditTarget(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setSaveError(e.response?.data?.error ?? 'Không thể cập nhật.')
    } finally {
      setSaving(false)
    }
  }

  const isFiltered = search.trim() !== '' || statusFilter !== 'all'

  return (
    <div className="p-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
          >
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Kỳ thanh toán</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground">
                {isFiltered
                  ? `${displayPeriods.length} / ${periods.length} kỳ`
                  : `${periods.length} kỳ`}
              </p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={openCreate}
            className="shadow-[0_0_0_1px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_14px_hsl(var(--primary)/0.35)] transition-shadow duration-300"
          >
            <Plus className="h-4 w-4" /> Tạo kỳ mới
          </Button>
        )}
      </div>

      {/* Search + filter bar */}
      {!loading && periods.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc mã kỳ..."
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

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Đang tải...</p>
        ) : periods.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Chưa có kỳ nào.</p>
        ) : displayPeriods.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Không tìm thấy kết quả.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('name')}
                  >
                    <span className="inline-flex items-center gap-1">Tên kỳ <SortIcon active={sortKey === 'name'} dir={sortDir} /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('startDate')}
                  >
                    <span className="inline-flex items-center gap-1">Thời gian <SortIcon active={sortKey === 'startDate'} dir={sortDir} /></span>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('evnKwh')}
                  >
                    <span className="inline-flex items-center justify-end gap-1">EVN (kWh) <SortIcon active={sortKey === 'evnKwh'} dir={sortDir} /></span>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('unitPrice')}
                  >
                    <span className="inline-flex items-center justify-end gap-1">Đơn giá <SortIcon active={sortKey === 'unitPrice'} dir={sortDir} /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1">Trạng thái <SortIcon active={sortKey === 'status'} dir={sortDir} /></span>
                  </th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {displayPeriods.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`data-row hover:bg-accent/40 transition-colors ${p.status === 'CLOSED' ? 'opacity-55' : ''}`}
                    style={i < displayPeriods.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/periods/${p.id}`}
                        className="group/link inline-flex items-center gap-0.5 font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        {p.name}
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all duration-150" />
                      </Link>
                      <span className="font-mono text-[11px] text-muted-foreground ml-2">{p.code}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.startDate} → {p.endDate}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {p.evnTotalKwh.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {p.unitPrice ? formatCurrency(p.unitPrice) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={periodStatusVariant[p.status]}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1 flex-shrink-0" />
                        {periodStatusLabel[p.status]}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {!LOCKED.has(p.status) && (
                          <button
                            onClick={() => openEdit(p)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:scale-110 active:scale-95 transition-all duration-150 ml-auto"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false) }}>
        <DialogContent title="Tạo kỳ thanh toán mới">
          <form onSubmit={handleCreate} className="space-y-3">
            {periods.some((p) => !['CLOSED'].includes(p.status)) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>Vẫn còn kỳ chưa đóng. Chỉ số đồng hồ kỳ mới sẽ lấy từ lần ghi gần nhất của mỗi hộ.</span>
              </div>
            )}
            <div>
              <Label htmlFor="p-name">Tên kỳ *</Label>
              <Input
                id="p-name"
                required
                placeholder="Kỳ tháng 05/2025"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-start">Ngày bắt đầu *</Label>
                <Input
                  id="p-start"
                  type="date"
                  required
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="p-end">Ngày kết thúc *</Label>
                <Input
                  id="p-end"
                  type="date"
                  required
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="p-svc">Phí ghi điện (đ/hộ)</Label>
              <Input
                id="p-svc"
                type="number"
                inputMode="numeric"
                min="0"
                value={createForm.serviceFee}
                onChange={(e) => setCreateForm((f) => ({ ...f, serviceFee: Number(e.target.value) }))}
                className="font-mono"
              />
            </div>
            {saveError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {saveError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...</> : 'Tạo kỳ'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent title={`Chỉnh sửa — ${editTarget?.code}`}>
          <form onSubmit={handleUpdate} className="space-y-3">
            <div>
              <Label htmlFor="e-name">Tên kỳ</Label>
              <Input
                id="e-name"
                value={editForm.name ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="e-svc">Phí ghi điện (đ/hộ)</Label>
                <Input
                  id="e-svc"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={editForm.serviceFee ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, serviceFee: Number(e.target.value) }))}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="e-fee">Phụ phí (VND)</Label>
                <Input
                  id="e-fee"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={editForm.extraFee ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, extraFee: Number(e.target.value) }))}
                  className="font-mono"
                />
              </div>
            </div>
            {saveError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {saveError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : 'Lưu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
