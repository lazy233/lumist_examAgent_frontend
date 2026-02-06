import { http } from './http'
import { API_BASE_URL } from '../config/app'
import { getToken } from '../utils/auth'

export type QuestionType = 'single_choice' | 'fill_blank' | 'short_answer' | 'multiple_choice' | 'true_false'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ExerciseStatus = 'generating' | 'ready' | 'failed'

export interface GenerateExerciseParams {
  docId: string
  types: QuestionType[]
  difficulty: Difficulty
  count: number
}

export interface GenerateExerciseResponse {
  exerciseId: string
  status: 'generating'
}

export const generateExercise = (params: GenerateExerciseParams) => {
  return http.post<GenerateExerciseResponse>('/exercises/generate', params)
}

/** 出题中心：根据文字材料请求大模型分析，返回给用户确认的信息 */
export interface AnalyzeForConfirmParams {
  content: string
  questionType: string
  difficulty: string
  count: number
}

export interface AnalyzeForConfirmResponse {
  keyPoints: string[]
}

export const analyzeForConfirm = (params: AnalyzeForConfirmParams) => {
  return http.post<AnalyzeForConfirmResponse>('/exercises/analyze', params)
}

/** 出题中心：用户确认后流式生成题目；onChunk 每收到一段文本调用一次，onDone 结束时调用并带上 exerciseId */
export interface GenerateFromTextParams {
  content: string
  questionType: string
  difficulty: string
  count: number
}

export const generateExerciseStreamFromText = async (
  params: GenerateFromTextParams,
  callbacks: { onChunk: (text: string) => void; onDone: (exerciseId: string) => void; onError: (err: Error) => void }
) => {
  const token = getToken()
  const url = `${API_BASE_URL}/exercises/generate-from-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      callbacks.onError(new Error(data.message || '生成失败'))
    } catch {
      callbacks.onError(new Error(text || '生成失败'))
    }
    return
  }
  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError(new Error('不支持流式响应'))
    return
  }
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      buffer += text
      callbacks.onChunk(text)
    }
    let exerciseId = ''
    const lines = buffer.trimEnd().split(/\r?\n/)
    const lastLine = lines[lines.length - 1]?.trim() || ''
    try {
      const last = JSON.parse(lastLine) as { exerciseId?: string }
      if (last && typeof last.exerciseId === 'string') {
        exerciseId = last.exerciseId
        lines.pop()
      }
    } catch {
      // 最后一行不是 JSON，整段都是题目内容，exerciseId 为空
    }
    callbacks.onDone(exerciseId)
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error('流式读取失败'))
  }
}

export interface Question {
  questionId: string
  type: QuestionType
  stem: string
  options?: Record<string, string>
}

export interface ExerciseDetail {
  exerciseId: string
  title: string
  status: ExerciseStatus
  difficulty: Difficulty
  count: number
  questions: Question[]
  createdAt: string
  score?: number
}

export const getExerciseDetail = (exerciseId: string) => {
  return http.get<ExerciseDetail>(`/exercises/${exerciseId}`)
}

export interface SubmitAnswer {
  questionId: string
  answer: string
}

export interface ResultItem {
  questionId: string
  isCorrect: boolean
  userAnswer: string
  correctAnswer: string
  analysis: string
}

export interface SubmitResponse {
  score: number
  correctRate: number
  results: ResultItem[]
}

export const submitExercise = (exerciseId: string, answers: SubmitAnswer[]) => {
  return http.post<SubmitResponse>(`/exercises/${exerciseId}/submit`, { answers })
}

export interface ExerciseListItem {
  exerciseId: string
  title: string
  count: number
  difficulty: Difficulty
  score?: number
  createdAt: string
  status?: ExerciseStatus
}

export interface ExercisesListResponse {
  items: ExerciseListItem[]
  total: number
}

export const getExercisesList = (params?: {
  keyword?: string
  difficulty?: Difficulty
  page?: number
  pageSize?: number
}) => {
  return http.get<ExercisesListResponse>('/exercises', { params })
}
