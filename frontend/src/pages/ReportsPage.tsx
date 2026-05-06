import { useEffect, useState } from 'react'
import { FileText, AlertTriangle } from 'lucide-react'
import client from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { billStatusLabel, billStatusVariant } from '@/lib/statusMaps'
import type { ApiResponse, BillResponse } from '@/types/api'

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
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}
        >
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Báo cáo</h1>
          <p className="text-xs text-muted-foreground">Công nợ và tình trạng thanh toán</p>
        </div>
      </div>

      {/* Debt table */}
      <div className="rounded-lg border bg-card">
        {/* Card header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">
              Công nợ chưa thu
            </span>
            {!loading && (
              <span className="font-mono text-xs text-muted-foreground">
                ({debtBills.length} hóa đơn)
              </span>
            )}
          </div>
          {!loading && totalOutstanding > 0 && (
            <span className="font-mono text-sm font-semibold text-destructive">
              {formatCurrency(totalOutstanding)}
            </span>
          )}
        </div>

        {loading ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Đang tải...</p>
        ) : debtBills.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Không có công nợ.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Khách hàng
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Kỳ
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tổng tiền
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Còn lại
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {debtBills.map((b, i) => (
                  <tr
                    key={b.id}
                    className="data-row hover:bg-accent/40 transition-colors"
                    style={i < debtBills.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-primary">{b.customerCode}</span>
                      <span className="text-muted-foreground text-sm ml-2">{b.customerName}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.periodCode}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-destructive">
                      {formatCurrency(b.totalAmount - b.paidAmount)}
                    </td>
                    <td className="px-4 py-3">
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
      </div>
    </div>
  )
}
