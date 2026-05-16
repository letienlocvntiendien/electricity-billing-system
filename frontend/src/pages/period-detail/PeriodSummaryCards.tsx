import { CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { PeriodResponse } from '@/types/api'

interface Props {
  period: PeriodResponse
  submittedCount: number
  readingsTotal: number
  totalConsumption: number
}

export function PeriodSummaryCards({ period, submittedCount, readingsTotal, totalConsumption }: Props) {
  const isCalculated = ['CALCULATED', 'APPROVED', 'CLOSED'].includes(period.status)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

      {/* EVN invoice */}
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

      {/* Meter readings */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Chỉ số đồng hồ
        </p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Đã ghi</span>
            <span className="font-mono text-sm font-semibold">{submittedCount}/{readingsTotal} hộ</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Tiêu thụ thực tế</span>
            <span className="font-mono text-sm font-semibold">
              {totalConsumption.toLocaleString('vi-VN')} kWh
            </span>
          </div>
        </div>
      </div>

      {/* Calculation results */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Kết quả tính toán
        </p>
        {isCalculated ? (
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
  )
}
