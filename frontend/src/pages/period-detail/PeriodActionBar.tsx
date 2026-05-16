import { AlertTriangle, BarChart3, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { BillResponse, PeriodResponse } from '@/types/api'

interface Props {
  period: PeriodResponse
  isAdmin: boolean
  isAccountant: boolean
  invoicesCount: number
  bills: BillResponse[]
  actionLoading: string | null
  onAction: (action: 'calculate' | 'approve' | 'revert' | 'close' | 'verify') => void
  onReview: () => void
  onAddInvoice: () => void
  onGenerateBills: () => void
  onPrintPack: () => void
}

export function PeriodActionBar({
  period, isAdmin, isAccountant, invoicesCount, bills,
  actionLoading, onAction, onReview, onAddInvoice, onGenerateBills, onPrintPack,
}: Props) {
  const canAddInvoice = isAccountant && !['APPROVED', 'CLOSED'].includes(period.status)
  const hasPdfs = bills.some((b) => b.pdfUrl)

  const showBar =
    canAddInvoice ||
    period.status === 'READING_DONE' ||
    period.status === 'CALCULATED' ||
    period.status === 'APPROVED' ||
    (period.status === 'CLOSED' && isAdmin)

  if (!showBar) return null

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border p-3 bg-muted/20">
      {canAddInvoice && (
        <Button size="sm" onClick={onAddInvoice}>
          <Plus className="h-4 w-4" /> Thêm HD EVN
        </Button>
      )}

      {period.status === 'READING_DONE' && isAccountant && (
        <>
          <Button size="sm" variant="outline" onClick={onReview}>
            <BarChart3 className="h-3.5 w-3.5" /> Xem đối chiếu
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={actionLoading === 'calculate' || invoicesCount === 0}
            title={invoicesCount === 0 ? 'Cần thêm hóa đơn EVN trước' : undefined}
            onClick={() => onAction('calculate')}
          >
            {actionLoading === 'calculate' ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tính...</>
            ) : invoicesCount === 0 ? (
              <><AlertTriangle className="h-3.5 w-3.5" /> Tính tiền</>
            ) : 'Tính tiền'}
          </Button>
        </>
      )}

      {period.status === 'CALCULATED' && (
        <>
          {isAccountant && (
            <Button size="sm" variant="outline" onClick={onReview}>
              <BarChart3 className="h-3.5 w-3.5" /> Xem đối chiếu
            </Button>
          )}
          {isAccountant && !period.accountantVerifiedAt && (
            <Button
              size="sm"
              variant="secondary"
              disabled={actionLoading === 'verify'}
              onClick={() => onAction('verify')}
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
                onClick={() => onAction('approve')}
              >
                {actionLoading === 'approve' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang duyệt...</>
                ) : 'Duyệt kỳ'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading === 'revert'}
                onClick={() => onAction('revert')}
              >
                {actionLoading === 'revert' ? 'Đang hoàn về...' : 'Hoàn về'}
              </Button>
            </>
          )}
        </>
      )}

      {period.status === 'APPROVED' && isAdmin && (
        <>
          <Button size="sm" variant="outline" onClick={onGenerateBills}>
            Tạo PDF & QR
          </Button>
          {isAccountant && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPrintPack}
              disabled={!hasPdfs}
              title={hasPdfs ? 'Tải PDF tất cả hóa đơn' : 'Chưa có PDF nào được tạo'}
            >
              <Download className="h-3.5 w-3.5" />
              In tất cả
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            disabled={actionLoading === 'revert'}
            onClick={() => onAction('revert')}
          >
            {actionLoading === 'revert' ? 'Đang hoàn về...' : 'Hoàn về'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={actionLoading === 'close'}
            onClick={() => onAction('close')}
          >
            {actionLoading === 'close' ? 'Đang đóng...' : 'Đóng kỳ'}
          </Button>
        </>
      )}

      {period.status === 'CLOSED' && isAdmin && (
        <>
          <Button size="sm" variant="outline" onClick={onGenerateBills}>
            Tạo PDF & QR
          </Button>
          {isAccountant && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPrintPack}
              disabled={!hasPdfs}
              title={hasPdfs ? 'Tải PDF tất cả hóa đơn' : 'Chưa có PDF nào được tạo'}
            >
              <Download className="h-3.5 w-3.5" />
              In tất cả
            </Button>
          )}
        </>
      )}
    </div>
  )
}
