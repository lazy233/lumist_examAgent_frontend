<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const userName = computed(() => authStore.user?.name || authStore.user?.username || '用户')

const navItems = [
  { path: '/dashboard', label: '出题中心' },
  { path: '/docs', label: '我的资料' },
  { path: '/exercises', label: '我的练习' },
  { path: '/profile', label: '个人中心' },
]

const isActive = (path: string) => {
  if (path === '/dashboard') return route.path === '/dashboard'
  return route.path.startsWith(path)
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
  ElMessage.success('已退出登录')
}
</script>

<template>
  <div class="main-layout">
    <header class="layout-header">
      <div class="layout-header-inner">
        <router-link to="/dashboard" class="logo">
          <img src="/image.svg" alt="LUMIST" class="logo-img" />
        </router-link>
        <nav class="nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            :class="{ active: isActive(item.path) }"
          >
            {{ item.label }}
          </router-link>
        </nav>
        <div class="header-right">
          <span class="user-name">{{ userName }}</span>
          <el-button type="danger" plain size="small" @click="handleLogout">
            退出
          </el-button>
        </div>
      </div>
    </header>
    <main class="layout-main">
      <router-view v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--lumist-bg);
}
.layout-header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}
.layout-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.logo {
  display: flex;
  align-items: center;
  text-decoration: none;
}
.logo-img {
  height: 28px;
  width: auto;
  display: block;
}
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}
.nav-link {
  padding: 8px 16px;
  color: #5f6b7a;
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
}
.nav-link:hover {
  color: var(--lumist-secondary);
  background: var(--lumist-secondary-light);
}
.nav-link.active {
  color: var(--el-color-primary);
  font-weight: 500;
  background: var(--el-color-primary-light-9);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  font-size: 14px;
  color: #5f6b7a;
}
.layout-main {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 768px) {
  .layout-header-inner {
    flex-wrap: wrap;
    height: auto;
    min-height: 56px;
    padding: 12px 16px;
  }
  .nav {
    order: 3;
    width: 100%;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #ebeef5;
  }
  .user-name {
    display: none;
  }
}
</style>
