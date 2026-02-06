import { USE_MOCK } from '../config/app'

export const setupMock = () => {
  if (!USE_MOCK) {
    return
  }

  // Mock 入口占位，后续接入 Mock Service Worker 或本地假数据
  console.info('[mock] 已启用 Mock 模式')
}
