const TOKEN_KEY = 'student_token'
const USER_KEY = 'student_user'

export const getToken = (): string => {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export const getUser = <T>(): T | null => {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const setUser = <T>(user: T) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const removeUser = () => {
  localStorage.removeItem(USER_KEY)
}
