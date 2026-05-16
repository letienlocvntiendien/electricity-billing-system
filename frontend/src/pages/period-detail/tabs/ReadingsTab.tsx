import { AlertTriangle, CheckCircle2, Info, Loader2, Pencil, Search, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SortIcon } from '@/components/SortIcon'
import type { MeterReadingResponse, PeriodResponse } from '@/types/api'
import type { ReadingSortCol } from '../usePeriodDetail'

interface Props {
  period: PeriodResponse
  readings: MeterReadingResponse[]
  displayReadings: MeterReadingResponse[]
  submittedCount: number
  canSubmitReadings: boolean
  isAdmin: boolean
  userRole: string | undefined
  readingInputs: Record<number, string>
  setReadingInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>
  submittingId: number | null
  recentlyDoneId: number | null
  editingReadingId: number | null
  setEditingReadingId: React.Dispatch<React.SetStateAction<number | null>>
  editReadingInput: string
  setEditReadingInput: React.Dispatch<React.SetStateAction<string>>
  actionLoading: string | null
  readingSearch: string
  setReadingSearch: React.Dispatch<React.SetStateAction<string>>
  readingSubmittedFilter: 'ALL' | 'SUBMITTED' | 'PENDING'
  setReadingSubmittedFilter: React.Dispatch<React.SetStateAction<'ALL' | 'SUBMITTED' | 'PENDING'>>
  readingSort: { col: ReadingSortCol; dir: 'asc' | 'desc' }
  toggleReadingSort: (col: ReadingSortCol) => void
  onSubmitReading: (r: MeterReadingResponse) => void
  onEditReading: (r: MeterReadingResponse) => void
  onSubmitAllReadings: () => void
}

export function ReadingsTab({
  period, readings, displayReadings, submittedCount, canSubmitReadings,
  isAdmin, userRole, readingInputs, setReadingInputs, submittingId, recentlyDoneId,
  editingReadingId, setEditingReadingId, editReadingInput, setEditReadingInput,
  actionLoading, readingSearch, setReadingSearch,
  readingSubmittedFilter, setReadingSubmittedFilter,
  readingSort, toggleReadingSort,
  onSubmitReading, onEditReading, onSubmitAllReadings,
}: Props) {
  const SearchBar = (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-36">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Tìm khách hàng..."
          value={readingSearch}
          onChange={(e) => setReadingSearch(e.target.value)}
          className="h-8 text-sm pl-8 pr-7"
        />
        {readingSearch && (
          <button
            onClick={() => setReadingSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex rounded-md border border-input overflow-hidden h-8 flex-shrink-0">
        {([
          ['ALL', 'Tất cả'],
          ['SUBMITTED', 'Đã ghi'],
          ['PENDING', 'Chưa đọc'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setReadingSubmittedFilter(val)}
            className={cn(
              'px-3 text-sm transition-colors border-r border-input last:border-r-0',
              readingSubmittedFilter === val
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground hover:bg-accent/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Progress bar */}
      {readings.length > 0 && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Tiến độ đọc chỉ số</span>
            <span className="font-mono text-sm font-bold text-primary">
              {submittedCount}/{readings.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((submittedCount / readings.length) * 100)}%`,
                background: submittedCount === readings.length
                  ? 'hsl(152 60% 40%)'
                  : 'hsl(var(--primary))',
              }}
            />
          </div>
          {submittedCount === readings.length && (
            <p className="text-xs text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tất cả đã ghi — kỳ sẵn sàng tính tiền
            </p>
          )}
          {period.status === 'OPEN' && userRole === 'METER_READER' && (
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={actionLoading === 'submitReadings'}
                onClick={onSubmitAllReadings}
              >
                {actionLoading === 'submitReadings' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang nộp...</>
                ) : 'Hoàn thành kỳ này'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Info banner */}
      {['READING_DONE', 'CALCULATED'].includes(period.status) && isAdmin && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2.5 text-sm text-blue-400">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Để sửa chỉ số đồng hồ, dùng nút <strong>Hoàn về</strong> trong thanh thao tác để quay về trạng thái OPEN.
          </span>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card">
        <div className="px-5 pt-4 pb-3 space-y-2.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Chỉ số công tơ</span>
            {(readingSearch || readingSubmittedFilter !== 'ALL') && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {displayReadings.length}/{readings.length} hộ
              </span>
            )}
          </div>
          {readings.length > 0 && SearchBar}
        </div>
        {readings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-center text-muted-foreground">Chưa có dữ liệu chỉ số.</p>
        ) : displayReadings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-center text-muted-foreground">Không tìm thấy hộ phù hợp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  {([
                    ['customerCode', 'Khách hàng', false],
                    ['previousIndex', 'Chỉ số cũ', true],
                    ['currentIndex', 'Chỉ số mới', true],
                    ['consumption', 'Tiêu thụ', true],
                    ['readAt', 'Đọc lúc', false],
                  ] as [ReadingSortCol, string, boolean][]).map(([col, label, right]) => (
                    <th
                      key={col}
                      className={cn('px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground', right ? 'text-right' : 'text-left')}
                    >
                      <button
                        onClick={() => toggleReadingSort(col)}
                        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                      >
                        {label}
                        <SortIcon active={readingSort.col === col} dir={readingSort.dir} />
                      </button>
                    </th>
                  ))}
                  {canSubmitReadings && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {displayReadings.map((r, i) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'data-row transition-colors',
                      !r.submitted ? 'hover:bg-amber-500/5' : 'hover:bg-accent/40',
                    )}
                    style={{
                      ...(i < displayReadings.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}),
                      ...(!r.submitted ? { background: 'hsl(38 95% 53% / 0.03)' } : {}),
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-primary">{r.customerCode}</span>
                      <span className="text-muted-foreground ml-2">{r.customerFullName}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.previousIndex}</td>
                    <td className="px-4 py-3 text-right">
                      {r.submitted ? (
                        editingReadingId === r.id ? (
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={r.previousIndex}
                            value={editReadingInput}
                            onChange={(e) => setEditReadingInput(e.target.value)}
                            className="h-7 w-24 text-right font-mono ml-auto"
                            autoFocus
                          />
                        ) : (
                          <span className="font-mono">{r.currentIndex}</span>
                        )
                      ) : canSubmitReadings ? (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={r.previousIndex}
                          value={readingInputs[r.id] ?? ''}
                          onChange={(e) =>
                            setReadingInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="h-7 w-24 text-right font-mono ml-auto"
                          placeholder={String(r.previousIndex)}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.submitted ? r.consumption : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.readAt ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground text-xs">
                            {new Date(r.readAt).toLocaleString('vi-VN')}
                          </span>
                          {r.warning && (
                            <div
                              className="flex items-center gap-1 mt-0.5 rounded px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 max-w-[200px]"
                              title={r.warning}
                            >
                              <AlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-400" />
                              <span className="text-xs text-amber-400 truncate">{r.warning}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-400 text-xs font-medium">Chưa đọc</span>
                      )}
                    </td>
                    {canSubmitReadings && (
                      <td className="px-4 py-3">
                        {!r.submitted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={submittingId === r.id || !readingInputs[r.id]}
                            onClick={() => onSubmitReading(r)}
                          >
                            {submittingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : 'Ghi'}
                          </Button>
                        ) : period.status === 'OPEN' && editingReadingId === r.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              disabled={submittingId === r.id || !editReadingInput}
                              onClick={() => onEditReading(r)}
                            >
                              {submittingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lưu'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingReadingId(null); setEditReadingInput('') }}
                            >
                              Hủy
                            </Button>
                          </div>
                        ) : period.status === 'OPEN' ? (
                          <button
                            onClick={() => { setEditingReadingId(r.id); setEditReadingInput(String(r.currentIndex)) }}
                            className="p-1.5 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                            title="Sửa chỉ số"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {readings.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {SearchBar}
            {(readingSearch || readingSubmittedFilter !== 'ALL') && (
              <span className="text-xs text-muted-foreground">{displayReadings.length}/{readings.length}</span>
            )}
          </div>
        )}
        {displayReadings.length === 0 && readings.length > 0 && (
          <p className="py-6 text-sm text-center text-muted-foreground">Không tìm thấy hộ phù hợp.</p>
        )}
        {displayReadings.map((r) => {
          const isDone = r.submitted
          const isJustDone = recentlyDoneId === r.id

          return (
            <div
              key={r.id}
              className={cn(
                'rounded-xl overflow-hidden transition-all duration-300',
                isJustDone ? 'reading-card-done' : '',
              )}
              style={{
                background: isDone ? 'hsl(152 60% 40% / 0.05)' : 'hsl(38 95% 53% / 0.04)',
                border: isDone ? '1px solid hsl(152 60% 40% / 0.2)' : '1px solid hsl(38 95% 53% / 0.2)',
                borderLeftWidth: '3px',
                borderLeftColor: isDone
                  ? (isJustDone ? 'hsl(152 60% 40%)' : 'hsl(152 60% 40% / 0.6)')
                  : 'hsl(38 95% 53% / 0.7)',
              }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: isDone ? 'hsl(152 60% 40%)' : 'hsl(var(--primary))' }}
                      >
                        {r.customerCode}
                      </span>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đã ghi
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-0.5 font-medium">{r.customerFullName}</p>
                  </div>
                  {!isDone && (
                    <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      Chưa đọc
                    </span>
                  )}
                </div>

                {isDone ? (
                  editingReadingId === r.id ? (
                    <div className="flex gap-2 mt-1 mb-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={r.previousIndex}
                        value={editReadingInput}
                        onChange={(e) => setEditReadingInput(e.target.value)}
                        className="flex-1 h-12 text-center font-mono text-lg"
                        autoFocus
                      />
                      <Button
                        className="h-12 px-4"
                        disabled={submittingId === r.id || !editReadingInput}
                        onClick={() => onEditReading(r)}
                      >
                        {submittingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-12 px-3"
                        onClick={() => { setEditingReadingId(null); setEditReadingInput('') }}
                      >
                        Hủy
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cũ</p>
                        <p className="font-mono text-base font-semibold text-foreground">{r.previousIndex}</p>
                      </div>
                      <span className="text-muted-foreground mt-2">→</span>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mới</p>
                        <p className="font-mono text-base font-semibold text-foreground">{r.currentIndex}</p>
                      </div>
                      <span className="text-muted-foreground mt-2">=</span>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tiêu thụ</p>
                        <p className="font-mono text-base font-bold text-emerald-400">{r.consumption} kWh</p>
                      </div>
                      {period.status === 'OPEN' && (
                        <button
                          onClick={() => { setEditingReadingId(r.id); setEditReadingInput(String(r.currentIndex)) }}
                          className="ml-auto p-1.5 rounded hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                          title="Sửa chỉ số"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="mr-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Chỉ số cũ</p>
                      <p className="font-mono text-base font-semibold text-foreground">{r.previousIndex}</p>
                    </div>
                  </div>
                )}

                {!isDone && canSubmitReadings && (
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={r.previousIndex}
                      value={readingInputs[r.id] ?? ''}
                      onChange={(e) =>
                        setReadingInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      className="flex-1 h-12 text-center font-mono text-lg"
                      placeholder={String(r.previousIndex)}
                      autoComplete="off"
                    />
                    <Button
                      className="h-12 px-5 font-semibold"
                      disabled={submittingId === r.id || !readingInputs[r.id]}
                      onClick={() => onSubmitReading(r)}
                    >
                      {submittingId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}

                {isDone && r.readAt && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {new Date(r.readAt).toLocaleString('vi-VN')}
                  </p>
                )}
                {isDone && r.warning && (
                  <div className="flex items-center gap-1.5 mt-1.5 rounded px-2 py-1 bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                    <span className="text-xs text-amber-400">{r.warning}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
