import { http } from './http'
import { API_BASE_URL } from '../config/app'
import { getToken } from '../utils/auth'

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

export interface DocParseStatusEvent {
  docId: string
  status: 'parsing'
}
export interface DocParseProgressEvent {
  stage: string
}
export interface DocParseChunkEvent {
  content: string
}
export interface DocParseResultEvent {
  docId: string
  status: 'done'
  parsed: DocParsed
}
export interface DocParseErrorEvent {
  docId: string
  status: 'failed'
  detail: string
}
export interface DocParseStreamHandlers {
  onStatus?: (data: DocParseStatusEvent) => void
  onProgress?: (data: DocParseProgressEvent) => void
  onChunk?: (data: DocParseChunkEvent) => void
  onResult?: (data: DocParseResultEvent) => void
  onError?: (data: DocParseErrorEvent) => void
  onClose?: () => void
}

/** 解析资料（SSE 流式） */
export const startParse = (
  docId: string,
  handlers: DocParseStreamHandlers = {},
  signal?: AbortSignal
) => {
  const controller = new AbortController()
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  const token = getToken()
  const url = `${API_BASE_URL}/docs/${docId}/parse`

  const done = (async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    })
    if (!res.ok || !res.body) {
      throw new Error(`解析失败：${res.status}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const flushEvent = (raw: string) => {
      const lines = raw.split(/\r?\n/)
      let eventName = 'message'
      const dataLines: string[] = []
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim())
        }
      }
      if (!dataLines.length) return
      const dataText = dataLines.join('\n')
      let payload: unknown = dataText
      try {
        payload = JSON.parse(dataText)
      } catch {
        // keep raw string
      }
      switch (eventName) {
        case 'status':
          handlers.onStatus?.(payload as DocParseStatusEvent)
          break
        case 'progress':
          handlers.onProgress?.(payload as DocParseProgressEvent)
          break
        case 'chunk':
          handlers.onChunk?.(payload as DocParseChunkEvent)
          break
        case 'result':
          handlers.onResult?.(payload as DocParseResultEvent)
          break
        case 'error':
          handlers.onError?.(payload as DocParseErrorEvent)
          break
        default:
          break
      }
    }

    while (true) {
      const { done: isDone, value } = await reader.read()
      if (isDone) break
      buffer += decoder.decode(value, { stream: true })
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        const raw = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 2)
        if (raw) flushEvent(raw)
        idx = buffer.indexOf('\n\n')
      }
    }
    if (buffer.trim()) flushEvent(buffer.trim())
    handlers.onClose?.()
  })()

  return {
    abort: () => controller.abort(),
    done,
  }
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
