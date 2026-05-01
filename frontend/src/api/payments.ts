import client from './client'
import type { ApiResponse, PaymentResponse, Page } from '@/types/api'

export const paymentsApi = {
  listUnmatched: () =>
    client
      .get<ApiResponse<Page<PaymentResponse>>>('/payments/unmatched')
      .then((r) => r.data.data!.content),

  assign: (id: number, billId: number) =>
    client
      .post<ApiResponse<PaymentResponse>>(`/payments/${id}/assign`, { billId })
      .then((r) => r.data.data!),
}
