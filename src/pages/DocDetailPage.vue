<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import type { DocDetail } from '../services/docs'
import { getDocFile, getDocsList } from '../services/docs'
import type { Difficulty, QuestionType } from '../services/exercises'
import { generateExercise, getExerciseDetail } from '../services/exercises'

const route = useRoute()
const router = useRouter()
const docId = computed(() => route.params.docId as string)

const loading = ref(true)
const initError = ref(false)
const fileName = ref('')
const fileContent = ref<'pdf' | 'text' | 'unsupported' | null>(null)
const pdfObjectUrl = ref('')
const textContent = ref('')
const generateDialogVisible = ref(false)
const generateForm = reactive({
  types: ['single_choice'] as QuestionType[],
  difficulty: 'medium' as Difficulty,
  count: 10,
})
const generateLoading = ref(false)
const generateCancelled = ref(false)
let exercisePollTimer: number | null = null

const typeOptions: { value: QuestionType; label: string }[] = [
  { value: 'single_choice', label: '单选题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'short_answer', label: '简答题' },
]
const difficultyOptions: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

const stopExercisePoll = () => {
  if (exercisePollTimer) {
    window.clearInterval(exercisePollTimer)
    exercisePollTimer = null
  }
}

const fetchDocById = async () => {
  const pageSize = 20
  let currentPage = 1
  let totalPages = 1
  while (currentPage <= totalPages) {
    const res = await getDocsList({ page: currentPage, pageSize })
    const found = res.items?.find((item) => item.docId === docId.value)
    if (found) return found
    if (currentPage === 1) {
      totalPages = Math.ceil((res.total || 0) / pageSize)
      if (!totalPages) return null
    }
    currentPage += 1
  }
  return null
}

const getFileExt = (name: string) =>
  name.split('.').pop()?.toLowerCase() || ''

const loadFileContent = async (detail: DocDetail) => {
  try {
    const blob = await getDocFile(docId.value)
    const ext = getFileExt(detail.fileName)
    if (ext === 'pdf') {
      pdfObjectUrl.value = URL.createObjectURL(blob)
      fileContent.value = 'pdf'
    } else if (ext === 'txt') {
      textContent.value = await blob.text()
      fileContent.value = 'text'
    } else {
      fileContent.value = 'unsupported'
    }
  } catch {
    fileContent.value = 'unsupported'
  }
}

const handleGenerateExercise = () => {
  generateForm.types = ['single_choice']
  generateForm.difficulty = 'medium'
  generateForm.count = 10
  generateCancelled.value = false
  generateDialogVisible.value = true
}

const handleGenerateSubmit = async () => {
  if (generateForm.types.length === 0) {
    ElMessage.warning('请至少选择一种题目类型')
    return
  }
  if (generateForm.count < 1 || generateForm.count > 50) {
    ElMessage.warning('题目数量需在 1-50 之间')
    return
  }
  generateLoading.value = true
  generateCancelled.value = false
  stopExercisePoll()
  try {
    const res = await generateExercise({
      docId: docId.value,
      types: generateForm.types,
      difficulty: generateForm.difficulty,
      count: generateForm.count,
    })
    const exerciseId = res.exerciseId
    exercisePollTimer = window.setInterval(async () => {
      if (generateCancelled.value) {
        stopExercisePoll()
        return
      }
      try {
        const detail = await getExerciseDetail(exerciseId)
        if (detail.status === 'ready') {
          stopExercisePoll()
          generateLoading.value = false
          generateDialogVisible.value = false
          router.push(`/exercises/${exerciseId}`)
          ElMessage.success('练习题生成成功')
        } else if (detail.status === 'failed') {
          stopExercisePoll()
          generateLoading.value = false
          ElMessage.error('生成失败，请重试')
        }
      } catch {
        // keep polling
      }
    }, 1500)
  } catch {
    generateLoading.value = false
  }
}

const handleGenerateCancel = () => {
  generateCancelled.value = true
  stopExercisePoll()
  generateLoading.value = false
  generateDialogVisible.value = false
}

const initDetail = async () => {
  loading.value = true
  initError.value = false
  pdfObjectUrl.value = ''
  textContent.value = ''
  fileContent.value = null
  try {
    const detail = await fetchDocById()
    if (!detail) {
      initError.value = true
      return
    }
    fileName.value = detail.fileName
    await loadFileContent(detail)
  } catch {
    initError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  initDetail()
})

onBeforeUnmount(() => {
  stopExercisePoll()
  if (pdfObjectUrl.value) {
    URL.revokeObjectURL(pdfObjectUrl.value)
  }
})
</script>

<template>
  <div class="page doc-detail-page">
    <div v-if="initError" class="init-error">
      <el-alert
        title="加载失败，请检查网络后重试"
        type="error"
        show-icon
      />
      <el-button type="primary" @click="initDetail">重试</el-button>
    </div>
    <el-card v-else>
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">资料详情</div>
            <div class="subtitle">{{ fileName || '未命名资料' }}</div>
          </div>
          <div class="actions">
            <el-button type="primary" @click="handleGenerateExercise">
              生成练习题
            </el-button>
          </div>
        </div>
      </template>

      <el-skeleton :loading="loading" animated>
        <template #default>
          <div v-if="fileContent === 'pdf'" class="file-preview pdf-preview">
            <iframe
              :src="pdfObjectUrl"
              class="pdf-iframe"
              title="PDF 预览"
            />
          </div>
          <div v-else-if="fileContent === 'text'" class="file-preview text-preview">
            <pre class="text-content">{{ textContent }}</pre>
          </div>
          <div v-else-if="fileContent === 'unsupported'" class="file-preview unsupported">
            <p class="unsupported-hint">
              此格式暂不支持在线预览，请使用下方「生成练习题」功能。
            </p>
            <el-button type="primary" @click="handleGenerateExercise">
              生成练习题
            </el-button>
          </div>
          <div v-else-if="!loading && !fileContent" class="file-preview unsupported">
            <p class="unsupported-hint">暂无内容可预览</p>
          </div>
        </template>
      </el-skeleton>
    </el-card>

    <el-dialog
      v-model="generateDialogVisible"
      title="生成练习题"
      width="420px"
      :close-on-click-modal="!generateLoading"
      :close-on-press-escape="!generateLoading"
      @close="handleGenerateCancel"
    >
      <template v-if="!generateLoading">
        <el-form label-width="90px">
          <el-form-item label="题目类型">
            <el-checkbox-group v-model="generateForm.types">
              <el-checkbox
                v-for="opt in typeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="难度">
            <el-radio-group v-model="generateForm.difficulty">
              <el-radio
                v-for="opt in difficultyOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="题目数量">
            <el-input-number
              v-model="generateForm.count"
              :min="1"
              :max="50"
            />
          </el-form-item>
        </el-form>
      </template>
      <template v-else>
        <div class="generate-loading">
          <el-icon class="loading-icon" :size="48"><Loading /></el-icon>
          <p>正在生成练习题，请稍候…</p>
          <el-button @click="handleGenerateCancel">取消</el-button>
        </div>
      </template>
      <template #footer>
        <template v-if="!generateLoading">
          <el-button @click="handleGenerateCancel">取消</el-button>
          <el-button type="primary" @click="handleGenerateSubmit">开始生成</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.doc-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-weight: 600;
}

.subtitle {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 13px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-preview {
  min-height: 400px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  overflow: hidden;
}

.pdf-preview {
  height: 70vh;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.text-preview {
  padding: 16px;
  background: #fafbfc;
}

.text-content {
  margin: 0;
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
}

.unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  background: #fafbfc;
}

.unsupported-hint {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.generate-loading {
  text-align: center;
  padding: 24px 0;
}
.generate-loading .loading-icon {
  display: inline-block;
  animation: spin 1s linear infinite;
}
.generate-loading p {
  margin: 16px 0;
  color: #606266;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.init-error {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
</style>
