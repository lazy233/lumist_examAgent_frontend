import type { App } from 'vue'
import { createPinia } from 'pinia'

export const setupStore = (app: App) => {
  const pinia = createPinia()
  app.use(pinia)
}
