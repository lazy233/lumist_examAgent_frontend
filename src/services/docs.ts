import { http } from './http'

export type DocStatus = 'uploaded' | 'parsing' | 'done' | 'failed'

export interface DocParsed {
  school: string
  major: string
  course: string
  knowledgePoints: string[]
  summary: string
}

export interface DocDetail {
  docId: string
  fileName: string
  status: DocStatus
  parsed?: DocParsed
  createdAt: string
}

export interface UploadDocResponse {
  docId: string
  fileName: string
  status: 'uploaded'
}

export const uploadDoc = (file: File, options?: { saveToLibrary?: boolean }) => {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.saveToLibrary !== undefined) {
    formData.append('saveToLibrary', String(options.saveToLibrary))
  }
  return http.post<UploadDocResponse>('/docs/upload', formData)
}

export const startParse = (docId: string) => {
  return http.post<{ docId: string; status: DocStatus }>(`/docs/${docId}/parse`)
}

export interface DocListItem extends DocDetail {}

export interface DocsListResponse {
  items: DocListItem[]
  total: number
}

export const getDocsList = (params?: {
  keyword?: string
  page?: number
  pageSize?: number
}) => {
  return http.get<DocsListResponse>('/docs', { params })
}

export const deleteDoc = (docId: string) => {
  return http.delete(`/docs/${docId}`)
}
