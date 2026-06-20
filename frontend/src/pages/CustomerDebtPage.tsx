import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, AlertTriangle, Search, X, ChevronDown, ChevronRight, Loader2, TrendingDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SortIcon } from '@/components/SortIcon'
import { formatCurrency, cn } from '@/lib/utils'
import { billStatusLabel, billStatusVariant } from '@/lib/statusMaps'
import client from '@/api/client'
import { useToast } from '@/context/ToastContext'
import type { ApiResponse, BillResponse, CustomerDebtSummaryResponse, PaymentMethod } from '@/types/api'

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  OTHER: 'Khác',
}

function nowLocalDatetime() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

type SortKey = 'customer' | 'remaining' | 'periods'

export default function CustomerDebtPage() {
  const toast = useToast()
  const [summaries, setSummaries] = useState<CustomerDebtSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('remaining')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [paymentBill, setPaymentBill] = useState<BillResponse | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CASH' as PaymentMethod,
    paidAt: nowLocalDatetime(),
    notes: '',
  })

  const fetchData = useCallback(() => {
    setLoading(true)
    client.get<ApiResponse<CustomerDebtSummaryResponse[]>>('/reports/customers-debt')
      .then(r => setSummaries(r.data.data ?? []))
      .catch(() => toast.error('Không thể tải dữ liệu công nợ'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir(col === 'customer' ? 'asc' : 'desc') }
  }

  function toggleExpand(customerId: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(customerId)) next.delete(customerId)
      else next.add(customerId)
      return next
    })
  }

  function openPayment(bill: BillResponse) {
    setPaymentBill(bill)
    setPaymentForm({
      amount: String(bill.totalAmount - bill.paidAmount),
      method: 'CASH',
      paidAt: nowLocalDatetime(),
      notes: '',
    })
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentBill) return
    setPaymentLoading(true)
    try {
      await client.post(`/bills/${paymentBill.id}/payments`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        paidAt: paymentForm.paidAt + ':00',
        notes: paymentForm.notes || undefined,
      })
      toast.success('Ghi thu thành công')
      setPaymentBill(null)
      fetchData()
    } catch {
      toast.error('Ghi thu thất bại')
    } finally {
      setPaymentLoading(false)
    }
  }

  const displayed = useMemo(() => {
    let r = summaries
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(s =>
        s.customerCode.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'customer') cmp = a.customerCode.localeCompare(b.customerCode)
      else if (sortKey === 'remaining') cmp = a.totalOutstanding - b.totalOutstanding
      else if (sortKey === 'periods') cmp = a.unpaidBillCount - b.unpaidBillCount
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [summaries, search, sortKey, sortDir])

  const totalCustomers = summaries.length
  const totalOutstanding = summaries.reduce((s, c) => s + c.totalOutstanding, 0)
  const totalBillCount = summaries.reduce((s, c) => s + c.unpaidBillCount, 0)
  const overdueCustomers = summaries.filter(c => c.worstStatus === 'OVERDUE').length

  return (
    <div className="p-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}
        >
          <TrendingDown className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Công nợ khách hàng</h1>
          <p className="text-xs text-muted-foreground">Tổng hợp các khoản chưa thu theo từng khách hàng</p>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Khách hàng có nợ</p>
            <p className="text-2xl font-bold font-mono mt-1">{totalCustomers}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Tổng tiền tồn đọng</p>
            <p className={cn('text-2xl font-bold font-mono mt-1', totalOutstanding > 0 && 'text-destructive')}>
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Số kỳ chưa đóng</p>
            <p className="text-2xl font-bold font-mono mt-1">{totalBillCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Khách hàng quá hạn</p>
            <p className={cn('text-2xl font-bold font-mono mt-1', overdueCustomers > 0 && 'text-destructive')}>
              {overdueCustomers}
            </p>
          </div>
        </div>
      )}

      {/* Main table card */}
      <div className="rounded-lg border bg-card">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">Danh sách công nợ</span>
            {!loading && (
              <span className="font-mono text-xs text-muted-foreground">
                ({search ? `${displayed.length} / ${summaries.length}` : summaries.length} khách hàng)
              </span>
            )}
          </div>
          {!loading && totalOutstanding > 0 && (
            <span className="font-mono text-sm font-semibold text-destructive">
              {formatCurrency(totalOutstanding)}
            </span>
          )}
        </div>

        {!loading && summaries.length > 0 && (
          <div className="px-5 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="relative max-w-sm">
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
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : summaries.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Users className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
            <p className="text-sm text-muted-foreground">Không có công nợ — tất cả đã thanh toán!</p>
          </div>
        ) : displayed.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Không tìm thấy kết quả.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <th className="w-8 px-3 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort('customer')}>
                      Khách hàng <SortIcon active={sortKey === 'customer'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    SĐT
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <button className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onClick={() => handleSort('periods')}>
                      Số kỳ nợ <SortIcon active={sortKey === 'periods'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                    Kỳ lâu nhất
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Phải đóng
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Đã đóng
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <button className="flex items-center justify-end gap-1 ml-auto hover:text-foreground transition-colors" onClick={() => handleSort('remaining')}>
                      Còn lại <SortIcon active={sortKey === 'remaining'} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    TT
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((customer, i) => {
                  const isExpanded = expandedIds.has(customer.customerId)
                  const showBorder = i < displayed.length - 1 || isExpanded
                  return (
                    <React.Fragment key={customer.customerId}>
                      <tr
                        className="hover:bg-accent/40 transition-colors cursor-pointer select-none"
                        style={showBorder ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                        onClick={() => toggleExpand(customer.customerId)}
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/customers/${customer.customerId}`}
                            className="hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <span className="font-mono font-semibold text-primary">{customer.customerCode}</span>
                            <span className="text-muted-foreground ml-2">{customer.customerName}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell">
                          {customer.customerPhone ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={customer.unpaidBillCount > 1 ? 'destructive' : 'secondary'}>
                            {customer.unpaidBillCount}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {customer.oldestUnpaidPeriodName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
                          {formatCurrency(customer.totalBilledAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
                          {formatCurrency(customer.totalPaidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-destructive">
                          {formatCurrency(customer.totalOutstanding)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={billStatusVariant[customer.worstStatus]}>
                            {billStatusLabel[customer.worstStatus]}
                          </Badge>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={9}
                            style={{ borderBottom: i < displayed.length - 1 ? '1px solid hsl(var(--border))' : undefined }}
                          >
                            <div
                              className="px-6 py-3"
                              style={{ background: 'hsl(var(--muted) / 0.3)' }}
                            >
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                                    <th className="text-left py-1.5 pb-2 text-muted-foreground font-medium">Kỳ điện</th>
                                    <th className="text-right py-1.5 pb-2 text-muted-foreground font-medium">kWh</th>
                                    <th className="text-right py-1.5 pb-2 text-muted-foreground font-medium hidden sm:table-cell">Phí DV</th>
                                    <th className="text-right py-1.5 pb-2 text-muted-foreground font-medium">Tổng cộng</th>
                                    <th className="text-right py-1.5 pb-2 text-muted-foreground font-medium">Đã đóng</th>
                                    <th className="text-right py-1.5 pb-2 text-muted-foreground font-medium">Còn nợ</th>
                                    <th className="text-left py-1.5 pb-2 text-muted-foreground font-medium pl-3">Trạng thái</th>
                                    <th className="py-1.5 pb-2" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {customer.bills.map(bill => (
                                    <tr
                                      key={bill.id}
                                      style={{ borderBottom: '1px solid hsl(var(--border) / 0.35)' }}
                                    >
                                      <td className="py-2">
                                        <Link
                                          to={`/periods/${bill.periodId}`}
                                          className="font-mono text-primary hover:underline"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {bill.periodName}
                                        </Link>
                                      </td>
                                      <td className="py-2 text-right font-mono">{bill.consumption}</td>
                                      <td className="py-2 text-right font-mono hidden sm:table-cell">
                                        {formatCurrency(bill.serviceFee)}
                                      </td>
                                      <td className="py-2 text-right font-mono">{formatCurrency(bill.totalAmount)}</td>
                                      <td className="py-2 text-right font-mono">{formatCurrency(bill.paidAmount)}</td>
                                      <td className="py-2 text-right font-mono font-semibold text-destructive">
                                        {formatCurrency(bill.totalAmount - bill.paidAmount)}
                                      </td>
                                      <td className="py-2 pl-3">
                                        <Badge variant={billStatusVariant[bill.status]}>
                                          {billStatusLabel[bill.status]}
                                        </Badge>
                                      </td>
                                      <td className="py-2 pl-2 text-right">
                                        {['PENDING', 'SENT', 'PARTIAL', 'OVERDUE'].includes(bill.status) && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-xs px-2"
                                            onClick={e => { e.stopPropagation(); openPayment(bill) }}
                                          >
                                            Ghi thu
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment dialog */}
      <Dialog open={paymentBill !== null} onOpenChange={o => { if (!o) setPaymentBill(null) }}>
        <DialogContent title={`Ghi thu — ${paymentBill?.customerCode} ${paymentBill?.customerName}`}>
          <form onSubmit={handlePaymentSubmit} className="space-y-3">
            {paymentBill && (
              <p className="text-xs text-muted-foreground">
                Kỳ: <span className="font-medium text-foreground">{paymentBill.periodName}</span>
              </p>
            )}
            <div>
              <Label htmlFor="pay-amount">Số tiền (VND)</Label>
              <Input
                id="pay-amount"
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              />
              {paymentBill && (
                <p className="text-xs text-muted-foreground mt-1">
                  Còn lại: {formatCurrency(paymentBill.totalAmount - paymentBill.paidAmount)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="pay-method">Hình thức</Label>
              <select
                id="pay-method"
                value={paymentForm.method}
                onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pay-at">Thời gian</Label>
              <Input
                id="pay-at"
                type="datetime-local"
                required
                value={paymentForm.paidAt}
                onChange={e => setPaymentForm(f => ({ ...f, paidAt: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pay-notes">Ghi chú</Label>
              <Input
                id="pay-notes"
                value={paymentForm.notes}
                onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPaymentBill(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={paymentLoading}>
                {paymentLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
                  : 'Ghi thu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
