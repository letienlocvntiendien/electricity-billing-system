import client from './client'
import type { ApiResponse, BillResponse, PaymentResponse, CreatePaymentRequest, SmsResultResponse } from '@/types/api'

export const billsApi = {
  addPayment: (id: number, data: CreatePaymentRequest) =>
    client
      .post<ApiResponse<PaymentResponse>>(`/bills/${id}/payments`, data)
      .then((r) => r.data.data!),

  listPayments: (id: number) =>
    client
      .get<ApiResponse<PaymentResponse[]>>(`/bills/${id}/payments`)
      .then((r) => r.data.data!),

  markSent: (id: number) =>
    client.post<ApiResponse<BillResponse>>(`/bills/${id}/mark-sent`).then((r) => r.data.data!),

  zaloLink: (id: number) =>
    client
      .get<ApiResponse<{ url: string }>>(`/bills/${id}/zalo-link`)
      .then((r) => r.data.data!.url),

  getPdf: async (id: number): Promise<string> => {
    const res = await client.get(`/bills/${id}/pdf`, { responseType: 'blob' })
    return URL.createObjectURL(res.data as Blob)
  },

  sendSms: (billIds: number[]) =>
    client
      .post<ApiResponse<SmsResultResponse[]>>('/bills/send-sms', { billIds })
      .then((r) => r.data.data!),
}
