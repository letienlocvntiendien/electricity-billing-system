import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { periodsApi } from '@/api/periods'
import { readingsApi } from '@/api/readings'
import { billsApi } from '@/api/bills'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'
import type {
  PeriodResponse, BillResponse, MeterReadingResponse,
  EvnInvoiceResponse, PaymentMethod, PeriodReviewResponse, UpdatePeriodRequest, BillStatus,
  SmsResultResponse,
} from '@/types/api'

export type Tab = 'invoices' | 'readings' | 'bills'
export type BillSortCol = 'customerCode' | 'consumption' | 'unitPrice' | 'serviceFee' | 'totalAmount' | 'paidAmount' | 'status' | ''
export type ReadingSortCol = 'customerCode' | 'previousIndex' | 'currentIndex' | 'consumption' | 'readAt' | ''

export const methodLabel: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Chuyển khoản',
  CASH: 'Tiền mặt',
  OTHER: 'Khác',
}

export function nowLocalDatetime() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

export function usePeriodDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin, isAccountant } = useAuth()
  const toast = useToast()
  const periodId = Number(id)

  const [period, setPeriod] = useState<PeriodResponse | null>(null)
  const [bills, setBills] = useState<BillResponse[]>([])
  const [readings, setReadings] = useState<MeterReadingResponse[]>([])
  const [invoices, setInvoices] = useState<EvnInvoiceResponse[]>([])
  const [tab, setTab] = useState<Tab>('readings')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 })
  const genPollerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const paymentPollerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const [selectedBillIds, setSelectedBillIds] = useState<Set<number>>(new Set())
  const [sendingSms, setSendingSms] = useState(false)
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
    async () => {
      setLoading(true)
      try {
        const [p, r, inv, b] = await Promise.all([
          periodsApi.get(periodId),
          periodsApi.listReadings(periodId),
          isAccountant ? periodsApi.listInvoices(periodId) : Promise.resolve([] as EvnInvoiceResponse[]),
          isAccountant ? periodsApi.listBills(periodId) : Promise.resolve([] as BillResponse[]),
        ])
        setPeriod(p)
        setReadings(r)
        setInvoices(inv)
        setBills(b)
      } finally {
        setLoading(false)
      }
    },
    [periodId, isAccountant],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData().catch(console.error)
  }, [loadData])

  useEffect(() => {
    return () => { if (genPollerRef.current) clearInterval(genPollerRef.current) }
  }, [])

  useEffect(() => {
    const isPollingPeriod = period?.status === 'APPROVED' || period?.status === 'CLOSED'
    if (!isAccountant || !isPollingPeriod || tab !== 'bills') {
      if (paymentPollerRef.current) { clearInterval(paymentPollerRef.current); paymentPollerRef.current = null }
      return
    }
    paymentPollerRef.current = setInterval(async () => {
      try {
        const updated = await periodsApi.listBills(periodId)
        setBills((prev) => {
          updated.forEach((newBill) => {
            const old = prev.find((b) => b.id === newBill.id)
            if (old && old.status !== 'PAID' && newBill.status === 'PAID') {
              toast.success(`Hóa đơn ${newBill.customerCode} (${newBill.customerName}) đã được thanh toán tự động.`)
            }
          })
          return updated
        })
      } catch { /* ignore poll errors */ }
    }, 30_000)
    return () => { if (paymentPollerRef.current) { clearInterval(paymentPollerRef.current); paymentPollerRef.current = null } }
  }, [period?.status, tab, isAccountant, periodId, toast])

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
        // Todo - show list of unpaid customers in a better way
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
      toast.error(apiError(e, 'Lỗi thực hiện.'))
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
      toast.error(apiError(e, 'Lỗi thêm hóa đơn EVN.'))
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
      toast.error(apiError(e, 'Lỗi xóa.'))
    }
  }

  async function handleSubmitReading(reading: MeterReadingResponse) {
    const val = readingInputs[reading.id]
    const currentIndex = Number(val)
    if (!val || isNaN(currentIndex) || currentIndex < reading.previousIndex) {
      toast.warning('Chỉ số mới phải ≥ chỉ số cũ.')
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
      toast.error(apiError(e, 'Lỗi ghi chỉ số.'))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleEditReading(reading: MeterReadingResponse) {
    const currentIndex = Number(editReadingInput)
    if (!editReadingInput || isNaN(currentIndex) || currentIndex < reading.previousIndex) {
      toast.warning('Chỉ số mới phải ≥ chỉ số cũ.')
      return
    }
    setSubmittingId(reading.id)
    try {
      const updated = await readingsApi.submit(reading.id, currentIndex)
      setReadings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setEditingReadingId(null)
      setEditReadingInput('')
    } catch (e: unknown) {
      toast.error(apiError(e, 'Lỗi sửa chỉ số.'))
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
      toast.error(apiError(e, 'Lỗi tải dữ liệu đối chiếu.'))
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
      toast.error(apiError(e, 'Lỗi nộp kỳ.'))
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
      toast.error(apiError(e, 'Lỗi ghi thu.'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkSent(bill: BillResponse) {
    try {
      const updated = await billsApi.markSent(bill.id)
      setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (e: unknown) {
      toast.error(apiError(e, 'Lỗi đánh dấu.'))
    }
  }

  async function handleZaloLink(bill: BillResponse) {
    try {
      const url = await billsApi.zaloLink(bill.id)
      if (url) window.open(url, '_blank')
      else toast.info('Khách hàng không có Zalo hoặc chưa cấu hình QR.')
    } catch (e: unknown) {
      toast.error(apiError(e, 'Lỗi lấy link Zalo.'))
    }
  }

  async function handleSendSms() {
    if (selectedBillIds.size === 0) return
    setSendingSms(true)
    try {
      const results: SmsResultResponse[] = await billsApi.sendSms(Array.from(selectedBillIds))
      const success = results.filter((r) => r.success).length
      const failed = results.length - success
      if (failed === 0) {
        toast.success(`Đã gửi SMS thành công cho ${success} khách hàng.`)
      } else {
        toast.info(`Gửi thành công ${success}/${results.length}. Thất bại ${failed} (không có SĐT hoặc chưa có QR).`)
      }
      setSelectedBillIds(new Set())
    } catch (e: unknown) {
      toast.error(apiError(e, 'Lỗi gửi SMS.'))
    } finally {
      setSendingSms(false)
    }
  }

  async function handlePrintPack() {
    try {
      const response = await periodsApi.printPack(periodId)
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `print-pack-${period?.code}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      toast.error(apiError(e, 'Không thể tải print pack.'))
    }
  }

  async function handleViewPdf(bill: BillResponse) {
    try {
      const objectUrl = await billsApi.getPdf(bill.id)
      window.open(objectUrl, '_blank')
    } catch (e: unknown) {
      toast.error(apiError(e, 'Lỗi tải PDF.'))
    }
  }

  async function handleGenerateBills() {
    const total = bills.length
    if (total === 0) { toast.warning('Không có hóa đơn nào để tạo.'); return }

    setGenerating(true)
    setGenProgress({ done: 0, total })

    try {
      await periodsApi.generateBills(periodId)
    } catch (e: unknown) {
      toast.error(apiError(e, 'Lỗi tạo hóa đơn.'))
      setGenerating(false)
      return
    }

    let attempts = 0
    genPollerRef.current = setInterval(async () => {
      attempts++
      try {
        const updated = await periodsApi.listBills(periodId)
        const done = updated.filter((b) => b.qrCodeUrl != null && b.pdfUrl != null).length
        setGenProgress({ done, total: updated.length })

        if (done >= updated.length || attempts >= 180) {
          clearInterval(genPollerRef.current!)
          genPollerRef.current = null
          setBills(updated)
          setGenerating(false)
          if (done >= updated.length) {
            toast.success(`Đã tạo ${done} hóa đơn PDF & QR thành công!`)
          } else {
            toast.warning(`Hoàn thành ${done}/${updated.length}. Một số hóa đơn có thể thất bại.`)
          }
        }
      } catch { /* ignore poll errors */ }
    }, 1000)
  }

  function cancelGeneration() {
    if (genPollerRef.current) { clearInterval(genPollerRef.current); genPollerRef.current = null }
    setGenerating(false)
    toast.info('Đã ẩn. Hóa đơn vẫn đang tạo ở nền.')
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

  const canAddInvoice = isAccountant && !['APPROVED', 'CLOSED'].includes(period?.status ?? '')
  const canSubmitReadings = period?.status === 'OPEN' || period?.status === 'READING_DONE'
  const showBillActions = period?.status === 'APPROVED' || period?.status === 'CLOSED'
  const submittedCount = readings.filter((r) => r.submitted).length
  const totalConsumption = readings.filter((r) => r.submitted).reduce((sum, r) => sum + r.consumption, 0)

  const tabList: [Tab, string][] = [
    ...(isAccountant ? [['invoices', `HD EVN (${invoices.length})`] as [Tab, string]] : []),
    ['readings', `Chỉ số (${submittedCount}/${readings.length})`],
    ...(isAccountant ? [['bills', `Hóa đơn (${bills.length})`] as [Tab, string]] : []),
  ]

  return {
    user, isAdmin, isAccountant,
    period, bills, readings, invoices,
    tab, setTab, loading,
    actionLoading, generating, genProgress,
    readingInputs, setReadingInputs, submittingId, recentlyDoneId,
    addInvoiceOpen, setAddInvoiceOpen,
    paymentBill, setPaymentBill,
    reviewOpen, setReviewOpen, reviewData, reviewLoading,
    editingReadingId, setEditingReadingId,
    editReadingInput, setEditReadingInput,
    selectedBillIds, setSelectedBillIds, sendingSms,
    editPeriodOpen, setEditPeriodOpen,
    editPeriodForm, setEditPeriodForm,
    editPeriodSaving, editPeriodError,
    billSearch, setBillSearch,
    billStatusFilter, setBillStatusFilter,
    billSort,
    readingSearch, setReadingSearch,
    readingSubmittedFilter, setReadingSubmittedFilter,
    readingSort,
    invoiceForm, setInvoiceForm,
    paymentForm, setPaymentForm,
    displayBills, displayReadings,
    canAddInvoice, canSubmitReadings, showBillActions,
    submittedCount, totalConsumption, tabList,
    handleAction,
    handleAddInvoice,
    handleDeleteInvoice,
    handleSubmitReading,
    handleEditReading,
    handleEditPeriod,
    handleReview,
    handleSubmitAllReadings,
    openPaymentForm,
    handleAddPayment,
    handleMarkSent,
    handleZaloLink,
    handleSendSms,
    handlePrintPack,
    handleViewPdf,
    handleGenerateBills,
    cancelGeneration,
    toggleSort,
    toggleReadingSort,
  }
}
