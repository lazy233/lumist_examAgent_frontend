import { http } from './http'

export interface UserProfile {
  userId: string
  username: string
  name: string
  school?: string
  major?: string
  grade?: string
  age?: number
  gender?: string
  questionTypePreference?: string
  difficultyPreference?: string
  questionCount?: number
}

export interface UpdateProfileParams {
  name: string
  school?: string
  major?: string
  grade?: string
  age?: number
  gender?: string
  questionTypePreference?: string
  difficultyPreference?: string
  questionCount?: number
}

export const getProfile = () => {
  return http.get<UserProfile>('/user/profile')
}

export const updateProfile = (params: UpdateProfileParams) => {
  return http.put<UserProfile>('/user/profile', params)
}
