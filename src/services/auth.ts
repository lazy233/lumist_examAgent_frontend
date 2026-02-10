import { http } from './http'
import type { UserInfo } from '../stores/auth'

interface LoginParams {
  username: string
  password: string
}

interface LoginResponse {
  token: string
  user: UserInfo
}

export const login = (params: LoginParams) => {
  return http.post<LoginResponse>('/auth/login', params)
}

interface RegisterParams {
  username: string
  password: string
  name?: string
}

interface RegisterResponse {
  token: string
  user: UserInfo
}

export const register = (params: RegisterParams) => {
  return http.post<RegisterResponse>('/auth/register', params)
}
