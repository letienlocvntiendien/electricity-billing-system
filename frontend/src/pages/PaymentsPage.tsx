import { useEffect, useState } from 'react'
import { Banknote, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { paymentsApi } from '@/api/payments'
import { periodsApi } from '@/api/periods'
import { useToast } from '@/context/ToastContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatCurrency, cn } from '@/lib/utils'
import type { PaymentResponse, PeriodResponse, BillResponse } from '@/types/api'

function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PaymentsPage() {
  const toast = useToast()

  const [payments, setPayments] = useState<PaymentResponse[]>([])
  const [loading, setLoading] = useState(true)

  // Assign dialog state
  const [assignTarget, setAssignTarget] = useState<PaymentResponse | null>(null)
  const [periods, setPeriods] = useState<PeriodResponse[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | ''>('')
  const [periodBills, setPeriodBills] = useState<BillResponse[]>([])
  const [selectedBillId, setSelectedBillId] = useState<number | ''>('')
  const [billsLoading, setBillsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load periods once when dialog first opens
  useEffect(() => {
    if (assignTarget && periods.length === 0) {
      periodsApi.list().then(setPeriods).catch(() => {})
    }
  }, [assignTarget, periods.length])

  // Load bills when period changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedPeriodId) { setPeriodBills([]); setSelectedBillId(''); return }
    setBillsLoading(true)
    periodsApi
      .listBills(selectedPeriodId)
      .then((bills) => {
        // Only show unpaid bills
        setPeriodBills(bills.filter((b) => b.status !== 'PAID'))
        setSelectedBillId('')
      })
      .catch(() => {})
      .finally(() => setBillsLoading(false))
  }, [selectedPeriodId])

  async function loadPayments() {
    setLoading(true)
    try {
      const data = await paymentsApi.listUnmatched()
      setPayments(data)
    } catch {
      toast.error('Không thể tải danh sách thanh toán chưa khớp.')
    } finally {
      setLoading(false)
    }
  }

  function openAssign(payment: PaymentResponse) {
    setAssignTarget(payment)
    setSelectedPeriodId('')
    setSelectedBillId('')
    setPeriodBills([])
  }

  function closeAssign() {
    setAssignTarget(null)
  }

  async function handleAssign() {
    if (!assignTarget || !selectedBillId) return
    setSubmitting(true)
    try {
      await paymentsApi.assign(assignTarget.id, Number(selectedBillId))
      setPayments((prev) => prev.filter((p) => p.id !== assignTarget.id))
      toast.success('Đã gán thanh toán vào hóa đơn thành công.')
      closeAssign()
    } catch (e) {
      toast.error(apiError(e, 'Lỗi khi gán thanh toán.'))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedBill = periodBills.find((b) => b.id === Number(selectedBillId))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'hsl(var(--primary) / 0.15)' }}
          >
            <Banknote className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Thanh toán chưa khớp</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Các giao dịch SePay không tự động nhận diện được hóa đơn
            </p>
          </div>
          {!loading && (
            <Badge variant={payments.length > 0 ? 'warning' : 'success'} className="ml-2">
              {payments.length}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadPayments} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Làm mới'}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-sm text-muted-foreground">Tất cả giao dịch SePay đã được khớp</p>
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid hsl(var(--border))' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--accent) / 0.4)' }}>
                {['Ngày GD', 'Số tiền', 'Mã GD ngân hàng', 'Nội dung chuyển khoản', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr
                  key={p.id}
                  className="hover:bg-accent/30 transition-colors"
                  style={i < payments.length - 1 ? { borderBottom: '1px solid hsl(var(--border))' } : {}}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(p.paidAt)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-400 whitespace-nowrap">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.bankTransactionId ?? '—'}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="text-xs text-foreground/80 line-clamp-2 break-all">
                      {p.rawContent ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openAssign(p)}>
                      Gán hóa đơn
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignTarget !== null} onOpenChange={(open) => { if (!open) closeAssign() }}>
        <DialogContent title="Gán vào hóa đơn">
          {assignTarget && (
            <div className="space-y-5">
              {/* Payment summary */}
              <div
                className="rounded-lg px-4 py-3 space-y-1.5 text-sm"
                style={{ background: 'hsl(var(--accent) / 0.4)', border: '1px solid hsl(var(--border))' }}
              >
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Số tiền</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(assignTarget.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Ngày GD</span>
                  <span className="font-mono text-xs">{fmtDate(assignTarget.paidAt)}</span>
                </div>
                {assignTarget.rawContent && (
                  <div className="pt-1">
                    <span className="text-muted-foreground text-xs block mb-0.5">Nội dung</span>
                    <span className="text-xs break-all">{assignTarget.rawContent}</span>
                  </div>
                )}
              </div>

              {/* Period select */}
              <div className="space-y-1.5">
                <Label>Kỳ điện</Label>
                <select
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-sm bg-background',
                    'border-input focus:outline-none focus:ring-1 focus:ring-ring',
                  )}
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Chọn kỳ điện —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bill select */}
              <div className="space-y-1.5">
                <Label>Hóa đơn</Label>
                {billsLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
                  </div>
                ) : (
                  <select
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-sm bg-background',
                      'border-input focus:outline-none focus:ring-1 focus:ring-ring',
                      !selectedPeriodId && 'opacity-50 cursor-not-allowed',
                    )}
                    value={selectedBillId}
                    disabled={!selectedPeriodId}
                    onChange={(e) => setSelectedBillId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">— Chọn hóa đơn —</option>
                    {periodBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.customerCode} — {b.customerName} — còn nợ {formatCurrency(b.totalAmount - b.paidAmount)}
                      </option>
                    ))}
                  </select>
                )}
                {selectedPeriodId && !billsLoading && periodBills.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Không có hóa đơn chưa thanh toán trong kỳ này
                  </p>
                )}
              </div>

              {/* Selected bill preview */}
              {selectedBill && (
                <div
                  className="rounded-md px-3 py-2.5 text-xs space-y-1"
                  style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}
                >
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng tiền hóa đơn</span>
                    <span className="font-mono font-semibold">{formatCurrency(selectedBill.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã thu</span>
                    <span className="font-mono">{formatCurrency(selectedBill.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Còn lại</span>
                    <span className="font-mono font-semibold text-amber-400">
                      {formatCurrency(selectedBill.totalAmount - selectedBill.paidAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={closeAssign} disabled={submitting}>
                  Huỷ
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedBillId || submitting}
                  onClick={handleAssign}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Xác nhận gán
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
