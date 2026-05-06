import { useEffect, useRef, useState } from 'react'
import { Settings, AlertCircle, Pencil, Check, X, Loader2 } from 'lucide-react'
import client from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import type { ApiResponse, SystemSetting } from '@/types/api'

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    client.get<ApiResponse<SystemSetting[]>>('/settings')
      .then((r) => setSettings(r.data.data ?? []))
      .catch((e) => {
        console.error(e)
        setError('Không thể tải cài đặt. Vui lòng thử lại.')
      })
      .finally(() => setLoading(false))
  }, [])

  function startEdit(s: SystemSetting) {
    setEditingKey(s.settingKey)
    setEditValue(s.settingValue)
    setSaveError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditingKey(null)
    setSaveError(null)
  }

  async function handleSave(key: string) {
    setSaving(true)
    setSaveError(null)
    try {
      const r = await client.patch<ApiResponse<SystemSetting>>(`/settings/${key}`, { value: editValue })
      const updated = r.data.data
      if (updated) {
        setSettings((prev) => prev.map((s) => s.settingKey === key ? updated : s))
      }
      setEditingKey(null)
    } catch (e) {
      console.error(e)
      setSaveError('Không thể lưu. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === 'Enter') handleSave(key)
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="p-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
        >
          <Settings className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cài đặt hệ thống</h1>
          <p className="text-xs text-muted-foreground">Thông số cấu hình hệ thống</p>
        </div>
      </div>

      {/* Settings card */}
      <div className="rounded-lg border bg-card">
        <div
          className="px-5 py-4"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <span className="text-sm font-semibold text-foreground">Thông số cấu hình</span>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Đang tải...</p>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ) : settings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Không có cài đặt.</p>
          ) : (
            <div className="space-y-0">
              {settings.map((s, i) => {
                const isEditing = editingKey === s.settingKey
                return (
                  <div
                    key={s.settingKey}
                    className="flex items-start gap-3 py-3.5"
                    style={i < settings.length - 1 ? { borderBottom: '1px solid hsl(var(--border) / 0.6)' } : {}}
                  >
                    {/* Label */}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-foreground">{s.settingKey}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      )}
                    </div>

                    {/* Value / Edit controls */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, s.settingKey)}
                          disabled={saving}
                          className="font-mono text-sm h-8 w-52 rounded-md px-2.5 bg-background border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleSave(s.settingKey)}
                          disabled={saving}
                          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50"
                          style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
                          title="Lưu"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50"
                          title="Huỷ"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="font-mono text-sm px-2.5 py-1 rounded"
                          style={{
                            background: 'hsl(var(--muted))',
                            color: 'hsl(var(--foreground))',
                            border: '1px solid hsl(var(--border))',
                          }}
                        >
                          {s.settingValue || <span className="text-muted-foreground italic">trống</span>}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => startEdit(s)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Save error */}
              {saveError && (
                <div className="flex items-center gap-2 mt-3 rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}