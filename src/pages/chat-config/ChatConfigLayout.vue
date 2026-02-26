<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Collection, Document, Setting } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const tabs = [
  { path: '/chat/config/knowledge', label: '知识库管理', icon: Collection },
  { path: '/chat/config/skills', label: 'Skills 管理', icon: Document },
  { path: '/chat/config/models', label: '模型管理', icon: Setting },
]

const isActive = (path: string) => route.path === path

function goBack() {
  router.push('/chat')
}
</script>

<template>
  <div class="config-layout">
    <header class="config-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
    </header>
    <div class="config-body">
      <aside class="config-sidebar">
        <nav class="config-nav">
          <router-link
            v-for="t in tabs"
            :key="t.path"
            :to="t.path"
            class="config-nav-item"
            :class="{ active: isActive(t.path) }"
          >
            <el-icon><component :is="t.icon" /></el-icon>
            <span>{{ t.label }}</span>
          </router-link>
        </nav>
      </aside>
      <main class="config-main">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.config-layout {
  min-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: #fff;
}
.config-header {
  padding: 16px 24px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.config-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.config-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  background: #fafafa;
}
.config-nav {
  padding: 16px 0;
}
.config-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  color: #606266;
  text-decoration: none;
  font-size: 14px;
  transition: background 0.2s, color 0.2s;
}
.config-nav-item:hover {
  background: #f0f2f5;
  color: var(--el-color-primary);
}
.config-nav-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}
.config-main {
  flex: 1;
  overflow: auto;
  padding: 24px;
}
</style>
