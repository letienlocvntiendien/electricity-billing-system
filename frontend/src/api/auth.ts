import client from './client'
import type { ApiResponse, LoginRequest, LoginResponse } from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) =>
    client.post<ApiResponse<LoginResponse>>('/auth/login', data).then((r) => r.data.data!),

  logout: () => client.post('/auth/logout'),
}
