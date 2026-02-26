import type { ChatStreamOptions } from '../services/chat'

export const CHAT_CONFIG_KEY = 'lumist_chat_config'

const defaults: ChatStreamOptions & { knowledgeBaseIds: string[]; skills: string[] } = {
  model: 'gpt-4o-mini',
  knowledgeBaseIds: [],
  skills: [],
  systemPrompt: '',
}

export type ChatConfigState = ChatStreamOptions & { knowledgeBaseIds: string[]; skills: string[] }

export function loadChatConfig(): ChatConfigState {
  try {
    const raw = localStorage.getItem(CHAT_CONFIG_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      model: typeof parsed.model === 'string' ? parsed.model : defaults.model,
      knowledgeBaseIds: Array.isArray(parsed.knowledgeBaseIds) ? parsed.knowledgeBaseIds : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
    }
  } catch {
    return { ...defaults }
  }
}

export function saveChatConfig(state: ChatConfigState) {
  try {
    localStorage.setItem(CHAT_CONFIG_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
