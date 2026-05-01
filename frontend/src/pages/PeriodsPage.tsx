import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { periodsApi } from '@/api/periods'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { PeriodResponse, PeriodStatus } from '@/types/api'

const statusLabel: Record<PeriodStatus, string> = {
  OPEN: 'Đang mở',
  READING_DONE: 'Xong chỉ số',
  CALCULATED: 'Đã tính',
  APPROVED: 'Đã duyệt',
  CLOSED: 'Đã đóng',
}

const statusVariant: Record<PeriodStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  OPEN: 'default',
  READING_DONE: 'secondary',
  CALCULATED: 'warning',
  APPROVED: 'success',
  CLOSED: 'outline',
}

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<PeriodResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    periodsApi.list()
      .then(setPeriods)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CalendarDays className="h-6 w-6" />
        Kỳ thanh toán
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{periods.length} kỳ</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Tên kỳ</th>
                    <th className="text-left py-2 px-3 font-medium">Thời gian</th>
                    <th className="text-right py-2 px-3 font-medium">EVN (kWh)</th>
                    <th className="text-right py-2 px-3 font-medium">Đơn giá</th>
                    <th className="text-left py-2 px-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-3">
                        <Link
                          to={`/periods/${p.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {p.startDate} → {p.endDate}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {p.evnTotalKwh.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {p.unitPrice ? formatCurrency(p.unitPrice) : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={statusVariant[p.status]}>
                          {statusLabel[p.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
