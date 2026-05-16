import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InvoiceForm {
  invoiceDate: string
  invoiceNumber: string
  kwh: string
  amount: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceForm: InvoiceForm
  setInvoiceForm: React.Dispatch<React.SetStateAction<InvoiceForm>>
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void
  actionLoading: string | null
}

export function AddInvoiceDialog({ open, onOpenChange, invoiceForm, setInvoiceForm, onSubmit, actionLoading }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Thêm hóa đơn EVN">
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="inv-date">Ngày hóa đơn</Label>
            <Input
              id="inv-date"
              type="date"
              required
              value={invoiceForm.invoiceDate}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="inv-num">Số hóa đơn</Label>
            <Input
              id="inv-num"
              required
              value={invoiceForm.invoiceNumber}
              onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inv-kwh">kWh</Label>
              <Input
                id="inv-kwh"
                type="number"
                inputMode="numeric"
                min="0"
                required
                value={invoiceForm.kwh}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, kwh: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="inv-amount">Số tiền (VND)</Label>
              <Input
                id="inv-amount"
                type="number"
                inputMode="numeric"
                min="0"
                required
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={actionLoading === 'addInvoice'}>
              {actionLoading === 'addInvoice' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
              ) : 'Lưu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
