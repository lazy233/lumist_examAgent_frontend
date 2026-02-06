import { defineStore } from 'pinia'
import { getToken, getUser, removeToken, removeUser, setToken, setUser } from '../utils/auth'

/** 用于辅助出题的个人信息，后续生成题目时会读取 */
export interface UserInfo {
  id: string
  name: string
  /** 学校 */
  school?: string
  /** 专业 */
  major?: string
  /** 年级，如 高一、大二 */
  grade?: string
  /** 年龄 */
  age?: number
  /** 性别 */
  gender?: string
}

interface AuthState {
  token: string
  user: UserInfo | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: getToken(),
    user: getUser<UserInfo>(),
  }),
  actions: {
    updateToken(token: string) {
      this.token = token
      setToken(token)
    },
    updateUser(user: UserInfo | null) {
      this.user = user
      if (user) {
        setUser(user)
      } else {
        removeUser()
      }
    },
    logout() {
      this.token = ''
      this.user = null
      removeToken()
      removeUser()
    },
  },
})
