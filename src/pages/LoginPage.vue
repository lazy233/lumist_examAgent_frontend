<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { login } from '../services/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  if (!formRef.value) {
    return
  }

  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) {
    return
  }

  try {
    loading.value = true
    const data = await login({ username: form.username, password: form.password })
    authStore.updateToken(data.token)
    authStore.updateUser(data.user)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
    ElMessage.success('登录成功')
  } finally {
    loading.value = false
  }
}

const handleSkip = () => {
  authStore.updateToken('dev-token')
  authStore.updateUser({ id: 'dev', name: '演示用户' })
  router.replace('/dashboard')
}
</script>

<template>
  <div class="login-page">
    <div class="login-panel">
      <div class="brand">
        <div class="brand-title"><span class="lumist-accent">LUMIST</span> 学生端</div>
        <div class="brand-subtitle">上传资料，生成练习，随时巩固</div>
      </div>
      <el-card class="login-card">
        <template #header>
          <span>账号登录</span>
        </template>
        <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="handleLogin">
              登录
            </el-button>
            <el-button @click="handleSkip">跳过登录</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, var(--lumist-bg) 0%, var(--lumist-secondary-light) 50%, #fff 100%);
  padding: 24px;
}

.login-panel {
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 32px;
  align-items: center;
}

.brand-title {
  font-size: 36px;
  font-weight: 600;
  color: #1f2329;
}
.brand-title .lumist-accent {
  color: var(--el-color-primary);
}

.brand-subtitle {
  margin-top: 12px;
  color: #5f6b7a;
  font-size: 16px;
}

.login-card {
  width: 100%;
}

@media (max-width: 820px) {
  .login-panel {
    grid-template-columns: 1fr;
  }
}
</style>
