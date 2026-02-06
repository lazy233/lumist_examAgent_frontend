import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { router, setupRouter } from './router'
import { setupStore } from './stores'
import { setupMock } from './mocks'
import './style.css'

const app = createApp(App)

setupStore(app)
setupRouter(app)
setupMock()

app.use(ElementPlus)

router.isReady().then(() => {
  app.mount('#app')
})
