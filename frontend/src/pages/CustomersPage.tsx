import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CustomerResponse } from '@/types/api'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    customersApi.list()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Khách hàng
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {customers.length} khách hàng
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Mã</th>
                    <th className="text-left py-2 px-3 font-medium">Họ tên</th>
                    <th className="text-left py-2 px-3 font-medium">Số điện thoại</th>
                    <th className="text-left py-2 px-3 font-medium">Đồng hồ</th>
                    <th className="text-left py-2 px-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-3 font-mono font-medium">{c.code}</td>
                      <td className="py-2 px-3">{c.fullName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.phone ?? '—'}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.meterSerial ?? '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={c.active ? 'success' : 'secondary'}>
                          {c.active ? 'Hoạt động' : 'Ngừng'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
