import { useEffect, useMemo, useState } from 'react'
import { Users, Plus, Pencil, Trash2, Loader2, AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import type { CustomerResponse, CreateCustomerRequest, UpdateCustomerRequest } from '@/types/api'

const emptyCreate = (): CreateCustomerRequest => ({
  code: '', fullName: '', phone: '', zaloPhone: '', meterSerial: '', notes: '',
})

type SortKey = 'code' | 'fullName' | 'active'
type StatusFilter = 'all' | 'active' | 'inactive'

export default function CustomersPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CustomerResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<CreateCustomerRequest>(emptyCreate())
  const [editForm, setEditForm] = useState<UpdateCustomerRequest>({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    customersApi.list()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function reload() {
    customersApi.list().then(setCustomers).catch(console.error)
  }

  function openEdit(c: CustomerResponse) {
    setEditTarget(c)
    setEditForm({
      fullName: c.fullName,
      phone: c.phone ?? '',
      zaloPhone: c.zaloPhone ?? '',
      meterSerial: c.meterSerial ?? '',
      notes: c.notes ?? '',
      active: c.active,
    })
    setSaveError(null)
  }

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const displayCustomers = useMemo(() => {
    let r = customers
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(c =>
        c.code.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.meterSerial ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'active') r = r.filter(c => c.active)
    if (statusFilter === 'inactive') r = r.filter(c => !c.active)
    return [...r].sort((a, b) => {
      const cmp = sortKey === 'code' ? a.code.localeCompare(b.code)
                : sortKey === 'fullName' ? a.fullName.localeCompare(b.fullName)
                : Number(b.active) - Number(a.active)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [customers, search, statusFilter, sortKey, sortDir])

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const created = await customersApi.create(createForm)
      setCustomers((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)))
      setCreateOpen(false)
      setCreateForm(emptyCreate())
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setSaveError(e.response?.data?.error ?? 'Không thể tạo khách hàng.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await customersApi.update(editTarget.id, editForm)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setEditTarget(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setSaveError(e.response?.data?.error ?? 'Không thể cập nhật.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: CustomerResponse) {
    if (!window.confirm(`Xóa khách hàng ${c.code} — ${c.fullName}?`)) return
    try {
      await customersApi.remove(c.id)
      reload()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error ?? 'Không thể xóa.')
    }
  }

  const isFiltered = search.trim() !== '' || statusFilter !== 'all'

  return (
    <div className="p-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ background: 'hsl(215 80% 60% / 0.12)', color: 'hsl(215 80% 60%)' }}
          >
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Khách hàng</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground">
                {isFiltered
                  ? `${displayCustomers.length} / ${customers.length} khách hàng`
                  : `${customers.length} khách hàng`}
              </p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setCreateOpen(true); setSaveError(null) }}>
            <Plus className="h-4 w-4" /> Thêm khách hàng
          </Button>
        )}
      </div>

      {/* Search + filter bar */}
      {!loading && customers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo mã, tên, SĐT, số đồng hồ..."
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center rounded-md border divide-x overflow-hidden text-xs">
            {(['all', 'active', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 h-8 transition-colors',
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                )}
              >
                {s === 'all' ? 'Tất cả' : s === 'active' ? 'Hoạt động' : 'Ngừng'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Đang tải...</p>
        ) : customers.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Chưa có khách hàng.</p>
        ) : displayCustomers.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center text-muted-foreground">Không tìm thấy kết quả.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('code')}
                  >
                    <span className="inline-flex items-center gap-1">Mã KH <SortIcon col="code" /></span>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('fullName')}
                  >
                    <span className="inline-flex items-center gap-1">Họ tên <SortIcon col="fullName" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Điện thoại</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Số đồng hồ</th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('active')}
                  >
                    <span className="inline-flex items-center gap-1">Trạng thái <SortIcon col="active" /></span>
                  </th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {displayCustomers.map((c, i) => (
                  <tr
                    key={c.id}
                    className="data-row hover:bg-accent/40 transition-colors"
                    style={i < displayCustomers.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-primary">{c.code}</td>
                    <td className="px-4 py-3 text-foreground">{c.fullName}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{c.meterSerial ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.active ? 'success' : 'secondary'}>
                        {c.active ? 'Hoạt động' : 'Ngừng'}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(c)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false) }}>
        <DialogContent title="Thêm khách hàng">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-code">Mã KH *</Label>
                <Input
                  id="c-code"
                  required
                  maxLength={20}
                  value={createForm.code}
                  onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="KH011"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="c-serial">Số đồng hồ</Label>
                <Input
                  id="c-serial"
                  maxLength={50}
                  value={createForm.meterSerial}
                  onChange={(e) => setCreateForm((f) => ({ ...f, meterSerial: e.target.value }))}
                  placeholder="DK-011-A"
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="c-name">Họ tên *</Label>
              <Input
                id="c-name"
                required
                maxLength={200}
                value={createForm.fullName}
                onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-phone">Điện thoại</Label>
                <Input
                  id="c-phone"
                  inputMode="tel"
                  maxLength={20}
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="c-zalo">Zalo</Label>
                <Input
                  id="c-zalo"
                  inputMode="tel"
                  maxLength={20}
                  value={createForm.zaloPhone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, zaloPhone: e.target.value }))}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="c-notes">Ghi chú</Label>
              <Input
                id="c-notes"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {saveError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {saveError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : 'Thêm'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent title={`Chỉnh sửa — ${editTarget?.code}`}>
          <form onSubmit={handleUpdate} className="space-y-3">
            <div>
              <Label htmlFor="e-name">Họ tên *</Label>
              <Input
                id="e-name"
                required
                maxLength={200}
                value={editForm.fullName ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="e-serial">Số đồng hồ</Label>
              <Input
                id="e-serial"
                maxLength={50}
                value={editForm.meterSerial ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, meterSerial: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="e-phone">Điện thoại</Label>
                <Input
                  id="e-phone"
                  inputMode="tel"
                  maxLength={20}
                  value={editForm.phone ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="e-zalo">Zalo</Label>
                <Input
                  id="e-zalo"
                  inputMode="tel"
                  maxLength={20}
                  value={editForm.zaloPhone ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, zaloPhone: e.target.value }))}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="e-notes">Ghi chú</Label>
              <Input
                id="e-notes"
                value={editForm.notes ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editForm.active ?? true}
                onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-foreground">Đang hoạt động</span>
            </label>
            {saveError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {saveError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</> : 'Lưu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
