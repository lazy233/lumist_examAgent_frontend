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
  /** 学习内容：科目 */
  learningSubject?: string
  /** 学习内容：补充说明 */
  learningContent?: string
  /** 学习目标：目标类型 */
  goalType?: string
  /** 学习目标：期望分数段 */
  expectedScore?: string
  /** 学习目标：补充说明 */
  learningGoals?: string
  /** 能力画像：做题速度 */
  questionSpeed?: string
  /** 能力画像：擅长题型，逗号分隔 */
  strongTypes?: string
  /** 能力画像：薄弱题型，逗号分隔 */
  weakTypes?: string
  /** 能力画像：补充说明 */
  abilityProfile?: string
  /** 出题偏好：题型，逗号分隔 */
  preferredTypes?: string
  /** 出题偏好：难度 */
  preferredDifficulty?: string
  /** 出题偏好：题目数量 */
  preferredCount?: number
  /** 出题偏好：补充说明 */
  questionPreference?: string
  /** 输出要求：答案解析详细度 */
  analysisDetail?: string
  /** 输出要求：是否需要举一反三 */
  needExamples?: boolean
  /** 输出要求：补充说明 */
  outputRequirements?: string
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
