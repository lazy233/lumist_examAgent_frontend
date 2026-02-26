import { API_BASE_URL } from '../config/app'
import { getToken } from '../utils/auth'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 智能问答请求配置：知识库(RAG)、Skills、模型等，随请求体传给后端 */
export interface ChatStreamOptions {
  /** 模型标识，如 gpt-4o、gpt-4o-mini */
  model?: string
  /** 知识库文档 id 列表，用于 RAG 检索 */
  knowledgeBaseIds?: string[]
  /** 启用的 skill 标识列表 */
  skills?: string[]
  /** 系统提示词，约束回复风格或身份 */
  systemPrompt?: string
}

export interface ChatStreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
}

/**
 * 智能问答流式接口：POST 消息列表与配置，流式返回 assistant 回复。
 * 请求体包含 messages 与 options（模型、知识库、skills 等），后端按需使用。
 */
export const chatStream = async (
  messages: ChatMessage[],
  callbacks: ChatStreamCallbacks,
  options?: ChatStreamOptions
): Promise<void> => {
  const token = getToken()
  const url = `${API_BASE_URL}/chat/stream`
  const body = JSON.stringify({
    messages,
    ...(options && Object.keys(options).length > 0 ? { options } : {}),
  })

  const controller = new AbortController()
  const res = await fetch(url, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      callbacks.onError(new Error(data.message || '请求失败'))
    } catch {
      callbacks.onError(new Error(text || '请求失败'))
    }
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError(new Error('不支持流式响应'))
    return
  }

  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      callbacks.onChunk(text)
    }
    callbacks.onDone()
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error('流式读取失败'))
  }
}
