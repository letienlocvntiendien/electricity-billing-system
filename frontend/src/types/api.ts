// ── Generic wrapper ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  username: string
  fullName: string
  role: Role
}

// ── Enums ─────────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'ACCOUNTANT' | 'METER_READER'

export type PeriodStatus = 'OPEN' | 'READING_DONE' | 'CALCULATED' | 'APPROVED' | 'CLOSED'

export type BillStatus = 'PENDING' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE'

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'OTHER'

// ── Customer ──────────────────────────────────────────────────────────────────

export interface CustomerResponse {
  id: number
  code: string
  fullName: string
  phone: string | null
  zaloPhone: string | null
  meterSerial: string | null
  notes: string | null
  active: boolean
  createdAt: string
}

export interface CreateCustomerRequest {
  code: string
  fullName: string
  phone?: string
  zaloPhone?: string
  meterSerial?: string
  notes?: string
}

export interface UpdateCustomerRequest {
  fullName?: string
  phone?: string
  zaloPhone?: string
  meterSerial?: string
  notes?: string
  active?: boolean
}

// ── Billing Period ────────────────────────────────────────────────────────────

export interface PeriodResponse {
  id: number
  code: string
  name: string
  startDate: string
  endDate: string
  evnTotalAmount: number
  evnTotalKwh: number
  extraFee: number
  unitPrice: number | null
  serviceFee: number
  status: PeriodStatus
  approvedAt: string | null
  closedAt: string | null
  createdAt: string
  accountantVerifiedBy: string | null
  accountantVerifiedAt: string | null
}

export interface CreatePeriodRequest {
  name: string
  startDate: string
  endDate: string
  serviceFee?: number
}

export interface UpdatePeriodRequest {
  name?: string
  extraFee?: number
  serviceFee?: number
}

// ── EVN Invoice ───────────────────────────────────────────────────────────────

export interface EvnInvoiceResponse {
  id: number
  periodId: number
  invoiceDate: string
  invoiceNumber: string
  kwh: number
  amount: number
  attachmentUrl: string | null
  createdAt: string
}

export interface CreateEvnInvoiceRequest {
  invoiceDate: string
  invoiceNumber: string
  kwh: number
  amount: number
  attachmentUrl?: string
}

// ── Meter Reading ─────────────────────────────────────────────────────────────

export interface MeterReadingResponse {
  id: number
  periodId: number
  customerId: number
  customerCode: string
  customerFullName: string   // matches Java record field name
  previousIndex: number
  currentIndex: number
  consumption: number
  readingPhotoUrl: string | null
  readAt: string | null
  submitted: boolean
  warning: string | null
}

// ── Bill ──────────────────────────────────────────────────────────────────────

export interface BillResponse {
  id: number
  periodId: number
  periodCode: string
  customerId: number
  customerCode: string
  customerName: string
  customerPhone: string | null
  consumption: number
  unitPrice: number
  serviceFee: number
  electricityAmount: number
  serviceAmount: number
  totalAmount: number
  paidAmount: number
  status: BillStatus
  paymentCode: string
  qrCodeUrl: string | null
  pdfUrl: string | null
  sentViaZalo: boolean
  sentAt: string | null
  createdAt: string
}

export interface SmsResultResponse {
  billId: number
  customerCode: string
  customerName: string
  phone: string | null
  success: boolean
  errorMessage: string | null
}

// ── Payment ───────────────────────────────────────────────────────────────────

export interface PaymentResponse {
  id: number
  billId: number | null
  paymentCode: string | null
  amount: number
  method: PaymentMethod
  paidAt: string
  bankTransactionId: string | null
  bankReferenceCode: string | null
  rawContent: string | null
  notes: string | null
  createdAt: string
}

export interface CreatePaymentRequest {
  amount: number
  method: PaymentMethod
  paidAt: string
  notes?: string
}

// ── Period Review (pre-calculate preview) ─────────────────────────────────────

export interface PeriodReviewResponse {
  evnTotalKwh: number
  evnTotalAmount: number
  extraFee: number
  totalActualConsumption: number
  lossKwh: number
  lossPercentage: number
  lossWarning: boolean
  previewUnitPrice: number
  serviceFee: number
  activeBillCount: number
  totalBillsAmount: number
  roundingDifference: number
  submittedReadingCount: number
  accountantVerifiedBy: string | null
  accountantVerifiedAt: string | null
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface PeriodSummaryResponse {
  periodId: number
  periodCode: string
  periodName: string
  totalBills: number
  totalBilledAmount: number
  totalPaidAmount: number
  outstandingAmount: number
  countByStatus: Record<BillStatus, number>
  roundingDifference: number
}

// ── System Setting ────────────────────────────────────────────────────────────

export interface SystemSetting {
  settingKey: string
  settingValue: string
  description: string | null
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
