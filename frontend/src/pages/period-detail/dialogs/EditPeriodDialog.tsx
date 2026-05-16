import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UpdatePeriodRequest } from '@/types/api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodCode: string
  editPeriodForm: UpdatePeriodRequest
  setEditPeriodForm: React.Dispatch<React.SetStateAction<UpdatePeriodRequest>>
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void
  editPeriodSaving: boolean
  editPeriodError: string | null
}

export function EditPeriodDialog({
  open, onOpenChange, periodCode,
  editPeriodForm, setEditPeriodForm,
  onSubmit, editPeriodSaving, editPeriodError,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false) }}>
      <DialogContent title={`Chỉnh sửa — ${periodCode}`}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="ep-name">Tên kỳ</Label>
            <Input
              id="ep-name"
              value={editPeriodForm.name ?? ''}
              onChange={(e) => setEditPeriodForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ep-svc">Phí ghi điện (đ/hộ)</Label>
              <Input
                id="ep-svc"
                type="number"
                inputMode="numeric"
                min="0"
                value={editPeriodForm.serviceFee ?? ''}
                onChange={(e) => setEditPeriodForm((f) => ({ ...f, serviceFee: Number(e.target.value) }))}
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="ep-fee">Phụ phí (VND)</Label>
              <Input
                id="ep-fee"
                type="number"
                inputMode="numeric"
                min="0"
                value={editPeriodForm.extraFee ?? ''}
                onChange={(e) => setEditPeriodForm((f) => ({ ...f, extraFee: Number(e.target.value) }))}
                className="font-mono"
              />
            </div>
          </div>
          {editPeriodError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {editPeriodError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={editPeriodSaving}>
              {editPeriodSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : 'Lưu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
