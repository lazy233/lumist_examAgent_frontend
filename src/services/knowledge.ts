import { http } from './http'

/** 知识库文档项（向量库中的一条） */
export interface KnowledgeDoc {
  id: string
  fileName: string
  status: 'pending' | 'indexing' | 'done' | 'failed'
  chunkCount?: number
  createdAt: string
}

/** 召回结果片段 */
export interface RecallChunk {
  id: string
  docId: string
  content: string
  score?: number
}

export interface KnowledgeListResponse {
  items: KnowledgeDoc[]
  total: number
}

export const getKnowledgeList = (params?: { page?: number; pageSize?: number }) => {
  return http.get<KnowledgeListResponse>('/knowledge', { params }).catch(() => ({ items: [], total: 0 }))
}

export const uploadKnowledgeFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<{ id: string; fileName: string; status: string }>('/knowledge/upload', formData)
}

export const deleteKnowledgeDoc = (id: string) => {
  return http.delete(`/knowledge/${id}`)
}

/** 召回测试：传入 query，返回相关片段 */
export const recallTest = (query: string, topK = 5) => {
  return http
    .post<{ chunks: RecallChunk[] }>('/knowledge/recall', { query, topK })
    .then((res) => res?.chunks ?? [])
}

/** 获取知识库文档内容/片段列表（用于展示） */
export const getKnowledgeContent = (docId: string) => {
  return http.get<{ chunks: { id: string; content: string }[] }>(`/knowledge/${docId}/content`).catch(() => ({ chunks: [] }))
}
