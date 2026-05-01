import client from './client'
import type { ApiResponse, MeterReadingResponse } from '@/types/api'

export const readingsApi = {
  submit: (id: number, currentIndex: number) =>
    client
      .patch<ApiResponse<MeterReadingResponse>>(`/readings/${id}`, { currentIndex })
      .then((r) => r.data.data!),
}
