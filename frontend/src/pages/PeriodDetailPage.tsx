import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { periodsApi } from '@/api/periods'
import { readingsApi } from '@/api/readings'
import { billsApi } from '@/api/bills'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import type {
  PeriodResponse, BillResponse, MeterReadingResponse,
  EvnInvoiceResponse, PeriodStatus, BillStatus, PaymentMethod,
} from '@/types/api'

const periodStatusLabel: Record<PeriodStatus, string> = {
  OPEN: 'Đang mở',
  READING_DONE: 'Xong chỉ số',
  CALCULATED: 'Đã tính',
  APPROVED: 'Đã duyệt',
  CLOSED: 'Đã đóng',
}

const billStatusLabel: Record<BillStatus, string> = {
  PENDING: 'Chờ thanh toán',
  SENT: 'Đã gửi',
  PARTIAL: 'Trả một phần',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
}

const billStatusVariant: Record<
  BillStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'outline' | 'destructive'
> = {
  PENDING: 'secondary',
  SENT: 'default',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'destructive',
}

type Tab = 'invoices' | 'readings' | 'bills'

const methodLabel: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Chuyển khoản',
  CASH: 'Tiền mặt',
  OTHER: 'Khác',
}

function nowLocalDatetime() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function PeriodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, isAccountant } = useAuth()
  const periodId = Number(id)

  const [period, setPeriod] = useState<PeriodResponse | null>(null)
  const [bills, setBills] = useState<BillResponse[]>([])
  const [readings, setReadings] = useState<MeterReadingResponse[]>([])
  const [invoices, setInvoices] = useState<EvnInvoiceResponse[]>([])
  const [tab, setTab] = useState<Tab>('readings')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Inline reading input per row
  const [readingInputs, setReadingInputs] = useState<Record<number, string>>({})
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  // Modals
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false)
  const [paymentBill, setPaymentBill] = useState<BillResponse | null>(null)

  // Add EVN invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceDate: '',
    invoiceNumber: '',
    kwh: '',
    amount: '',
  })

  // Record payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CASH' as PaymentMethod,
    paidAt: nowLocalDatetime(),
    notes: '',
  })

  const loadData = useCallback(
    () =>
      Promise.all([
        periodsApi.get(periodId),
        periodsApi.listReadings(periodId),
        periodsApi.listInvoices(periodId),
        periodsApi.listBills(periodId),
      ]).then(([p, r, inv, b]) => {
        setPeriod(p)
        setReadings(r)
        setInvoices(inv)
        setBills(b)
      }),
    [periodId],
  )

  useEffect(() => {
    setLoading(true)
    loadData().catch(console.error).finally(() => setLoading(false))
  }, [loadData])

  // ── Period lifecycle actions ──────────────────────────────────────────────

  async function handleAction(action: 'calculate' | 'approve' | 'revert' | 'close') {
    const confirmMsg: Record<typeof action, string> = {
      calculate: 'Tính tiền cho kỳ này?',
      approve: 'Duyệt kỳ này? Sau khi duyệt không thể sửa dữ liệu.',
      revert: 'Hoàn về OPEN? Tất cả hóa đơn sẽ bị xóa.',
      close: 'Đóng kỳ này?',
    }
    if (!window.confirm(confirmMsg[action])) return
    setActionLoading(action)
    try {
      const updated = await periodsApi[action](periodId)
      setPeriod(updated)
      await loadData()
      if (action === 'approve' || action === 'calculate') setTab('bills')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi thực hiện.')
    } finally {
      setActionLoading(null)
    }
  }

  // ── EVN invoice CRUD ──────────────────────────────────────────────────────

  async function handleAddInvoice(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setActionLoading('addInvoice')
    try {
      await periodsApi.createInvoice(periodId, {
        invoiceDate: invoiceForm.invoiceDate,
        invoiceNumber: invoiceForm.invoiceNumber,
        kwh: Number(invoiceForm.kwh),
        amount: Number(invoiceForm.amount),
      })
      const [updatedPeriod, newInvoices] = await Promise.all([
        periodsApi.get(periodId),
        periodsApi.listInvoices(periodId),
      ])
      setPeriod(updatedPeriod)
      setInvoices(newInvoices)
      setAddInvoiceOpen(false)
      setInvoiceForm({ invoiceDate: '', invoiceNumber: '', kwh: '', amount: '' })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi thêm hóa đơn EVN.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteInvoice(invoice: EvnInvoiceResponse) {
    if (!window.confirm(`Xóa hóa đơn EVN ${invoice.invoiceNumber}?`)) return
    try {
      await periodsApi.deleteInvoice(periodId, invoice.id)
      const [updatedPeriod, newInvoices] = await Promise.all([
        periodsApi.get(periodId),
        periodsApi.listInvoices(periodId),
      ])
      setPeriod(updatedPeriod)
      setInvoices(newInvoices)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi xóa.')
    }
  }

  // ── Meter reading submit ──────────────────────────────────────────────────

  async function handleSubmitReading(reading: MeterReadingResponse) {
    const val = readingInputs[reading.id]
    const currentIndex = Number(val)
    if (!val || isNaN(currentIndex) || currentIndex < reading.previousIndex) {
      alert('Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ.')
      return
    }
    setSubmittingId(reading.id)
    try {
      const updated = await readingsApi.submit(reading.id, currentIndex)
      setReadings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setReadingInputs((prev) => { const next = { ...prev }; delete next[reading.id]; return next })
      const updatedPeriod = await periodsApi.get(periodId)
      setPeriod(updatedPeriod)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi ghi chỉ số.')
    } finally {
      setSubmittingId(null)
    }
  }

  // ── Payment recording ─────────────────────────────────────────────────────

  async function handleAddPayment(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!paymentBill) return
    setActionLoading('payment')
    try {
      const paidAt = paymentForm.paidAt.length === 16
        ? paymentForm.paidAt + ':00'
        : paymentForm.paidAt
      await billsApi.addPayment(paymentBill.id, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        paidAt,
        notes: paymentForm.notes || undefined,
      })
      const newBills = await periodsApi.listBills(periodId)
      setBills(newBills)
      setPaymentBill(null)
      setPaymentForm({ amount: '', method: 'CASH', paidAt: nowLocalDatetime(), notes: '' })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi ghi thu.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkSent(bill: BillResponse) {
    try {
      const updated = await billsApi.markSent(bill.id)
      setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi đánh dấu.')
    }
  }

  async function handleZaloLink(bill: BillResponse) {
    try {
      const url = await billsApi.zaloLink(bill.id)
      if (url) window.open(url, '_blank')
      else alert('Khách hàng không có Zalo hoặc chưa cấu hình QR.')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error ?? 'Lỗi lấy link Zalo.')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-6 text-muted-foreground">Đang tải...</div>
  if (!period) return <div className="p-6 text-destructive">Không tìm thấy kỳ.</div>

  const canAddInvoice = isAccountant && !['APPROVED', 'CLOSED'].includes(period.status)
  const canSubmitReadings = period.status === 'OPEN' || period.status === 'READING_DONE'
  const showBillActions = period.status === 'APPROVED' || period.status === 'CLOSED'
  const submittedCount = readings.filter((r) => r.submitted).length

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/periods" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{period.name}</h1>
        <Badge>{periodStatusLabel[period.status]}</Badge>
        <span className="text-sm text-muted-foreground ml-auto">
          {period.startDate} → {period.endDate}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'EVN kWh', value: `${period.evnTotalKwh.toLocaleString('vi-VN')} kWh` },
          { label: 'EVN tiền', value: formatCurrency(period.evnTotalAmount) },
          {
            label: 'Đơn giá điện',
            value: period.unitPrice ? `${formatCurrency(period.unitPrice)}/kWh` : '—',
          },
          {
            label: 'Đơn giá DV',
            value: `${formatCurrency(period.serviceUnitPrice)}/kWh`,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action bar */}
      {(canAddInvoice ||
        period.status === 'READING_DONE' ||
        period.status === 'CALCULATED' ||
        period.status === 'APPROVED') && (
        <div className="flex gap-2 flex-wrap rounded-md border p-3 bg-muted/30">
          {canAddInvoice && (
            <Button size="sm" onClick={() => setAddInvoiceOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm HD EVN
            </Button>
          )}
          {period.status === 'READING_DONE' && isAccountant && (
            <Button
              size="sm"
              variant="secondary"
              disabled={actionLoading === 'calculate'}
              onClick={() => handleAction('calculate')}
            >
              {actionLoading === 'calculate' ? 'Đang tính...' : 'Tính tiền'}
            </Button>
          )}
          {period.status === 'CALCULATED' && isAdmin && (
            <>
              <Button
                size="sm"
                disabled={actionLoading === 'approve'}
                onClick={() => handleAction('approve')}
              >
                {actionLoading === 'approve' ? 'Đang duyệt...' : 'Duyệt kỳ'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading === 'revert'}
                onClick={() => handleAction('revert')}
              >
                {actionLoading === 'revert' ? 'Đang hoàn về...' : 'Hoàn về'}
              </Button>
            </>
          )}
          {period.status === 'APPROVED' && isAdmin && (
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading === 'close'}
              onClick={() => handleAction('close')}
            >
              {actionLoading === 'close' ? 'Đang đóng...' : 'Đóng kỳ'}
            </Button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b">
        {(
          [
            ['invoices', `HD EVN (${invoices.length})`],
            ['readings', `Chỉ số (${submittedCount}/${readings.length})`],
            ['bills', `Hóa đơn (${bills.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── EVN Invoices tab ──────────────────────────────────────────────── */}
      {tab === 'invoices' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hóa đơn EVN</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có hóa đơn EVN nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Ngày</th>
                      <th className="text-left py-2 px-3 font-medium">Số HĐ</th>
                      <th className="text-right py-2 px-3 font-medium">kWh</th>
                      <th className="text-right py-2 px-3 font-medium">Số tiền</th>
                      {canAddInvoice && <th className="py-2 px-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">{inv.invoiceDate}</td>
                        <td className="py-2 px-3 font-mono">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {inv.kwh.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(inv.amount)}
                        </td>
                        {canAddInvoice && (
                          <td className="py-2 px-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteInvoice(inv)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Readings tab ─────────────────────────────────────────────────── */}
      {tab === 'readings' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chỉ số công tơ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Khách hàng</th>
                    <th className="text-right py-2 px-3 font-medium">Chỉ số cũ</th>
                    <th className="text-right py-2 px-3 font-medium">Chỉ số mới</th>
                    <th className="text-right py-2 px-3 font-medium">Tiêu thụ</th>
                    <th className="text-left py-2 px-3 font-medium">Đọc lúc</th>
                    {canSubmitReadings && <th className="py-2 px-3" />}
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b hover:bg-muted/50 transition-colors ${
                        !r.submitted ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <span className="font-mono font-medium">{r.customerCode}</span>
                        <span className="text-muted-foreground ml-2">{r.customerFullName}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{r.previousIndex}</td>
                      <td className="py-2 px-3 text-right">
                        {r.submitted ? (
                          <span className="font-mono">{r.currentIndex}</span>
                        ) : canSubmitReadings ? (
                          <Input
                            type="number"
                            min={r.previousIndex}
                            value={readingInputs[r.id] ?? ''}
                            onChange={(e) =>
                              setReadingInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            className="h-7 w-24 text-right font-mono"
                            placeholder={String(r.previousIndex)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {r.submitted ? r.consumption : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-3 text-sm">
                        {r.readAt ? (
                          <span className="text-muted-foreground">
                            {new Date(r.readAt).toLocaleString('vi-VN')}
                          </span>
                        ) : (
                          <span className="text-yellow-600 font-medium">Chưa đọc</span>
                        )}
                      </td>
                      {canSubmitReadings && (
                        <td className="py-2 px-3">
                          {!r.submitted && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={submittingId === r.id || !readingInputs[r.id]}
                              onClick={() => handleSubmitReading(r)}
                            >
                              {submittingId === r.id ? '...' : 'Ghi'}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bills tab ────────────────────────────────────────────────────── */}
      {tab === 'bills' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hóa đơn khách hàng</CardTitle>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có hóa đơn. Cần tính tiền trước.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Khách hàng</th>
                      <th className="text-right py-2 px-3 font-medium">kWh</th>
                      <th className="text-right py-2 px-3 font-medium">Tổng tiền</th>
                      <th className="text-right py-2 px-3 font-medium">Đã trả</th>
                      <th className="text-left py-2 px-3 font-medium">Trạng thái</th>
                      {showBillActions && isAccountant && (
                        <th className="text-left py-2 px-3 font-medium">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => (
                      <tr key={b.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-3">
                          <span className="font-mono font-medium">{b.customerCode}</span>
                          <span className="text-muted-foreground ml-2">{b.customerName}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{b.consumption}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(b.totalAmount)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(b.paidAmount)}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={billStatusVariant[b.status]}>
                            {billStatusLabel[b.status]}
                          </Badge>
                        </td>
                        {showBillActions && isAccountant && (
                          <td className="py-2 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {['PENDING', 'SENT', 'PARTIAL'].includes(b.status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPaymentBill(b)
                                    setPaymentForm({
                                      amount: String(b.totalAmount - b.paidAmount),
                                      method: 'CASH',
                                      paidAt: nowLocalDatetime(),
                                      notes: '',
                                    })
                                  }}
                                >
                                  Ghi thu
                                </Button>
                              )}
                              {b.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMarkSent(b)}
                                >
                                  Gửi
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleZaloLink(b)}
                              >
                                Zalo
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Add EVN Invoice dialog ─────────────────────────────────────────── */}
      <Dialog open={addInvoiceOpen} onOpenChange={setAddInvoiceOpen}>
        <DialogContent title="Thêm hóa đơn EVN">
          <form onSubmit={handleAddInvoice} className="space-y-3">
            <div>
              <Label htmlFor="inv-date">Ngày hóa đơn</Label>
              <Input
                id="inv-date"
                type="date"
                required
                value={invoiceForm.invoiceDate}
                onChange={(e) =>
                  setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="inv-num">Số hóa đơn</Label>
              <Input
                id="inv-num"
                required
                value={invoiceForm.invoiceNumber}
                onChange={(e) =>
                  setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inv-kwh">kWh</Label>
                <Input
                  id="inv-kwh"
                  type="number"
                  min="0"
                  required
                  value={invoiceForm.kwh}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, kwh: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="inv-amount">Số tiền (VND)</Label>
                <Input
                  id="inv-amount"
                  type="number"
                  min="0"
                  required
                  value={invoiceForm.amount}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddInvoiceOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={actionLoading === 'addInvoice'}>
                {actionLoading === 'addInvoice' ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment dialog ──────────────────────────────────────────── */}
      <Dialog open={paymentBill !== null} onOpenChange={(o) => { if (!o) setPaymentBill(null) }}>
        <DialogContent title={`Ghi thu — ${paymentBill?.customerCode} ${paymentBill?.customerName}`}>
          <form onSubmit={handleAddPayment} className="space-y-3">
            <div>
              <Label htmlFor="pay-amount">Số tiền (VND)</Label>
              <Input
                id="pay-amount"
                type="number"
                min="1"
                required
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
              {paymentBill && (
                <p className="text-xs text-muted-foreground mt-1">
                  Còn lại:{' '}
                  {formatCurrency(paymentBill.totalAmount - paymentBill.paidAmount)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="pay-method">Hình thức</Label>
              <select
                id="pay-method"
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm((f) => ({
                    ...f,
                    method: e.target.value as PaymentMethod,
                  }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {methodLabel[m]}
                  </option>
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
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="pay-notes">Ghi chú</Label>
              <Input
                id="pay-notes"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentBill(null)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={actionLoading === 'payment'}>
                {actionLoading === 'payment' ? 'Đang lưu...' : 'Ghi thu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
