import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { periodsApi } from '@/api/periods'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export default function DashboardPage() {
  const [periods, setPeriods] = useState<PeriodResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    periodsApi.list()
      .then(setPeriods)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const openPeriod = periods.find((p) => p.status === 'OPEN' || p.status === 'READING_DONE' || p.status === 'CALCULATED')
  const approvedPeriods = periods.filter((p) => p.status === 'APPROVED')
  const closedPeriods = periods.filter((p) => p.status === 'CLOSED')

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Tổng quan</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Kỳ đang xử lý</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openPeriod?.name ?? '—'}</p>
            {openPeriod && (
              <Badge variant={statusVariant[openPeriod.status]} className="mt-1">
                {statusLabel[openPeriod.status]}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Kỳ đã duyệt</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{approvedPeriods.length}</p>
            <p className="text-xs text-muted-foreground mt-1">kỳ chờ đóng</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng số kỳ</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{periods.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{closedPeriods.length} đã đóng</p>
          </CardContent>
        </Card>
      </div>

      {/* Period list */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            <CardTitle>Danh sách kỳ thanh toán</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          ) : periods.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có kỳ nào.</p>
          ) : (
            <div className="space-y-2">
              {periods.map((p) => (
                <Link
                  key={p.id}
                  to={`/periods/${p.id}`}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.startDate} → {p.endDate}
                    </p>
                  </div>
                  <Badge variant={statusVariant[p.status]}>
                    {statusLabel[p.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
