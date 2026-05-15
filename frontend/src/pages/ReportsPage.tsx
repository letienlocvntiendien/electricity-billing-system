import { useEffect, useMemo, useState } from 'react'
import { FileText, AlertTriangle, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import client from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { billStatusLabel, billStatusVariant } from '@/lib/statusMaps'
import type { ApiResponse, BillResponse } from '@/types/api'

type SortKey = 'customer' | 'period' | 'total' | 'remaining' | 'status'
type StatusFilter = 'all' | 'PENDING' | 'PARTIAL' | 'OVERDUE'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Tất cả',
  PENDING: 'Chưa trả',
  PARTIAL: 'Trả một phần',
  OVERDUE: 'Quá hạn',
}

export default function ReportsPage() {
  const [debtBills, setDebtBills] = useState<BillResponse[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('remaining')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    client.get<ApiResponse<BillResponse[]>>('/reports/debt')
      .then((r) => setDebtBills(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir(col === 'remaining' || col === 'total' ? 'desc' : 'asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const displayBills = useMemo(() => {
    let r = debtBills
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(b =>
        b.customerCode.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') r = r.filter(b => b.status === statusFilter)
    return [...r].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'customer') cmp = a.customerCode.localeCompare(b.customerCode)
      else if (sortKey === 'period') cmp = a.periodCode.localeCompare(b.periodCode)
      else if (sortKey === 'total') cmp = a.totalAmount - b.totalAmount
      else if (sortKey === 'remaining') cmp = (a.totalAmount - a.paidAmount) - (b.totalAmount - b.paidAmount)
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [debtBills, search, statusFilter, sortKey, sortDir])

  const totalOutstanding = displayBills.reduce((s, b) => s + b.totalAmount - b.paidAmount, 0)
  const isFiltered = search.trim() !== '' || statusFilter !== 'all'

  return (
    <div className="p-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}
        >
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Báo cáo</h1>
          <p className="text-xs text-muted-foreground">Công nợ và tình trạng thanh toán</p>
        </div>
      </div>

      {/* Debt table */}
      <div className="rounded-lg border bg-card">
        {/* Card header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">Công nợ chưa thu</span>
            {!loading && (
              <span className="font-mono text-xs text-muted-foreground">
                ({isFiltered ? `${displayBills.length} / ${debtBills.length}` : debtBills.length} hóa đơn)
              </span>
            )}
          </div>
          {!loading && totalOutstanding > 0 && (
            <span className="font-mono text-sm font-semibold text-destructive">
              {formatCurrency(totalOutstanding)}
            </span>
          )}
        </div>

        {/* Search + filter */}
        {!loading && debtBills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo mã hoặc tên khách hàng..."
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
              {(['all', 'PENDING', 'PARTIAL', 'OVERDUE'] as const).map(s => (
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
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Đang tải...</p>
        ) : debtBills.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Không có công nợ.</p>
        ) : displayBills.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Không tìm thấy kết quả.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('customer')}
                  >
                    <span className="inline-flex items-center gap-1">Khách hàng <SortIcon col="customer" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('period')}
                  >
                    <span className="inline-flex items-center gap-1">Kỳ <SortIcon col="period" /></span>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('total')}
                  >
                    <span className="inline-flex items-center justify-end gap-1">Tổng tiền <SortIcon col="total" /></span>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('remaining')}
                  >
                    <span className="inline-flex items-center justify-end gap-1">Còn lại <SortIcon col="remaining" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1">Trạng thái <SortIcon col="status" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayBills.map((b, i) => (
                  <tr
                    key={b.id}
                    className="data-row hover:bg-accent/40 transition-colors"
                    style={i < displayBills.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-primary">{b.customerCode}</span>
                      <span className="text-muted-foreground text-sm ml-2">{b.customerName}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.periodCode}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-destructive">
                      {formatCurrency(b.totalAmount - b.paidAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={billStatusVariant[b.status]}>
                        {billStatusLabel[b.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
