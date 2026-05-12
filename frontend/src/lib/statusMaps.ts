import type { PeriodStatus, BillStatus } from '@/types/api'

export const periodStatusLabel: Record<PeriodStatus, string> = {
  OPEN: 'Đang mở',
  READING_DONE: 'Xong chỉ số',
  CALCULATED: 'Đã tính',
  APPROVED: 'Đã duyệt',
  CLOSED: 'Đã đóng',
}

export const periodStatusVariant: Record<PeriodStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  OPEN: 'default',
  READING_DONE: 'secondary',
  CALCULATED: 'warning',
  APPROVED: 'success',
  CLOSED: 'outline',
}

export const billStatusLabel: Record<BillStatus, string> = {
  PENDING: 'Chờ',
  SENT: 'Đã gửi',
  PARTIAL: 'Một phần',
  PAID: 'Đã trả',
  OVERDUE: 'Quá hạn',
}

export const billStatusVariant: Record<BillStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline' | 'destructive' | 'partial'> = {
  PENDING: 'secondary',
  SENT: 'default',
  PARTIAL: 'partial',
  PAID: 'success',
  OVERDUE: 'destructive',
}
