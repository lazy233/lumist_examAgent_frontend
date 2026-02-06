<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import type { UserInfo } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const displayName = computed(() => authStore.user?.name || '未登录用户')
const userId = computed(() => authStore.user?.id || '-')

const profileForm = reactive({
  name: authStore.user?.name ?? '',
  school: authStore.user?.school ?? '',
  major: authStore.user?.major ?? '',
  grade: authStore.user?.grade ?? '',
  age: authStore.user?.age ?? undefined as number | undefined,
  gender: authStore.user?.gender ?? '',
})

const genderOptions = [
  { value: '男', label: '男' },
  { value: '女', label: '女' },
]

const gradeOptions = [
  { value: '初一', label: '初一' },
  { value: '初二', label: '初二' },
  { value: '初三', label: '初三' },
  { value: '高一', label: '高一' },
  { value: '高二', label: '高二' },
  { value: '高三', label: '高三' },
  { value: '大一', label: '大一' },
  { value: '大二', label: '大二' },
  { value: '大三', label: '大三' },
  { value: '大四', label: '大四' },
]

const handleSaveProfile = () => {
  if (!profileForm.name?.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  const user: UserInfo = {
    id: authStore.user?.id ?? 'local',
    name: profileForm.name.trim(),
    school: profileForm.school?.trim() || undefined,
    major: profileForm.major?.trim() || undefined,
    grade: profileForm.grade || undefined,
    age: profileForm.age != null && profileForm.age > 0 ? profileForm.age : undefined,
    gender: profileForm.gender || undefined,
  }
  authStore.updateUser(user)
  ElMessage.success('资料已保存')
}

const handleLogout = () => {
  authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="page profile-page">
    <div class="profile-header">
      <div>
        <div class="profile-title">个人中心</div>
        <div class="profile-subtitle">欢迎回来，{{ displayName }}</div>
      </div>
      <el-button type="danger" plain @click="handleLogout">退出登录</el-button>
    </div>

    <div class="profile-grid">
      <el-card>
        <template #header>
          <span>基础信息</span>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="用户 ID">
            {{ userId }}
          </el-descriptions-item>
          <el-descriptions-item label="姓名">
            {{ displayName }}
          </el-descriptions-item>
        </el-descriptions>
        <el-divider />
        <p class="form-tip">以下信息将用于辅助 AI 出题，请尽量填写完整。</p>
        <el-form label-width="90px" class="profile-form">
          <el-form-item label="姓名" required>
            <el-input v-model="profileForm.name" placeholder="请输入姓名" />
          </el-form-item>
          <el-form-item label="学校">
            <el-input v-model="profileForm.school" placeholder="请输入学校" />
          </el-form-item>
          <el-form-item label="专业">
            <el-input v-model="profileForm.major" placeholder="请输入专业" />
          </el-form-item>
          <el-form-item label="年级">
            <el-select v-model="profileForm.grade" placeholder="请选择年级" clearable style="width: 100%">
              <el-option v-for="opt in gradeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
          </el-form-item>
          <el-form-item label="年龄">
            <el-input-number v-model="profileForm.age" :min="1" :max="120" placeholder="年龄" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="profileForm.gender">
              <el-radio v-for="opt in genderOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSaveProfile">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.profile-title {
  font-size: 22px;
  font-weight: 600;
}

.profile-subtitle {
  color: #5f6b7a;
  margin-top: 4px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.form-tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: #909399;
}

.profile-form {
  max-width: 400px;
}
</style>
