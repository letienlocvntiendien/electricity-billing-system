import client from './client'
import type {
  ApiResponse, Page, PeriodResponse, CreatePeriodRequest, UpdatePeriodRequest,
  EvnInvoiceResponse, CreateEvnInvoiceRequest,
  MeterReadingResponse, BillResponse,
  PeriodReviewResponse,
} from '@/types/api'

export const periodsApi = {
  list: () =>
    client
      .get<ApiResponse<Page<PeriodResponse>>>('/periods?size=100&sort=startDate,desc')
      .then((r) => r.data.data!.content),

  get: (id: number) =>
    client.get<ApiResponse<PeriodResponse>>(`/periods/${id}`).then((r) => r.data.data!),

  create: (data: CreatePeriodRequest) =>
    client.post<ApiResponse<PeriodResponse>>('/periods', data).then((r) => r.data.data!),

  update: (id: number, data: UpdatePeriodRequest) =>
    client.patch<ApiResponse<PeriodResponse>>(`/periods/${id}`, data).then((r) => r.data.data!),

  calculate: (id: number) =>
    client.post<ApiResponse<PeriodResponse>>(`/periods/${id}/calculate`).then((r) => r.data.data!),

  review: (id: number) =>
    client.get<ApiResponse<PeriodReviewResponse>>(`/periods/${id}/review`).then((r) => r.data.data!),

  approve: (id: number) =>
    client.post<ApiResponse<PeriodResponse>>(`/periods/${id}/approve`).then((r) => r.data.data!),

  revert: (id: number) =>
    client.post<ApiResponse<PeriodResponse>>(`/periods/${id}/revert`).then((r) => r.data.data!),

  close: (id: number) =>
    client.post<ApiResponse<PeriodResponse>>(`/periods/${id}/close`).then((r) => r.data.data!),

  submitReadings: (id: number) =>
    client.post<ApiResponse<PeriodResponse>>(`/periods/${id}/submit-readings`).then((r) => r.data.data!),

  verify: (id: number) =>
    client.post<ApiResponse<PeriodResponse>>(`/periods/${id}/verify`).then((r) => r.data.data!),

  // EVN invoices  (nested under /periods/{id}/evn-invoices)
  listInvoices: (id: number) =>
    client
      .get<ApiResponse<EvnInvoiceResponse[]>>(`/periods/${id}/evn-invoices`)
      .then((r) => r.data.data!),

  createInvoice: (id: number, data: CreateEvnInvoiceRequest) =>
    client
      .post<ApiResponse<EvnInvoiceResponse>>(`/periods/${id}/evn-invoices`, data)
      .then((r) => r.data.data!),

  deleteInvoice: (periodId: number, invoiceId: number) =>
    client.delete(`/periods/${periodId}/evn-invoices/${invoiceId}`),

  // Readings  (nested under /periods/{id}/readings)
  listReadings: (id: number) =>
    client
      .get<ApiResponse<MeterReadingResponse[]>>(`/periods/${id}/readings`)
      .then((r) => r.data.data!),

  // Bills  (flat endpoint with ?periodId=)
  listBills: (id: number) =>
    client
      .get<ApiResponse<BillResponse[]>>(`/bills?periodId=${id}`)
      .then((r) => r.data.data!),

  // Print pack
  printPack: (id: number) =>
    client.get(`/periods/${id}/print-pack`, { responseType: 'blob' }),

  generateBills: (id: number) =>
    client.post<ApiResponse<string>>(`/periods/${id}/generate-bills`).then((r) => r.data),
}
