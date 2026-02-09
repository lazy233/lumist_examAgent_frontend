<script setup lang="ts">
import { User, Lock, UserFilled } from '@element-plus/icons-vue'
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { login, register } from '../services/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isRegister = ref(false)
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  name: '',
})

const validateConfirmPassword = (_rule: unknown, value: string, callback: (err?: Error) => void) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const registerRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少 6 位', trigger: 'blur' }],
  confirmPassword: [{ required: true, message: '请再次输入密码', trigger: 'blur' }, { validator: validateConfirmPassword, trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

const currentRules = () => (isRegister.value ? registerRules : loginRules)

const resetForm = () => {
  form.username = ''
  form.password = ''
  form.confirmPassword = ''
  form.name = ''
  formRef.value?.clearValidate()
}

const handleLogin = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    loading.value = true
    const data = await login({ username: form.username, password: form.password })
    authStore.updateToken(data.token)
    authStore.updateUser({
      ...data.user,
      name: data.user.name || (data.user as { username?: string }).username || '',
    })
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
    ElMessage.success('登录成功')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    loading.value = true
    const data = await register({ username: form.username, password: form.password, name: form.name.trim() || undefined })
    authStore.updateToken(data.token)
    authStore.updateUser({
      ...data.user,
      name: data.user.name || (data.user as { username?: string }).username || form.name.trim() || '',
    })
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
    ElMessage.success('注册成功')
  } finally {
    loading.value = false
  }
}

const handleSubmit = () => {
  if (isRegister.value) {
    handleRegister()
  } else {
    handleLogin()
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
    <div class="login-bg">
      <div class="bg-glow bg-glow-1" />
      <div class="bg-glow bg-glow-2" />
      <div class="bg-glow bg-glow-3" />
      <div class="bg-glow bg-glow-4" />
      <div class="bg-glow bg-glow-5" />
    </div>
    <div class="login-panel">
      <div class="brand-area">
        <img src="/image.svg" alt="LUMIST" class="brand-logo" />
        <h1 class="brand-title">智能出题练习平台</h1>
        <p class="brand-subtitle">上传资料，AI 出题，随时巩固</p>
        <div class="brand-deco" />
      </div>
      <div class="form-area">
        <div class="form-card">
          <div class="form-tabs">
            <button type="button" class="tab-btn" :class="{ active: !isRegister }" @click="isRegister = false; resetForm()">登录</button>
            <button type="button" class="tab-btn" :class="{ active: isRegister }" @click="isRegister = true; resetForm()">注册</button>
          </div>
          <h2 class="form-card-title">{{ isRegister ? '创建账号' : '账号登录' }}</h2>
          <el-form ref="formRef" :model="form" :rules="currentRules()" class="login-form" @submit.prevent="handleSubmit">
            <el-form-item prop="username">
              <el-input v-model="form.username" placeholder="用户名" size="large" :prefix-icon="User" autocomplete="username" />
            </el-form-item>
            <el-form-item v-if="isRegister" prop="name">
              <el-input v-model="form.name" placeholder="姓名" size="large" :prefix-icon="UserFilled" autocomplete="name" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="form.password" type="password" placeholder="密码" size="large" :prefix-icon="Lock" show-password :autocomplete="isRegister ? 'new-password' : 'current-password'" @keyup.enter="handleSubmit" />
            </el-form-item>
            <el-form-item v-if="isRegister" prop="confirmPassword">
              <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" size="large" :prefix-icon="Lock" show-password autocomplete="new-password" @keyup.enter="handleSubmit" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleSubmit">
                {{ isRegister ? '注册' : '登录' }}
              </el-button>
            </el-form-item>
            <button v-if="!isRegister" type="button" class="skip-link" @click="handleSkip">演示模式</button>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 50%, #f8fafc 100%);
  z-index: 0;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.bg-glow-1 {
  width: 900px;
  height: 900px;
  top: -300px;
  left: -200px;
  background: radial-gradient(circle, rgba(232, 183, 36, 0.2) 0%, transparent 60%);
}

.bg-glow-2 {
  width: 750px;
  height: 750px;
  bottom: -250px;
  right: -150px;
  background: radial-gradient(circle, rgba(91, 124, 154, 0.18) 0%, transparent 60%);
}

.bg-glow-3 {
  width: 600px;
  height: 600px;
  top: 30%;
  right: 20%;
  background: radial-gradient(circle, rgba(232, 183, 36, 0.12) 0%, transparent 55%);
}

.bg-glow-4 {
  width: 500px;
  height: 500px;
  bottom: 20%;
  left: -100px;
  background: radial-gradient(circle, rgba(91, 124, 154, 0.14) 0%, transparent 55%);
}

.bg-glow-5 {
  width: 400px;
  height: 400px;
  top: 60%;
  left: 30%;
  background: radial-gradient(circle, rgba(232, 183, 36, 0.1) 0%, transparent 50%);
}

.login-panel {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  align-items: center;
}

.brand-area {
  padding: 80px 100px;
  color: #1f2329;
}

.brand-logo {
  height: 56px;
  width: auto;
  margin-bottom: 48px;
}

.brand-title {
  font-size: 44px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.brand-subtitle {
  margin: 24px 0 0;
  font-size: 20px;
  color: #5f6b7a;
}

.brand-deco {
  margin-top: 64px;
  width: 120px;
  height: 6px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--lumist-secondary));
  border-radius: 3px;
}

.form-area {
  padding: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.form-area .form-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  padding: 40px;
}

.form-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.tab-btn {
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: #8c8c8c;
  font-size: 15px;
  cursor: pointer;
  border-radius: 8px;
}
.tab-btn:hover {
  color: #1f2329;
}
.tab-btn.active {
  color: var(--el-color-primary);
  font-weight: 600;
  background: var(--el-color-primary-light-9);
}

.form-area .form-card-title {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 22px;
}

.login-form :deep(.el-form-item:last-of-type) {
  margin-bottom: 16px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
}

.skip-link {
  display: block;
  width: 100%;
  text-align: center;
  background: none;
  border: none;
  color: #8c8c8c;
  font-size: 13px;
  cursor: pointer;
  padding: 8px 0;
}

.skip-link:hover {
  color: var(--lumist-secondary);
}

@media (max-width: 768px) {
  .login-panel {
    grid-template-columns: 1fr;
  }
  .brand-area {
    padding: 48px 24px 32px;
  }
  .brand-logo {
    height: 44px;
    margin-bottom: 32px;
  }
  .brand-title {
    font-size: 32px;
  }
  .brand-subtitle {
    font-size: 16px;
    margin-top: 16px;
  }
  .brand-deco {
    width: 80px;
    height: 5px;
    margin-top: 48px;
  }
  .form-area {
    padding: 32px 24px;
  }
}
</style>
