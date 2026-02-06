import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { API_BASE_URL } from '../config/app'
import { getToken, removeToken } from '../utils/auth'

const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
})

export const http = instance as Omit<typeof instance, 'get' | 'post' | 'put' | 'patch' | 'delete'> & {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status
    const message =
      error?.response?.data?.message || error?.message || '网络异常，请稍后重试'

    if (status === 401) {
      removeToken()
    }

    ElMessage.error(message)
    return Promise.reject(error)
  }
)
