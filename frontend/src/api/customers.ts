import client from './client'
import type { ApiResponse, Page, CustomerResponse, CreateCustomerRequest, UpdateCustomerRequest } from '@/types/api'

export const customersApi = {
  list: (activeOnly = false) =>
    client
      .get<ApiResponse<Page<CustomerResponse>>>(
        `/customers?size=200&sort=code${activeOnly ? '&active=true' : ''}`
      )
      .then((r) => r.data.data!.content),

  get: (id: number) =>
    client.get<ApiResponse<CustomerResponse>>(`/customers/${id}`).then((r) => r.data.data!),

  create: (data: CreateCustomerRequest) =>
    client.post<ApiResponse<CustomerResponse>>('/customers', data).then((r) => r.data.data!),

  update: (id: number, data: UpdateCustomerRequest) =>
    client.patch<ApiResponse<CustomerResponse>>(`/customers/${id}`, data).then((r) => r.data.data!),

  remove: (id: number) =>
    client.delete(`/customers/${id}`),
}
