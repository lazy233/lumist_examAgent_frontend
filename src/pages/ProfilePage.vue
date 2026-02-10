<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { getProfile, updateProfile } from '../services/user'

const authStore = useAuthStore()
const loading = ref(true)

const displayName = computed(() => authStore.user?.name || authStore.user?.username || '未登录用户')
const userId = computed(() => authStore.user?.id || profileForm.userId || '-')

/** 后端题型偏好 -> 前端 value 映射 */
const typePreferenceMap: Record<string, string> = {
  单: 'single_choice',
  单选题: 'single_choice',
  多: 'multiple_choice',
  多选题: 'multiple_choice',
  判: 'judgment',
  判断题: 'judgment',
  填: 'fill_blank',
  填空题: 'fill_blank',
  简: 'short_answer',
  简答题: 'short_answer',
}
/** 前端 value -> 后端题型偏好（与 GET 返回格式一致：简写） */
const typeToBackendMap: Record<string, string> = {
  single_choice: '单',
  multiple_choice: '多',
  judgment: '判',
  fill_blank: '填',
  short_answer: '简',
}
/** 后端难度偏好 -> 前端 value */
const difficultyMap: Record<string, string> = {
  简单: 'easy',
  中等: 'medium',
  困难: 'hard',
}
/** 前端 value -> 后端难度偏好 */
const difficultyToBackendMap: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const profileForm = reactive({
  userId: '',
  name: '',
  school: '',
  major: '',
  grade: '',
  age: undefined as number | undefined,
  gender: '',
  preferredType: 'single_choice',
  preferredDifficulty: 'medium',
  preferredCount: 5 as number | undefined,
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

const questionTypeOptions = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'judgment', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'short_answer', label: '简答题' },
]

const difficultyOptions = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

const countOptions = [
  { value: 5, label: '5 题' },
  { value: 10, label: '10 题' },
  { value: 15, label: '15 题' },
  { value: 20, label: '20 题' },
]

const fetchProfile = async () => {
  loading.value = true
  try {
    const res = await getProfile()
    profileForm.userId = res.userId ?? ''
    profileForm.name = res.name ?? ''
    profileForm.school = res.school ?? ''
    profileForm.major = res.major ?? ''
    profileForm.grade = res.grade ?? ''
    profileForm.age = res.age != null && res.age > 0 ? res.age : undefined
    profileForm.gender = res.gender ?? ''
    profileForm.preferredType = typePreferenceMap[res.questionTypePreference ?? ''] ?? 'single_choice'
    profileForm.preferredDifficulty = difficultyMap[res.difficultyPreference ?? ''] ?? 'medium'
    profileForm.preferredCount = res.questionCount ?? 5
    authStore.updateUser({
      id: res.userId ?? authStore.user?.id ?? 'local',
      name: res.name ?? '',
      school: res.school,
      major: res.major,
      grade: res.grade,
      age: res.age,
      gender: res.gender,
      preferredTypes: typeToBackendMap[profileForm.preferredType],
      preferredDifficulty: difficultyToBackendMap[profileForm.preferredDifficulty],
      preferredCount: res.questionCount,
    })
  } catch {
    // 接口未实现时，用 authStore 数据初始化表单
    const u = authStore.user
    if (u) {
      profileForm.userId = u.id ?? ''
      profileForm.name = u.name ?? ''
      profileForm.school = u.school ?? ''
      profileForm.major = u.major ?? ''
      profileForm.grade = u.grade ?? ''
      profileForm.age = u.age ?? undefined
      profileForm.gender = u.gender ?? ''
      const prefType = (u.preferredTypes ?? '').trim()
      profileForm.preferredType = typePreferenceMap[prefType] ?? 'single_choice'
      profileForm.preferredDifficulty = difficultyMap[u.preferredDifficulty ?? ''] ?? 'medium'
      profileForm.preferredCount = u.preferredCount ?? 5
    }
  } finally {
    loading.value = false
  }
}

const handleSaveProfile = async () => {
  if (!profileForm.name?.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  try {
    await updateProfile({
      name: profileForm.name.trim(),
      school: profileForm.school?.trim() || undefined,
      major: profileForm.major?.trim() || undefined,
      grade: profileForm.grade || undefined,
      age: profileForm.age != null && profileForm.age > 0 ? profileForm.age : undefined,
      gender: profileForm.gender || undefined,
      questionTypePreference: typeToBackendMap[profileForm.preferredType],
      difficultyPreference: difficultyToBackendMap[profileForm.preferredDifficulty],
      questionCount: profileForm.preferredCount,
    })
    authStore.updateUser({
      id: (profileForm.userId || authStore.user?.id) ?? 'local',
      name: profileForm.name.trim(),
      school: profileForm.school?.trim() || undefined,
      major: profileForm.major?.trim() || undefined,
      grade: profileForm.grade || undefined,
      age: profileForm.age ?? undefined,
      gender: profileForm.gender || undefined,
      preferredTypes: typeToBackendMap[profileForm.preferredType],
      preferredDifficulty: difficultyToBackendMap[profileForm.preferredDifficulty],
      preferredCount: profileForm.preferredCount,
    })
    ElMessage.success('资料已保存')
  } catch {
    ElMessage.error('保存失败，请重试')
  }
}

onMounted(() => {
  fetchProfile()
})
</script>

<template>
  <div class="page profile-page">
    <el-card v-loading="loading" class="profile-card">
      <template #header>
        <div class="card-header">
          <span>个人中心</span>
          <span class="welcome">欢迎回来，{{ displayName }}</span>
        </div>
      </template>
      <p class="form-tip">以下信息将用于辅助 AI 出题，请尽量填写完整。</p>
      <el-form :model="profileForm" label-width="90px" size="default" class="profile-form">
        <div class="form-grid">
          <el-form-item label="用户 ID">
            <span class="readonly-value">{{ userId }}</span>
          </el-form-item>
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
            <el-select v-model="profileForm.grade" placeholder="请选择" clearable style="width: 100%">
              <el-option v-for="opt in gradeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
          </el-form-item>
          <el-form-item label="年龄">
            <el-input-number v-model="profileForm.age" :min="1" :max="120" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="profileForm.gender">
              <el-radio v-for="opt in genderOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="题型偏好">
            <el-select v-model="profileForm.preferredType" placeholder="请选择" clearable style="width: 100%">
              <el-option v-for="opt in questionTypeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
          </el-form-item>
          <el-form-item label="难度偏好">
            <el-select v-model="profileForm.preferredDifficulty" placeholder="请选择" clearable style="width: 100%">
              <el-option v-for="opt in difficultyOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
          </el-form-item>
          <el-form-item label="题目数量">
            <el-select v-model="profileForm.preferredCount" placeholder="请选择" clearable style="width: 100%">
              <el-option v-for="opt in countOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item class="save-item">
          <el-button type="primary" @click="handleSaveProfile">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 800px;
  margin: 0 auto;
}

.profile-card :deep(.el-card__header) {
  padding: 20px 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card-header > span:first-child {
  font-size: 18px;
  font-weight: 600;
}

.welcome {
  font-size: 14px;
  color: #909399;
}

.form-tip {
  margin: 0 0 24px;
  font-size: 13px;
  color: #909399;
}

.profile-form {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 32px;
}

.profile-form :deep(.el-form-item) {
  margin-bottom: 20px;
  min-width: 0;
}
.profile-form :deep(.el-form-item__label) {
  white-space: nowrap;
}
.profile-form :deep(.el-form-item__content) {
  min-width: 0;
  white-space: nowrap;
}
.profile-form :deep(.el-input__inner),
.profile-form :deep(.el-input-number .el-input__inner),
.profile-form :deep(.el-select__selected-item) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-form :deep(.el-radio-group) {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.readonly-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.readonly-value {
  color: #606266;
  font-size: 14px;
}

.save-item {
  margin-top: 16px;
  margin-bottom: 0;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0 24px;
  }
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
