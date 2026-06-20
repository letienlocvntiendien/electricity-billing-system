import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Zap, Loader2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatCurrency, cn } from '@/lib/utils'
import { billStatusLabel, billStatusVariant } from '@/lib/statusMaps'
import client from '@/api/client'
import { useToast } from '@/context/ToastContext'
import type { ApiResponse, BillResponse, CustomerResponse, PaymentMethod } from '@/types/api'

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

export default function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [customer, setCustomer] = useState<CustomerResponse | null>(null)
  const [bills, setBills] = useState<BillResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [paymentBill, setPaymentBill] = useState<BillResponse | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CASH' as PaymentMethod,
    paidAt: nowLocalDatetime(),
    notes: '',
  })

  const fetchBills = useCallback(async () => {
    if (!id) return
    const res = await client.get<ApiResponse<BillResponse[]>>(`/customers/${id}/bills`)
    setBills(res.data.data ?? [])
  }, [id])

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [custRes, billsRes] = await Promise.all([
        client.get<ApiResponse<CustomerResponse>>(`/customers/${id}`),
        client.get<ApiResponse<BillResponse[]>>(`/customers/${id}/bills`),
      ])
      setCustomer(custRes.data.data)
      setBills(billsRes.data.data ?? [])
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      if (e.response?.status === 404) setNotFound(true)
      else toast.error('Không thể tải dữ liệu khách hàng')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { fetchData() }, [fetchData])

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
      await fetchBills()
    } catch {
      toast.error('Ghi thu thất bại')
    } finally {
      setPaymentLoading(false)
    }
  }

  const totalKwh = bills.reduce((s, b) => s + b.consumption, 0)
  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0)
  const totalPaid = bills.reduce((s, b) => s + b.paidAmount, 0)
  const totalOutstanding = totalBilled - totalPaid

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
      </div>
    )
  }

  if (notFound || !customer) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
        <p className="text-sm text-destructive">Không tìm thấy khách hàng.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Back + header */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Danh sách khách hàng
        </Button>

        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'hsl(215 80% 60% / 0.12)', color: 'hsl(215 80% 60%)' }}
          >
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold text-primary">{customer.code}</span>
              <span className="text-lg font-semibold text-foreground">{customer.fullName}</span>
              <Badge variant={customer.active ? 'success' : 'secondary'}>
                {customer.active ? 'Hoạt động' : 'Ngừng'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
              {customer.phone && <span>SĐT: <span className="font-mono text-foreground">{customer.phone}</span></span>}
              {customer.meterSerial && <span>Đồng hồ: <span className="font-mono text-foreground">{customer.meterSerial}</span></span>}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Số kỳ điện</p>
          <p className="text-2xl font-bold font-mono mt-1">{bills.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Tổng tiêu thụ</p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-2xl font-bold font-mono">{totalKwh.toLocaleString('vi-VN')}</p>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Zap className="h-3 w-3" /> kWh
            </span>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Tổng tiền phải đóng</p>
          <p className="text-xl font-bold font-mono mt-1">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Còn nợ</p>
          <p className={cn('text-xl font-bold font-mono mt-1', totalOutstanding > 0 ? 'text-destructive' : 'text-emerald-400')}>
            {totalOutstanding > 0 ? formatCurrency(totalOutstanding) : 'Đã đóng đủ'}
          </p>
        </div>
      </div>

      {/* History table */}
      <div className="rounded-lg border bg-card">
        <div
          className="px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <span className="text-sm font-semibold text-foreground">
            Lịch sử tiêu thụ điện
          </span>
          {bills.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground ml-2">
              ({bills.length} kỳ)
            </span>
          )}
        </div>

        {bills.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Zap className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
            <p className="text-sm text-muted-foreground">Khách hàng chưa có kỳ điện nào.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Kỳ điện</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">kWh</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Đơn giá</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tiền điện</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Phí DV</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tổng cộng</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Đã đóng</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Còn lại</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">TT</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, i) => {
                    const remaining = b.totalAmount - b.paidAmount
                    return (
                      <tr
                        key={b.id}
                        className="data-row hover:bg-accent/40 transition-colors"
                        style={i < bills.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={`/periods/${b.periodId}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {b.periodName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{b.consumption}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          {b.unitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.electricityAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.serviceAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(b.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.paidAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {remaining > 0
                            ? <span className="font-semibold text-destructive">{formatCurrency(remaining)}</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={billStatusVariant[b.status]}>
                            {billStatusLabel[b.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {['PENDING', 'SENT', 'PARTIAL', 'OVERDUE'].includes(b.status) && (
                            <Button size="sm" variant="outline" onClick={() => openPayment(b)}>
                              Ghi thu
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'hsl(var(--border) / 0.6)' }}>
              {bills.map((b) => {
                const remaining = b.totalAmount - b.paidAmount
                return (
                  <div key={b.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <Link to={`/periods/${b.periodId}`} className="font-semibold text-primary hover:underline">
                        {b.periodName}
                      </Link>
                      <Badge variant={billStatusVariant[b.status]}>
                        {billStatusLabel[b.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase">kWh</p>
                        <p className="font-mono text-sm font-semibold">{b.consumption}</p>
                      </div>
                      <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase">Tổng tiền</p>
                        <p className="font-mono text-xs font-semibold">{formatCurrency(b.totalAmount)}</p>
                      </div>
                      <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase">Còn lại</p>
                        <p className={cn('font-mono text-xs font-semibold', remaining > 0 ? 'text-destructive' : 'text-emerald-400')}>
                          {remaining > 0 ? formatCurrency(remaining) : '✓'}
                        </p>
                      </div>
                    </div>
                    {['PENDING', 'SENT', 'PARTIAL', 'OVERDUE'].includes(b.status) && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => openPayment(b)}>
                        Ghi thu
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
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
