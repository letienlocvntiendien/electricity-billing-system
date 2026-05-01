import client from './client'
import type { ApiResponse, BillResponse, PaymentResponse, CreatePaymentRequest } from '@/types/api'

export const billsApi = {
  addPayment: (id: number, data: CreatePaymentRequest) =>
    client
      .post<ApiResponse<PaymentResponse>>(`/bills/${id}/payments`, data)
      .then((r) => r.data.data!),

  markSent: (id: number) =>
    client.post<ApiResponse<BillResponse>>(`/bills/${id}/mark-sent`).then((r) => r.data.data!),

  zaloLink: (id: number) =>
    client
      .get<ApiResponse<{ url: string }>>(`/bills/${id}/zalo-link`)
      .then((r) => r.data.data!.url),
}
