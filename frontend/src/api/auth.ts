import client from './client'
import type { ApiResponse, LoginRequest, LoginResponse } from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) =>
    client.post<ApiResponse<LoginResponse>>('/auth/login', data).then((r) => r.data.data!),

  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    client
      .post<ApiResponse<{ accessToken: string }>>('/auth/refresh', { refreshToken })
      .then((r) => r.data.data!.accessToken),
}
