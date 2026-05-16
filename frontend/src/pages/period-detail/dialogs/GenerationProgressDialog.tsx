import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface Props {
  open: boolean
  genProgress: { done: number; total: number }
  onCancel: () => void
}

export function GenerationProgressDialog({ open, genProgress, onCancel }: Props) {
  const pct = genProgress.total > 0
    ? Math.round((genProgress.done / genProgress.total) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent title="Đang tạo hóa đơn">
        <div className="space-y-6 py-2">
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center h-16 w-16">
              <div className="absolute inset-0 rounded-full bg-amber-400/10 animate-ping" />
              <div className="relative h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Zap className="h-7 w-7 text-amber-400 animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Đang tạo PDF và mã QR VietQR cho từng hộ...
            </p>
          </div>

          <div className="text-center">
            <div className="font-mono tabular-nums">
              <span className="text-4xl font-bold text-foreground">{genProgress.done}</span>
              <span className="text-2xl text-muted-foreground"> / {genProgress.total}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">hóa đơn đã hoàn thành</p>
          </div>

          <div className="space-y-1">
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  boxShadow: '0 0 10px rgba(251,191,36,0.6)',
                }}
              />
            </div>
            <p className="text-right text-xs font-mono text-muted-foreground">{pct}%</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Ẩn (tiếp tục ở nền)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
