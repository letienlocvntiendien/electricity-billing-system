import { Trash2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { EvnInvoiceResponse } from '@/types/api'

interface Props {
  invoices: EvnInvoiceResponse[]
  canAddInvoice: boolean
  onDelete: (invoice: EvnInvoiceResponse) => void
}

export function EvnInvoicesTab({ invoices, canAddInvoice, onDelete }: Props) {
  return (
    <div className="rounded-lg border bg-card">
      <div
        className="px-5 py-4"
        style={{ borderBottom: invoices.length > 0 ? '1px solid hsl(var(--border))' : undefined }}
      >
        <span className="text-sm font-semibold">Hóa đơn EVN</span>
      </div>
      {invoices.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-muted-foreground">Chưa có hóa đơn EVN.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                {['Ngày', 'Số HĐ', 'kWh', 'Số tiền'].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      'px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      h === 'kWh' || h === 'Số tiền' ? 'text-right' : 'text-left',
                    )}
                  >
                    {h}
                  </th>
                ))}
                {canAddInvoice && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr
                  key={inv.id}
                  className="hover:bg-accent/40 transition-colors"
                  style={i < invoices.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                >
                  <td className="px-4 py-3 text-sm">{inv.invoiceDate}</td>
                  <td className="px-4 py-3 font-mono text-sm">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {inv.kwh.toLocaleString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {formatCurrency(inv.amount)}
                  </td>
                  {canAddInvoice && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDelete(inv)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
