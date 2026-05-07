import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, CheckCircle2, Loader2, Zap, BarChart3, AlertTriangle, Pencil, Info, AlertCircle, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { periodsApi } from '@/api/periods'
import { readingsApi } from '@/api/readings'
import { billsApi } from '@/api/bills'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatCurrency, cn } from '@/lib/utils'
import { periodStatusLabel, periodStatusVariant, billStatusLabel, billStatusVariant } from '@/lib/statusMaps'
import type {
  PeriodResponse, BillResponse, MeterReadingResponse,
  EvnInvoiceResponse, PaymentMethod, PeriodReviewResponse, UpdatePeriodRequest, BillStatus,
} from '@/types/api'

type Tab = 'invoices' | 'readings' | 'bills'
type BillSortCol = 'customerCode' | 'consumption' | 'unitPrice' | 'serviceFee' | 'totalAmount' | 'paidAmount' | 'status' | ''
type ReadingSortCol = 'customerCode' | 'previousIndex' | 'currentIndex' | 'consumption' | 'readAt' | ''

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-0.5 inline flex-shrink-0" />
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-0.5 inline flex-shrink-0" />
    : <ArrowDown className="h-3 w-3 ml-0.5 inline flex-shrink-0" />
}

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

function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="px-3 py-2.5 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-mono text-sm font-semibold', highlight ? 'text-amber-400' : '')}>
        {value}
      </span>
    </div>
  )
}

export default function PeriodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin, isAccountant } = useAuth()
  const periodId = Number(id)

  const [period, setPeriod] = useState<PeriodResponse | null>(null)
  const [bills, setBills] = useState<BillResponse[]>([])
  const [readings, setReadings] = useState<MeterReadingResponse[]>([])
  const [invoices, setInvoices] = useState<EvnInvoiceResponse[]>([])
  const [tab, setTab] = useState<Tab>('readings')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [readingInputs, setReadingInputs] = useState<Record<number, string>>({})
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [recentlyDoneId, setRecentlyDoneId] = useState<number | null>(null)

  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false)
  const [paymentBill, setPaymentBill] = useState<BillResponse | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewData, setReviewData] = useState<PeriodReviewResponse | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  const [editingReadingId, setEditingReadingId] = useState<number | null>(null)
  const [editReadingInput, setEditReadingInput] = useState('')
  const [editPeriodOpen, setEditPeriodOpen] = useState(false)
  const [editPeriodForm, setEditPeriodForm] = useState<UpdatePeriodRequest>({})
  const [editPeriodSaving, setEditPeriodSaving] = useState(false)
  const [editPeriodError, setEditPeriodError] = useState<string | null>(null)

  const [billSearch, setBillSearch] = useState('')
  const [billStatusFilter, setBillStatusFilter] = useState<BillStatus | 'ALL'>('ALL')
  const [billSort, setBillSort] = useState<{ col: BillSortCol; dir: 'asc' | 'desc' }>({ col: '', dir: 'asc' })

  const [readingSearch, setReadingSearch] = useState('')
  const [readingSubmittedFilter, setReadingSubmittedFilter] = useState<'ALL' | 'SUBMITTED' | 'PENDING'>('ALL')
  const [readingSort, setReadingSort] = useState<{ col: ReadingSortCol; dir: 'asc' | 'desc' }>({ col: '', dir: 'asc' })

  const [invoiceForm, setInvoiceForm] = useState({
    invoiceDate: '', invoiceNumber: '', kwh: '', amount: '',
  })
  const [paymentForm, setPaymentForm] = useState({
    amount: '', method: 'CASH' as PaymentMethod, paidAt: nowLocalDatetime(), notes: '',
  })

  const loadData = useCallback(
    () =>
      Promise.all([
        periodsApi.get(periodId),
        periodsApi.listReadings(periodId),
        isAccountant ? periodsApi.listInvoices(periodId) : Promise.resolve([] as EvnInvoiceResponse[]),
        isAccountant ? periodsApi.listBills(periodId) : Promise.resolve([] as BillResponse[]),
      ]).then(([p, r, inv, b]) => {
        setPeriod(p)
        setReadings(r)
        setInvoices(inv)
        setBills(b)
      }),
    [periodId, isAccountant],
  )

  useEffect(() => {
    setLoading(true)
    loadData().catch(console.error).finally(() => setLoading(false))
  }, [loadData])

  useEffect(() => {
    if (recentlyDoneId === null) return
    const t = setTimeout(() => setRecentlyDoneId(null), 1200)
    return () => clearTimeout(t)
  }, [recentlyDoneId])

  async function handleAction(action: 'calculate' | 'approve' | 'revert' | 'close' | 'verify') {
    let closeMsg = 'Đóng kỳ này?'
    if (action === 'close') {
      const unpaid = bills.filter((b) => b.status !== 'PAID')
      if (unpaid.length > 0) {
        const remaining = unpaid.reduce((s, b) => s + b.totalAmount - b.paidAmount, 0)
        closeMsg = `Đóng kỳ này?\n\n⚠️ ${unpaid.length} hộ chưa thanh toán đủ (còn lại ${formatCurrency(remaining)}).\nBạn vẫn có thể đóng và theo dõi công nợ sau.`
      }
    }
    const confirmMsg: Record<typeof action, string> = {
      calculate: 'Tính tiền cho kỳ này?',
      approve: 'Duyệt kỳ này? Sau khi duyệt không thể sửa dữ liệu.',
      revert: 'Hoàn về OPEN?\n\nTất cả hóa đơn đã tính sẽ bị xóa.\nChỉ số đồng hồ được giữ nguyên.\nBạn có thể sửa chỉ số và tính lại sau.',
      close: closeMsg,
      verify: 'Xác nhận đã đối chiếu hóa đơn EVN?',
    }
    if (!window.confirm(confirmMsg[action])) return
    setActionLoading(action)
    try {
      const updated = await periodsApi[action](periodId)
      setPeriod(updated)
      if (action === 'calculate' || action === 'approve') {
        const newBills = await periodsApi.listBills(periodId)
        setBills(newBills)
        setTab('bills')
      } else if (action === 'revert') {
        setBills([])
        const newReadings = await periodsApi.listReadings(periodId)
        setReadings(newReadings)
      }
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi thực hiện.'))
    } finally {
      setActionLoading(null)
    }
  }

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
      alert(apiError(e, 'Lỗi thêm hóa đơn EVN.'))
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
      alert(apiError(e, 'Lỗi xóa.'))
    }
  }

  async function handleSubmitReading(reading: MeterReadingResponse) {
    const val = readingInputs[reading.id]
    const currentIndex = Number(val)
    if (!val || isNaN(currentIndex) || currentIndex < reading.previousIndex) {
      alert('Chỉ số mới phải ≥ chỉ số cũ.')
      return
    }
    setSubmittingId(reading.id)
    try {
      const updated = await readingsApi.submit(reading.id, currentIndex)
      const next = readings.map((r) => (r.id === updated.id ? updated : r))
      setReadings(next)
      setReadingInputs((prev) => { const n = { ...prev }; delete n[reading.id]; return n })
      setRecentlyDoneId(reading.id)
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi ghi chỉ số.'))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleEditReading(reading: MeterReadingResponse) {
    const currentIndex = Number(editReadingInput)
    if (!editReadingInput || isNaN(currentIndex) || currentIndex < reading.previousIndex) {
      alert('Chỉ số mới phải ≥ chỉ số cũ.')
      return
    }
    setSubmittingId(reading.id)
    try {
      const updated = await readingsApi.submit(reading.id, currentIndex)
      setReadings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setEditingReadingId(null)
      setEditReadingInput('')
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi sửa chỉ số.'))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleEditPeriod(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setEditPeriodSaving(true)
    setEditPeriodError(null)
    try {
      const updated = await periodsApi.update(periodId, editPeriodForm)
      setPeriod(updated)
      setEditPeriodOpen(false)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setEditPeriodError(err.response?.data?.error ?? 'Không thể cập nhật kỳ.')
    } finally {
      setEditPeriodSaving(false)
    }
  }

  async function handleReview() {
    setReviewData(null)
    setReviewOpen(true)
    setReviewLoading(true)
    try {
      const data = await periodsApi.review(periodId)
      setReviewData(data)
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi tải dữ liệu đối chiếu.'))
      setReviewOpen(false)
    } finally {
      setReviewLoading(false)
    }
  }

  async function handleSubmitAllReadings() {
    if (!window.confirm('Xác nhận hoàn thành ghi chỉ số kỳ này?')) return
    setActionLoading('submitReadings')
    try {
      const updated = await periodsApi.submitReadings(periodId)
      setPeriod(updated)
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi nộp kỳ.'))
    } finally {
      setActionLoading(null)
    }
  }

  function openPaymentForm(bill: BillResponse) {
    setPaymentBill(bill)
    setPaymentForm({
      amount: String(bill.totalAmount - bill.paidAmount),
      method: 'CASH',
      paidAt: nowLocalDatetime(),
      notes: '',
    })
  }

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
      alert(apiError(e, 'Lỗi ghi thu.'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkSent(bill: BillResponse) {
    try {
      const updated = await billsApi.markSent(bill.id)
      setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi đánh dấu.'))
    }
  }

  async function handleZaloLink(bill: BillResponse) {
    try {
      const url = await billsApi.zaloLink(bill.id)
      if (url) window.open(url, '_blank')
      else alert('Khách hàng không có Zalo hoặc chưa cấu hình QR.')
    } catch (e: unknown) {
      alert(apiError(e, 'Lỗi lấy link Zalo.'))
    }
  }

  const displayBills = useMemo(() => {
    let result = [...bills]
    if (billSearch.trim()) {
      const q = billSearch.toLowerCase()
      result = result.filter((b) =>
        b.customerCode.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q)
      )
    }
    if (billStatusFilter !== 'ALL') {
      result = result.filter((b) => b.status === billStatusFilter)
    }
    if (billSort.col) {
      const col = billSort.col
      const dir = billSort.dir === 'asc' ? 1 : -1
      result.sort((a, b) => {
        const av = a[col as keyof BillResponse]
        const bv = b[col as keyof BillResponse]
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv, 'vi') * dir
        return 0
      })
    }
    return result
  }, [bills, billSearch, billStatusFilter, billSort])

  function toggleSort(col: BillSortCol) {
    setBillSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  const displayReadings = useMemo(() => {
    let result = [...readings]
    if (readingSearch.trim()) {
      const q = readingSearch.toLowerCase()
      result = result.filter((r) =>
        r.customerCode.toLowerCase().includes(q) ||
        r.customerFullName.toLowerCase().includes(q)
      )
    }
    if (readingSubmittedFilter === 'SUBMITTED') result = result.filter((r) => r.submitted)
    else if (readingSubmittedFilter === 'PENDING') result = result.filter((r) => !r.submitted)
    if (readingSort.col) {
      const col = readingSort.col
      const dir = readingSort.dir === 'asc' ? 1 : -1
      result.sort((a, b) => {
        if (col === 'readAt') {
          const av = a.readAt ? new Date(a.readAt).getTime() : -Infinity
          const bv = b.readAt ? new Date(b.readAt).getTime() : -Infinity
          return (av - bv) * dir
        }
        const av = a[col as keyof MeterReadingResponse]
        const bv = b[col as keyof MeterReadingResponse]
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv, 'vi') * dir
        return 0
      })
    } else {
      result.sort((a, b) => {
        if (a.submitted === b.submitted) return a.customerCode.localeCompare(b.customerCode, 'vi')
        return a.submitted ? 1 : -1
      })
    }
    return result
  }, [readings, readingSearch, readingSubmittedFilter, readingSort])

  function toggleReadingSort(col: ReadingSortCol) {
    setReadingSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!period) return <div className="p-6 text-destructive">Không tìm thấy kỳ.</div>

  const canAddInvoice = isAccountant && !['APPROVED', 'CLOSED'].includes(period.status)
  const canSubmitReadings = period.status === 'OPEN' || period.status === 'READING_DONE'
  const showBillActions = period.status === 'APPROVED' || period.status === 'CLOSED'
  const submittedCount = readings.filter((r) => r.submitted).length
  const totalConsumption = readings.filter((r) => r.submitted).reduce((sum, r) => sum + r.consumption, 0)

  const tabList: [Tab, string][] = [
    ...(isAccountant ? [['invoices', `HD EVN (${invoices.length})`] as [Tab, string]] : []),
    ['readings', `Chỉ số (${submittedCount}/${readings.length})`],
    ...(isAccountant ? [['bills', `Hóa đơn (${bills.length})`] as [Tab, string]] : []),
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
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
                onClick={() => {
                  setEditPeriodForm({ name: period.name, serviceFee: period.serviceFee, extraFee: period.extraFee })
                  setEditPeriodError(null)
                  setEditPeriodOpen(true)
                }}
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

      {/* ── Summary (3 stage-aware sections) ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* A — EVN invoice */}
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Hóa đơn EVN
          </p>
          {period.evnTotalKwh === 0 ? (
            <p className="text-xs text-muted-foreground italic">Chưa nhập hóa đơn EVN</p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Tổng kWh</span>
                <span className="font-mono text-sm font-semibold">
                  {period.evnTotalKwh.toLocaleString('vi-VN')} kWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Tổng tiền</span>
                <span className="font-mono text-sm font-semibold">{formatCurrency(period.evnTotalAmount)}</span>
              </div>
              {period.extraFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Phụ phí</span>
                  <span className="font-mono text-sm font-semibold">{formatCurrency(period.extraFee)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* B — Meter readings */}
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Chỉ số đồng hồ
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Đã ghi</span>
              <span className="font-mono text-sm font-semibold">{submittedCount}/{readings.length} hộ</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Tiêu thụ thực tế</span>
              <span className="font-mono text-sm font-semibold">
                {totalConsumption.toLocaleString('vi-VN')} kWh
              </span>
            </div>
          </div>
        </div>

        {/* C — Calculation results */}
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Kết quả tính toán
          </p>
          {['CALCULATED', 'APPROVED', 'CLOSED'].includes(period.status) ? (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Đơn giá điện</span>
                <span className="font-mono text-sm font-semibold">
                  {period.unitPrice
                    ? `${period.unitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ/kWh`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Phí ghi điện</span>
                <span className="font-mono text-sm font-semibold">{formatCurrency(period.serviceFee)}/hộ</span>
              </div>
              {period.accountantVerifiedAt && (
                <div className="flex items-center gap-1 text-xs text-emerald-400 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{period.accountantVerifiedBy} đã đối chiếu</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground italic">Chưa tính tiền</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Phí ghi điện</span>
                <span className="font-mono text-sm font-semibold">{formatCurrency(period.serviceFee)}/hộ</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ──────────────────────────────────────────────── */}
      {(canAddInvoice ||
        period.status === 'READING_DONE' ||
        period.status === 'CALCULATED' ||
        period.status === 'APPROVED') && (
        <div className="flex flex-wrap gap-2 rounded-lg border p-3 bg-muted/20">
          {canAddInvoice && (
            <Button size="sm" onClick={() => setAddInvoiceOpen(true)}>
              <Plus className="h-4 w-4" /> Thêm HD EVN
            </Button>
          )}
          {period.status === 'READING_DONE' && isAccountant && (
            <>
              <Button size="sm" variant="outline" onClick={handleReview}>
                <BarChart3 className="h-3.5 w-3.5" /> Xem đối chiếu
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={actionLoading === 'calculate' || invoices.length === 0}
                title={invoices.length === 0 ? 'Cần thêm hóa đơn EVN trước' : undefined}
                onClick={() => handleAction('calculate')}
              >
                {actionLoading === 'calculate' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tính...</>
                ) : invoices.length === 0 ? (
                  <><AlertTriangle className="h-3.5 w-3.5" /> Tính tiền</>
                ) : 'Tính tiền'}
              </Button>
            </>
          )}
          {period.status === 'CALCULATED' && (
            <>
              {isAccountant && (
                <Button size="sm" variant="outline" onClick={handleReview}>
                  <BarChart3 className="h-3.5 w-3.5" /> Xem đối chiếu
                </Button>
              )}
              {isAccountant && !period.accountantVerifiedAt && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionLoading === 'verify'}
                  onClick={() => handleAction('verify')}
                >
                  {actionLoading === 'verify' ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang đối chiếu...</>
                  ) : 'Đã đối chiếu EVN'}
                </Button>
              )}
              {period.accountantVerifiedAt && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {period.accountantVerifiedBy} đã đối chiếu
                </span>
              )}
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    disabled={actionLoading === 'approve' || !period.accountantVerifiedAt}
                    title={!period.accountantVerifiedAt ? 'Cần kế toán đối chiếu trước' : undefined}
                    onClick={() => handleAction('approve')}
                  >
                    {actionLoading === 'approve' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang duyệt...</>
                    ) : 'Duyệt kỳ'}
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
            </>
          )}
          {period.status === 'APPROVED' && isAdmin && (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading === 'revert'}
                onClick={() => handleAction('revert')}
              >
                {actionLoading === 'revert' ? 'Đang hoàn về...' : 'Hoàn về'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading === 'close'}
                onClick={() => handleAction('close')}
              >
                {actionLoading === 'close' ? 'Đang đóng...' : 'Đóng kỳ'}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div
        className="flex gap-0 overflow-x-auto"
        style={{ borderBottom: '1px solid hsl(var(--border))' }}
      >
        {tabList.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── EVN Invoices tab ──────────────────────────────────────── */}
      {tab === 'invoices' && (
        <div className="rounded-lg border bg-card">
          <div
            className="px-5 py-4"
            style={{ borderBottom: invoices.length > 0 ? '1px solid hsl(var(--border))' : undefined }}
          >
            <span className="text-sm font-semibold">Hóa đơn EVN</span>
          </div>
          {invoices.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-muted-foreground">Chưa có hóa đơn EVN.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    {['Ngày', 'Số HĐ', 'kWh', 'Số tiền'].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                          h === 'kWh' || h === 'Số tiền' ? 'text-right' : 'text-left',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                    {canAddInvoice && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-accent/40 transition-colors"
                      style={i < invoices.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                    >
                      <td className="px-4 py-3 text-sm">{inv.invoiceDate}</td>
                      <td className="px-4 py-3 font-mono text-sm">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {inv.kwh.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatCurrency(inv.amount)}
                      </td>
                      {canAddInvoice && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteInvoice(inv)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Readings tab ─────────────────────────────────────────────── */}
      {tab === 'readings' && (
        <>
          {/* Progress bar (mobile prominent, desktop compact) */}
          {readings.length > 0 && (
            <div
              className="rounded-lg border bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Tiến độ đọc chỉ số
                </span>
                <span className="font-mono text-sm font-bold text-primary">
                  {submittedCount}/{readings.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((submittedCount / readings.length) * 100)}%`,
                    background: submittedCount === readings.length
                      ? 'hsl(152 60% 40%)'
                      : 'hsl(var(--primary))',
                  }}
                />
              </div>
              {submittedCount === readings.length && (
                <p className="text-xs text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tất cả đã ghi — kỳ sẵn sàng tính tiền
                </p>
              )}
              {period.status === 'OPEN' && user?.role === 'METER_READER' && (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionLoading === 'submitReadings'}
                    onClick={handleSubmitAllReadings}
                  >
                    {actionLoading === 'submitReadings' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nộp...</>
                    ) : 'Hoàn thành kỳ này'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Info banner for correction guidance */}
          {['READING_DONE', 'CALCULATED'].includes(period.status) && isAdmin && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2.5 text-sm text-blue-400">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Để sửa chỉ số đồng hồ, dùng nút <strong>Hoàn về</strong> trong thanh thao tác để quay về trạng thái OPEN.
              </span>
            </div>
          )}

          {/* ── Desktop table ── */}
          <div className="hidden md:block rounded-lg border bg-card">
            {/* Header with search + filter */}
            <div className="px-5 pt-4 pb-3 space-y-2.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Chỉ số công tơ</span>
                {(readingSearch || readingSubmittedFilter !== 'ALL') && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {displayReadings.length}/{readings.length} hộ
                  </span>
                )}
              </div>
              {readings.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-36">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Tìm khách hàng..."
                      value={readingSearch}
                      onChange={(e) => setReadingSearch(e.target.value)}
                      className="h-8 text-sm pl-8 pr-7"
                    />
                    {readingSearch && (
                      <button
                        onClick={() => setReadingSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={readingSubmittedFilter}
                    onChange={(e) => setReadingSubmittedFilter(e.target.value as 'ALL' | 'SUBMITTED' | 'PENDING')}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="SUBMITTED">Đã ghi</option>
                    <option value="PENDING">Chưa đọc</option>
                  </select>
                </div>
              )}
            </div>
            {readings.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-muted-foreground">Chưa có dữ liệu chỉ số.</p>
            ) : displayReadings.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-muted-foreground">Không tìm thấy hộ phù hợp.</p>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    {([
                      ['customerCode', 'Khách hàng', false],
                      ['previousIndex', 'Chỉ số cũ', true],
                      ['currentIndex', 'Chỉ số mới', true],
                      ['consumption', 'Tiêu thụ', true],
                      ['readAt', 'Đọc lúc', false],
                    ] as [ReadingSortCol, string, boolean][]).map(([col, label, right]) => (
                      <th
                        key={col}
                        className={cn('px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground', right ? 'text-right' : 'text-left')}
                      >
                        <button
                          onClick={() => toggleReadingSort(col)}
                          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                        >
                          {label}
                          <SortIcon active={readingSort.col === col} dir={readingSort.dir} />
                        </button>
                      </th>
                    ))}
                    {canSubmitReadings && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {displayReadings.map((r, i) => (
                    <tr
                      key={r.id}
                      className={cn(
                        'data-row transition-colors',
                        !r.submitted ? 'hover:bg-amber-500/5' : 'hover:bg-accent/40',
                      )}
                      style={{
                        ...(i < displayReadings.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}),
                        ...(!r.submitted ? { background: 'hsl(38 95% 53% / 0.03)' } : {}),
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-primary">{r.customerCode}</span>
                        <span className="text-muted-foreground ml-2">{r.customerFullName}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{r.previousIndex}</td>
                      <td className="px-4 py-3 text-right">
                        {r.submitted ? (
                          editingReadingId === r.id ? (
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={r.previousIndex}
                              value={editReadingInput}
                              onChange={(e) => setEditReadingInput(e.target.value)}
                              className="h-7 w-24 text-right font-mono ml-auto"
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono">{r.currentIndex}</span>
                          )
                        ) : canSubmitReadings ? (
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={r.previousIndex}
                            value={readingInputs[r.id] ?? ''}
                            onChange={(e) =>
                              setReadingInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            className="h-7 w-24 text-right font-mono ml-auto"
                            placeholder={String(r.previousIndex)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.submitted ? r.consumption : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {r.readAt ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground text-xs">
                              {new Date(r.readAt).toLocaleString('vi-VN')}
                            </span>
                            {r.warning && (
                              <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                                <AlertTriangle className="h-3 w-3" /> Bất thường
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-400 text-xs font-medium">Chưa đọc</span>
                        )}
                      </td>
                      {canSubmitReadings && (
                        <td className="px-4 py-3">
                          {!r.submitted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={submittingId === r.id || !readingInputs[r.id]}
                              onClick={() => handleSubmitReading(r)}
                            >
                              {submittingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : 'Ghi'}
                            </Button>
                          ) : period.status === 'OPEN' && editingReadingId === r.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                disabled={submittingId === r.id || !editReadingInput}
                                onClick={() => handleEditReading(r)}
                              >
                                {submittingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lưu'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingReadingId(null); setEditReadingInput('') }}
                              >
                                Hủy
                              </Button>
                            </div>
                          ) : period.status === 'OPEN' ? (
                            <button
                              onClick={() => { setEditingReadingId(r.id); setEditReadingInput(String(r.currentIndex)) }}
                              className="p-1.5 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                              title="Sửa chỉ số"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* ── Mobile reading cards ── */}
          <div className="md:hidden space-y-3">
            {readings.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-36">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Tìm khách hàng..."
                    value={readingSearch}
                    onChange={(e) => setReadingSearch(e.target.value)}
                    className="h-8 text-sm pl-8 pr-7"
                  />
                  {readingSearch && (
                    <button
                      onClick={() => setReadingSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={readingSubmittedFilter}
                  onChange={(e) => setReadingSubmittedFilter(e.target.value as 'ALL' | 'SUBMITTED' | 'PENDING')}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="SUBMITTED">Đã ghi</option>
                  <option value="PENDING">Chưa đọc</option>
                </select>
                {(readingSearch || readingSubmittedFilter !== 'ALL') && (
                  <span className="text-xs text-muted-foreground">{displayReadings.length}/{readings.length}</span>
                )}
              </div>
            )}
            {displayReadings.length === 0 && readings.length > 0 && (
              <p className="py-6 text-sm text-center text-muted-foreground">Không tìm thấy hộ phù hợp.</p>
            )}
            {displayReadings.map((r) => {
              const isDone = r.submitted
              const isJustDone = recentlyDoneId === r.id

              return (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-xl overflow-hidden transition-all duration-300',
                    isJustDone ? 'reading-card-done' : '',
                  )}
                  style={{
                    background: isDone ? 'hsl(152 60% 40% / 0.05)' : 'hsl(38 95% 53% / 0.04)',
                    border: isDone ? '1px solid hsl(152 60% 40% / 0.2)' : '1px solid hsl(38 95% 53% / 0.2)',
                    borderLeftWidth: '3px',
                    borderLeftColor: isDone
                      ? (isJustDone ? 'hsl(152 60% 40%)' : 'hsl(152 60% 40% / 0.6)')
                      : 'hsl(38 95% 53% / 0.7)',
                  }}
                >
                  <div className="p-4">
                    {/* Customer info row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-mono text-sm font-bold"
                            style={{ color: isDone ? 'hsl(152 60% 40%)' : 'hsl(var(--primary))' }}
                          >
                            {r.customerCode}
                          </span>
                          {isDone && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã ghi
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground mt-0.5 font-medium">
                          {r.customerFullName}
                        </p>
                      </div>
                      {!isDone && (
                        <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                          Chưa đọc
                        </span>
                      )}
                    </div>

                    {/* Reading values */}
                    {isDone ? (
                      editingReadingId === r.id ? (
                        <div className="flex gap-2 mt-1 mb-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min={r.previousIndex}
                            value={editReadingInput}
                            onChange={(e) => setEditReadingInput(e.target.value)}
                            className="flex-1 h-12 text-center font-mono text-lg"
                            autoFocus
                          />
                          <Button
                            className="h-12 px-4"
                            disabled={submittingId === r.id || !editReadingInput}
                            onClick={() => handleEditReading(r)}
                          >
                            {submittingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-12 px-3"
                            onClick={() => { setEditingReadingId(null); setEditReadingInput('') }}
                          >
                            Hủy
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mb-1">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cũ</p>
                            <p className="font-mono text-base font-semibold text-foreground">
                              {r.previousIndex}
                            </p>
                          </div>
                          <span className="text-muted-foreground mt-2">→</span>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mới</p>
                            <p className="font-mono text-base font-semibold text-foreground">
                              {r.currentIndex}
                            </p>
                          </div>
                          <span className="text-muted-foreground mt-2">=</span>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tiêu thụ</p>
                            <p className="font-mono text-base font-bold text-emerald-400">
                              {r.consumption} kWh
                            </p>
                          </div>
                          {period.status === 'OPEN' && (
                            <button
                              onClick={() => { setEditingReadingId(r.id); setEditReadingInput(String(r.currentIndex)) }}
                              className="ml-auto p-1.5 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                              title="Sửa chỉ số"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="mr-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Chỉ số cũ</p>
                          <p className="font-mono text-base font-semibold text-foreground">
                            {r.previousIndex}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Input area for unsubmitted */}
                    {!isDone && canSubmitReadings && (
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={r.previousIndex}
                          value={readingInputs[r.id] ?? ''}
                          onChange={(e) =>
                            setReadingInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="flex-1 h-12 text-center font-mono text-lg"
                          placeholder={String(r.previousIndex)}
                          autoComplete="off"
                        />
                        <Button
                          className="h-12 px-5 font-semibold"
                          disabled={submittingId === r.id || !readingInputs[r.id]}
                          onClick={() => handleSubmitReading(r)}
                        >
                          {submittingId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Timestamp for submitted */}
                    {isDone && r.readAt && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {new Date(r.readAt).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {isDone && r.warning && (
                      <div className="flex items-center gap-1.5 mt-1.5 rounded px-2 py-1 bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                        <span className="text-xs text-amber-400">{r.warning}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Bills tab ────────────────────────────────────────────────── */}
      {tab === 'bills' && (
        <div className="rounded-lg border bg-card">
          {/* Header: title + search + filter */}
          <div className="px-5 pt-4 pb-3 space-y-2.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Hóa đơn khách hàng</span>
              {(billSearch || billStatusFilter !== 'ALL') && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {displayBills.length}/{bills.length} hóa đơn
                </span>
              )}
            </div>
            {bills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-36">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Tìm khách hàng..."
                    value={billSearch}
                    onChange={(e) => setBillSearch(e.target.value)}
                    className="h-8 text-sm pl-8 pr-7"
                  />
                  {billSearch && (
                    <button
                      onClick={() => setBillSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={billStatusFilter}
                  onChange={(e) => setBillStatusFilter(e.target.value as BillStatus | 'ALL')}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  {(['PENDING', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE'] as const).map((s) => (
                    <option key={s} value={s}>{billStatusLabel[s]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {bills.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-muted-foreground">
              Chưa có hóa đơn — cần tính tiền trước.
            </p>
          ) : displayBills.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-muted-foreground">
              Không tìm thấy hóa đơn phù hợp.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      {/* Khách hàng — sortable */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('customerCode')}>
                          Khách hàng <SortIcon active={billSort.col === 'customerCode'} dir={billSort.dir} />
                        </button>
                      </th>
                      {/* kWh */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('consumption')}>
                          kWh <SortIcon active={billSort.col === 'consumption'} dir={billSort.dir} />
                        </button>
                      </th>
                      {/* Đơn giá */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('unitPrice')}>
                          Đơn giá <SortIcon active={billSort.col === 'unitPrice'} dir={billSort.dir} />
                        </button>
                      </th>
                      {/* Phí DV */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('serviceFee')}>
                          Phí DV <SortIcon active={billSort.col === 'serviceFee'} dir={billSort.dir} />
                        </button>
                      </th>
                      {/* Tổng tiền */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('totalAmount')}>
                          Tổng tiền <SortIcon active={billSort.col === 'totalAmount'} dir={billSort.dir} />
                        </button>
                      </th>
                      {/* Đã trả */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('paidAmount')}>
                          Đã trả <SortIcon active={billSort.col === 'paidAmount'} dir={billSort.dir} />
                        </button>
                      </th>
                      {/* Trạng thái */}
                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
                          Trạng thái <SortIcon active={billSort.col === 'status'} dir={billSort.dir} />
                        </button>
                      </th>
                      {showBillActions && isAccountant && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left">
                          Thao tác
                        </th>
                      )}
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
                          <span className="font-mono font-semibold text-primary">{b.customerCode}</span>
                          <span className="text-muted-foreground ml-2">{b.customerName}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{b.consumption}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {b.unitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.serviceFee)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.paidAmount)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={billStatusVariant[b.status]}>
                            {billStatusLabel[b.status]}
                          </Badge>
                        </td>
                        {showBillActions && isAccountant && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {['PENDING', 'SENT', 'PARTIAL'].includes(b.status) && (
                                <Button size="sm" variant="outline" onClick={() => openPaymentForm(b)}>
                                  Ghi thu
                                </Button>
                              )}
                              {b.status === 'PENDING' && (
                                <Button size="sm" variant="ghost" onClick={() => handleMarkSent(b)}>
                                  Gửi
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleZaloLink(b)}>
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

              {/* Mobile bill cards */}
              <div className="md:hidden divide-y" style={{ borderColor: 'hsl(var(--border) / 0.6)' }}>
                {displayBills.map((b) => (
                  <div key={b.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-primary text-sm">{b.customerCode}</span>
                        <p className="text-sm text-foreground">{b.customerName}</p>
                      </div>
                      <Badge variant={billStatusVariant[b.status]}>
                        {billStatusLabel[b.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">kWh</p>
                        <p className="font-mono text-sm font-semibold">{b.consumption}</p>
                      </div>
                      <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tổng tiền</p>
                        <p className="font-mono text-xs font-semibold">{formatCurrency(b.totalAmount)}</p>
                      </div>
                      <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Đã trả</p>
                        <p className="font-mono text-xs font-semibold">{formatCurrency(b.paidAmount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Đơn giá: <span className="font-mono text-foreground">
                          {b.unitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ/kWh
                        </span>
                      </span>
                      <span className="text-border">•</span>
                      <span>
                        Phí DV: <span className="font-mono text-foreground">{formatCurrency(b.serviceFee)}</span>
                      </span>
                    </div>
                    {showBillActions && isAccountant && ['PENDING', 'SENT', 'PARTIAL'].includes(b.status) && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
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
                        {b.status === 'PENDING' && (
                          <Button size="sm" variant="ghost" onClick={() => handleMarkSent(b)}>
                            Gửi
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleZaloLink(b)}>
                          Zalo
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Review / Pre-calculate dialog ──────────────────────────── */}
      <Dialog open={reviewOpen} onOpenChange={(o) => { if (!o) setReviewOpen(false) }}>
        <DialogContent title="Đối chiếu kỳ — Xem trước tính toán">
          {reviewLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviewData ? (
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

              {/* EVN */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Hóa đơn EVN
                </p>
                <div className="rounded-md border divide-y">
                  <ReviewRow label="Tổng kWh EVN" value={`${reviewData.evnTotalKwh.toLocaleString('vi-VN')} kWh`} />
                  <ReviewRow label="Tổng tiền EVN" value={formatCurrency(reviewData.evnTotalAmount)} />
                  {reviewData.extraFee > 0 && (
                    <ReviewRow label="Phụ phí" value={formatCurrency(reviewData.extraFee)} />
                  )}
                </div>
              </div>

              {/* Loss */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Hao hụt điện
                  </p>
                  {reviewData.lossWarning && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      <AlertTriangle className="h-3 w-3" /> Vượt ngưỡng
                    </span>
                  )}
                </div>
                <div className="rounded-md border divide-y">
                  <ReviewRow
                    label="Tiêu thụ thực tế"
                    value={`${reviewData.totalActualConsumption.toLocaleString('vi-VN')} kWh`}
                  />
                  <ReviewRow
                    label="Hao hụt (EVN − thực tế)"
                    value={`${reviewData.lossKwh.toLocaleString('vi-VN')} kWh`}
                  />
                  <ReviewRow
                    label="Tỉ lệ hao hụt"
                    value={`${reviewData.lossPercentage.toFixed(1)}%`}
                    highlight={reviewData.lossWarning}
                  />
                </div>
              </div>

              {/* Preview calculation */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Dự kiến tính toán
                </p>
                <div className="rounded-md border divide-y">
                  <ReviewRow
                    label="Đơn giá điện"
                    value={`${reviewData.previewUnitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ/kWh`}
                  />
                  <ReviewRow label="Phí ghi điện" value={`${formatCurrency(reviewData.serviceFee)}/hộ`} />
                  <ReviewRow label="Số hộ tính tiền" value={`${reviewData.activeBillCount} hộ`} />
                  <ReviewRow label="Tổng dự kiến" value={formatCurrency(reviewData.totalBillsAmount)} />
                  {reviewData.roundingDifference !== 0 && (
                    <ReviewRow
                      label="Chênh lệch làm tròn"
                      value={formatCurrency(Math.abs(reviewData.roundingDifference))}
                    />
                  )}
                </div>
              </div>

              {/* Verification */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Đối chiếu kế toán
                </p>
                <div className="rounded-md border divide-y">
                  <ReviewRow
                    label="Số phiếu đã ghi"
                    value={`${reviewData.submittedReadingCount} / ${reviewData.activeBillCount}`}
                  />
                  {reviewData.accountantVerifiedAt ? (
                    <div className="px-3 py-2.5 flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-sm">
                        {reviewData.accountantVerifiedBy} đã đối chiếu lúc{' '}
                        {new Date(reviewData.accountantVerifiedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 text-sm text-muted-foreground italic">Chưa đối chiếu</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Add EVN Invoice dialog ──────────────────────────────────── */}
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
                onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="inv-num">Số hóa đơn</Label>
              <Input
                id="inv-num"
                required
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inv-kwh">kWh</Label>
                <Input
                  id="inv-kwh"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  required
                  value={invoiceForm.kwh}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, kwh: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="inv-amount">Số tiền (VND)</Label>
                <Input
                  id="inv-amount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  required
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddInvoiceOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={actionLoading === 'addInvoice'}>
                {actionLoading === 'addInvoice' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
                ) : 'Lưu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Period dialog ──────────────────────────────────────── */}
      <Dialog open={editPeriodOpen} onOpenChange={(o) => { if (!o) setEditPeriodOpen(false) }}>
        <DialogContent title={`Chỉnh sửa — ${period.code}`}>
          <form onSubmit={handleEditPeriod} className="space-y-3">
            <div>
              <Label htmlFor="ep-name">Tên kỳ</Label>
              <Input
                id="ep-name"
                value={editPeriodForm.name ?? ''}
                onChange={(e) => setEditPeriodForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ep-svc">Phí ghi điện (đ/hộ)</Label>
                <Input
                  id="ep-svc"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={editPeriodForm.serviceFee ?? ''}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, serviceFee: Number(e.target.value) }))}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="ep-fee">Phụ phí (VND)</Label>
                <Input
                  id="ep-fee"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={editPeriodForm.extraFee ?? ''}
                  onChange={(e) => setEditPeriodForm((f) => ({ ...f, extraFee: Number(e.target.value) }))}
                  className="font-mono"
                />
              </div>
            </div>
            {editPeriodError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {editPeriodError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditPeriodOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={editPeriodSaving}>
                {editPeriodSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : 'Lưu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment dialog ───────────────────────────────────── */}
      <Dialog
        open={paymentBill !== null}
        onOpenChange={(o) => { if (!o) setPaymentBill(null) }}
      >
        <DialogContent title={`Ghi thu — ${paymentBill?.customerCode} ${paymentBill?.customerName}`}>
          <form onSubmit={handleAddPayment} className="space-y-3">
            <div>
              <Label htmlFor="pay-amount">Số tiền (VND)</Label>
              <Input
                id="pay-amount"
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
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
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{methodLabel[m]}</option>
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
                onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pay-notes">Ghi chú</Label>
              <Input
                id="pay-notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPaymentBill(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={actionLoading === 'payment'}>
                {actionLoading === 'payment' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
                ) : 'Ghi thu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
