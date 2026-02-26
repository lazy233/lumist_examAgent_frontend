import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '../utils/auth'
import MainLayout from '../components/MainLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        redirect: { name: 'Dashboard' },
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../pages/DashboardPage.vue'),
      },
      {
        path: 'docs',
        name: 'Docs',
        component: () => import('../pages/DocsListPage.vue'),
      },
      {
        path: 'docs/create',
        name: 'DocCreate',
        component: () => import('../pages/DocCreatePage.vue'),
      },
      {
        path: 'docs/:docId',
        name: 'DocDetail',
        component: () => import('../pages/DocDetailPage.vue'),
      },
      {
        path: 'exercises',
        name: 'Exercises',
        component: () => import('../pages/ExercisesListPage.vue'),
      },
      {
        path: 'exercises/:exerciseId',
        name: 'ExerciseDetail',
        component: () => import('../pages/ExerciseDetailPage.vue'),
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('../pages/ChatPage.vue'),
      },
      {
        path: 'chat/config',
        component: () => import('../pages/chat-config/ChatConfigLayout.vue'),
        redirect: { name: 'ChatConfigKnowledge' },
        children: [
          {
            path: 'knowledge',
            name: 'ChatConfigKnowledge',
            component: () => import('../pages/chat-config/ChatConfigKnowledgePage.vue'),
          },
          {
            path: 'skills',
            name: 'ChatConfigSkills',
            component: () => import('../pages/chat-config/ChatConfigSkillsPage.vue'),
          },
          {
            path: 'models',
            name: 'ChatConfigModels',
            component: () => import('../pages/chat-config/ChatConfigModelsPage.vue'),
          },
        ],
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../pages/ProfilePage.vue'),
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.public) {
    return true
  }
  const token = getToken()
  if (!token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

export const setupRouter = (app: App) => {
  app.use(router)
}
