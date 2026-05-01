import { useEffect, useState } from 'react'
import { FileText, AlertTriangle } from 'lucide-react'
import client from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { ApiResponse, BillResponse, BillStatus } from '@/types/api'

const billStatusLabel: Record<BillStatus, string> = {
  PENDING: 'Chờ', SENT: 'Đã gửi', PARTIAL: 'Một phần',
  PAID: 'Đã trả', OVERDUE: 'Quá hạn',
}
const billStatusVariant: Record<BillStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline' | 'destructive'> = {
  PENDING: 'secondary', SENT: 'default', PARTIAL: 'warning',
  PAID: 'success', OVERDUE: 'destructive',
}

export default function ReportsPage() {
  const [debtBills, setDebtBills] = useState<BillResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<ApiResponse<BillResponse[]>>('/reports/debt')
      .then((r) => setDebtBills(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalOutstanding = debtBills.reduce((s, b) => s + b.totalAmount - b.paidAmount, 0)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileText className="h-6 w-6" />
        Báo cáo
      </h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Công nợ chưa thu ({debtBills.length} hóa đơn)
            </CardTitle>
            <span className="text-sm font-semibold text-destructive">
              {formatCurrency(totalOutstanding)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          ) : debtBills.length === 0 ? (
            <p className="text-muted-foreground text-sm">Không có công nợ.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Khách hàng</th>
                    <th className="text-left py-2 px-3 font-medium">Kỳ</th>
                    <th className="text-right py-2 px-3 font-medium">Tổng tiền</th>
                    <th className="text-right py-2 px-3 font-medium">Còn lại</th>
                    <th className="text-left py-2 px-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {debtBills.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-mono font-medium">{b.customerCode}</span>
                        <span className="text-muted-foreground ml-2">{b.customerName}</span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{b.periodCode}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(b.totalAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono text-destructive">
                        {formatCurrency(b.totalAmount - b.paidAmount)}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={billStatusVariant[b.status]}>
                          {billStatusLabel[b.status]}
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
