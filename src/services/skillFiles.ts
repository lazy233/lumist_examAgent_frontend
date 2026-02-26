import { http } from './http'

export interface SkillFileItem {
  id: string
  name: string
  size: number
  createdAt: string
}

export interface SkillFilesListResponse {
  items: SkillFileItem[]
  total: number
}

export const getSkillFilesList = (params?: { page?: number; pageSize?: number }) => {
  return http.get<SkillFilesListResponse>('/skills/files', { params }).catch(() => ({ items: [], total: 0 }))
}

export const uploadSkillFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<SkillFileItem>('/skills/files/upload', formData)
}

export const deleteSkillFile = (id: string) => {
  return http.delete(`/skills/files/${id}`)
}
