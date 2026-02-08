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

/** 「我的资料」页面上传：仅保存，不解析、不总结、不向量化 */
export const uploadMaterial = (file: File, options?: { saveToLibrary?: boolean }) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('saveToLibrary', options?.saveToLibrary === true ? 'true' : 'false')
  return http.post<UploadDocResponse>('/docs/materials/upload', formData)
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

/** 获取文件内容用于预览（需后端提供 GET /docs/:docId/file） */
export const getDocFile = (docId: string) => {
  return http.get<Blob>(`/docs/${docId}/file`, { responseType: 'blob' })
}
