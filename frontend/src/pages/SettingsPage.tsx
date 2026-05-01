import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import client from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApiResponse, SystemSetting } from '@/types/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get<ApiResponse<SystemSetting[]>>('/settings')
      .then((r) => setSettings(r.data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6" />
        Cài đặt hệ thống
      </h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Thông số cấu hình</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          ) : (
            <div className="space-y-3">
              {settings.map((s) => (
                <div key={s.settingKey} className="flex justify-between items-start py-2 border-b last:border-0">
                  <div>
                    <p className="font-mono text-sm font-medium">{s.settingKey}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    )}
                  </div>
                  <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{s.settingValue}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}