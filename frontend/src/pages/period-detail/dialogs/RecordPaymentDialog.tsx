import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { methodLabel } from '../usePeriodDetail'
import type { BillResponse, PaymentMethod } from '@/types/api'

interface PaymentForm {
  amount: string
  method: PaymentMethod
  paidAt: string
  notes: string
}

interface Props {
  paymentBill: BillResponse | null
  onClose: () => void
  paymentForm: PaymentForm
  setPaymentForm: React.Dispatch<React.SetStateAction<PaymentForm>>
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void
  actionLoading: string | null
}

export function RecordPaymentDialog({ paymentBill, onClose, paymentForm, setPaymentForm, onSubmit, actionLoading }: Props) {
  return (
    <Dialog
      open={paymentBill !== null}
      onOpenChange={(o) => { if (!o) onClose() }}
    >
      <DialogContent title={`Ghi thu — ${paymentBill?.customerCode} ${paymentBill?.customerName}`}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="pay-amount">Số tiền (VND)</Label>
            <Input
              id="pay-amount"
              type="number"
              inputMode="numeric"
              min="1"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
            />
            {paymentBill && (
              <p className="text-xs text-muted-foreground mt-1">
                Còn lại: {formatCurrency(paymentBill.totalAmount - paymentBill.paidAmount)}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="pay-method">Hình thức</Label>
            <select
              id="pay-method"
              value={paymentForm.method}
              onChange={(e) =>
                setPaymentForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {(Object.keys(methodLabel) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{methodLabel[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pay-at">Thời gian</Label>
            <Input
              id="pay-at"
              type="datetime-local"
              required
              value={paymentForm.paidAt}
              onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pay-notes">Ghi chú</Label>
            <Input
              id="pay-notes"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={actionLoading === 'payment'}>
              {actionLoading === 'payment' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
              ) : 'Ghi thu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
