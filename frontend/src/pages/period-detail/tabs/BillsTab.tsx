import { Loader2, MessageSquare, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { billStatusLabel, billStatusVariant } from '@/lib/statusMaps'
import { SortIcon } from '@/components/SortIcon'
import { nowLocalDatetime } from '../usePeriodDetail'
import type { BillResponse, BillStatus, PeriodResponse, PaymentMethod } from '@/types/api'
import type { BillSortCol } from '../usePeriodDetail'

interface Props {
  period: PeriodResponse
  bills: BillResponse[]
  displayBills: BillResponse[]
  showBillActions: boolean
  isAccountant: boolean
  selectedBillIds: Set<number>
  setSelectedBillIds: React.Dispatch<React.SetStateAction<Set<number>>>
  sendingSms: boolean
  billSearch: string
  setBillSearch: React.Dispatch<React.SetStateAction<string>>
  billStatusFilter: BillStatus | 'ALL'
  setBillStatusFilter: React.Dispatch<React.SetStateAction<BillStatus | 'ALL'>>
  billSort: { col: BillSortCol; dir: 'asc' | 'desc' }
  toggleSort: (col: BillSortCol) => void
  onPaymentForm: (bill: BillResponse) => void
  onMarkSent: (bill: BillResponse) => void
  onZaloLink: (bill: BillResponse) => void
  onViewPdf: (bill: BillResponse) => void
  onSendSms: () => void
  setPaymentBill: React.Dispatch<React.SetStateAction<BillResponse | null>>
  setPaymentForm: React.Dispatch<React.SetStateAction<{ amount: string; method: PaymentMethod; paidAt: string; notes: string }>>
}

export function BillsTab({
  period, bills, displayBills, showBillActions, isAccountant,
  selectedBillIds, setSelectedBillIds, sendingSms,
  billSearch, setBillSearch, billStatusFilter, setBillStatusFilter,
  billSort, toggleSort,
  onPaymentForm, onMarkSent, onZaloLink, onViewPdf, onSendSms,
  setPaymentBill, setPaymentForm,
}: Props) {
  const isPolling = (period.status === 'APPROVED' || period.status === 'CLOSED') && isAccountant

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 space-y-2.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Hóa đơn khách hàng</span>
            {isPolling && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Tự động cập nhật
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(billSearch || billStatusFilter !== 'ALL') && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {displayBills.length}/{bills.length} hóa đơn
              </span>
            )}
            {showBillActions && isAccountant && selectedBillIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={onSendSms} disabled={sendingSms}>
                {sendingSms
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang gửi...</>
                  : <><MessageSquare className="h-3.5 w-3.5" /> Gửi SMS ({selectedBillIds.size})</>
                }
              </Button>
            )}
          </div>
        </div>
        {bills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-36">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Tìm khách hàng..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="h-8 text-sm pl-8 pr-7"
              />
              {billSearch && (
                <button
                  onClick={() => setBillSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={billStatusFilter}
              onChange={(e) => setBillStatusFilter(e.target.value as BillStatus | 'ALL')}
              className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option className="bg-background text-foreground" value="ALL">Tất cả trạng thái</option>
              {(['PENDING', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE'] as const).map((s) => (
                <option className="bg-background text-foreground" key={s} value={s}>{billStatusLabel[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {bills.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-muted-foreground">
          Chưa có hóa đơn — cần tính tiền trước.
        </p>
      ) : displayBills.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-muted-foreground">
          Không tìm thấy hóa đơn phù hợp.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  {showBillActions && isAccountant && (
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-border cursor-pointer"
                        title="Chọn tất cả có thể gửi SMS"
                        checked={
                          displayBills.filter(b => b.customerPhone && b.qrCodeUrl).every(b => selectedBillIds.has(b.id)) &&
                          displayBills.some(b => b.customerPhone && b.qrCodeUrl)
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBillIds(new Set(displayBills.filter(b => b.customerPhone && b.qrCodeUrl).map(b => b.id)))
                          } else {
                            setSelectedBillIds(new Set())
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('customerCode')}>
                      Khách hàng <SortIcon active={billSort.col === 'customerCode'} dir={billSort.dir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                    <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('consumption')}>
                      kWh <SortIcon active={billSort.col === 'consumption'} dir={billSort.dir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                    <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('unitPrice')}>
                      Đơn giá <SortIcon active={billSort.col === 'unitPrice'} dir={billSort.dir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                    <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('serviceFee')}>
                      Phí DV <SortIcon active={billSort.col === 'serviceFee'} dir={billSort.dir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                    <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('totalAmount')}>
                      Tổng tiền <SortIcon active={billSort.col === 'totalAmount'} dir={billSort.dir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
                    <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => toggleSort('paidAmount')}>
                      Đã trả <SortIcon active={billSort.col === 'paidAmount'} dir={billSort.dir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
                      Trạng thái <SortIcon active={billSort.col === 'status'} dir={billSort.dir} />
                    </button>
                  </th>
                  {showBillActions && isAccountant && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left">
                      Thao tác
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayBills.map((b, i) => (
                  <tr
                    key={b.id}
                    className="data-row hover:bg-accent/40 transition-colors"
                    style={i < displayBills.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                  >
                    {showBillActions && isAccountant && (
                      <td className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          className="rounded border-border cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!b.customerPhone || !b.qrCodeUrl}
                          title={!b.customerPhone ? 'Khách hàng chưa có SĐT' : !b.qrCodeUrl ? 'Chưa có mã QR' : ''}
                          checked={selectedBillIds.has(b.id)}
                          onChange={(e) => {
                            setSelectedBillIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(b.id)
                              else next.delete(b.id)
                              return next
                            })
                          }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-primary">{b.customerCode}</span>
                      <span className="text-muted-foreground ml-2">{b.customerName}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{b.consumption}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {b.unitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.serviceFee)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono">{formatCurrency(b.paidAmount)}</span>
                      {b.status === 'PARTIAL' && (
                        <span className="font-mono text-[11px] text-orange-400 block leading-tight mt-0.5">
                          còn {formatCurrency(b.totalAmount - b.paidAmount)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={billStatusVariant[b.status]}>
                        {billStatusLabel[b.status]}
                      </Badge>
                    </td>
                    {showBillActions && isAccountant && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {['PENDING', 'SENT', 'PARTIAL'].includes(b.status) && (
                            <Button size="sm" variant="outline" onClick={() => onPaymentForm(b)}>
                              Ghi thu
                            </Button>
                          )}
                          {b.status === 'PENDING' && (
                            <Button size="sm" variant="ghost" onClick={() => onMarkSent(b)}>
                              Gửi
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => onZaloLink(b)}>
                            Zalo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!b.qrCodeUrl}
                            title={b.qrCodeUrl ? 'Xem mã QR' : 'Chưa có mã QR'}
                            onClick={() => b.qrCodeUrl && window.open(b.qrCodeUrl, '_blank')}
                          >
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!b.pdfUrl}
                            title={b.pdfUrl ? 'Xem hóa đơn PDF' : 'Chưa có PDF'}
                            onClick={() => onViewPdf(b)}
                          >
                            PDF
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y" style={{ borderColor: 'hsl(var(--border) / 0.6)' }}>
            {displayBills.map((b) => (
              <div key={b.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-primary text-sm">{b.customerCode}</span>
                    <p className="text-sm text-foreground">{b.customerName}</p>
                  </div>
                  <Badge variant={billStatusVariant[b.status]}>
                    {billStatusLabel[b.status]}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">kWh</p>
                    <p className="font-mono text-sm font-semibold">{b.consumption}</p>
                  </div>
                  <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tổng tiền</p>
                    <p className="font-mono text-xs font-semibold">{formatCurrency(b.totalAmount)}</p>
                  </div>
                  <div className="rounded-md py-2" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Đã trả</p>
                    <p className="font-mono text-xs font-semibold">{formatCurrency(b.paidAmount)}</p>
                    {b.status === 'PARTIAL' && (
                      <p className="font-mono text-[10px] text-orange-400 mt-0.5">
                        Còn: {formatCurrency(b.totalAmount - b.paidAmount)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Đơn giá: <span className="font-mono text-foreground">
                      {b.unitPrice.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ/kWh
                    </span>
                  </span>
                  <span className="text-border">•</span>
                  <span>
                    Phí DV: <span className="font-mono text-foreground">{formatCurrency(b.serviceFee)}</span>
                  </span>
                </div>
                {showBillActions && isAccountant && ['PENDING', 'SENT', 'PARTIAL'].includes(b.status) && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setPaymentBill(b)
                        setPaymentForm({
                          amount: String(b.totalAmount - b.paidAmount),
                          method: 'CASH',
                          paidAt: nowLocalDatetime(),
                          notes: '',
                        })
                      }}
                    >
                      Ghi thu
                    </Button>
                    {b.status === 'PENDING' && (
                      <Button size="sm" variant="ghost" onClick={() => onMarkSent(b)}>
                        Gửi
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onZaloLink(b)}>
                      Zalo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!b.qrCodeUrl}
                      title={b.qrCodeUrl ? 'Xem mã QR' : 'Chưa có mã QR'}
                      onClick={() => b.qrCodeUrl && window.open(b.qrCodeUrl, '_blank')}
                    >
                      QR
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!b.pdfUrl}
                      title={b.pdfUrl ? 'Xem hóa đơn PDF' : 'Chưa có PDF'}
                      onClick={() => onViewPdf(b)}
                    >
                      PDF
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
