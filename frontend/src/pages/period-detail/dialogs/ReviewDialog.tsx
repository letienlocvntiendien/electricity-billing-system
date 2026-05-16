import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatCurrency, cn } from '@/lib/utils'
import type { PeriodReviewResponse } from '@/types/api'

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

interface Props {
  open: boolean
  onClose: () => void
  reviewData: PeriodReviewResponse | null
  reviewLoading: boolean
}

export function ReviewDialog({ open, onClose, reviewData, reviewLoading }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent title="Đối chiếu kỳ — Xem trước tính toán">
        {reviewLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reviewData ? (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

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
  )
}
