<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import type { DocDetail, DocStatus } from '../services/docs'
import { getDocsList, startParse } from '../services/docs'
import type { Difficulty, QuestionType } from '../services/exercises'
import { generateExercise, getExerciseDetail } from '../services/exercises'

const route = useRoute()
const router = useRouter()
const docId = computed(() => route.params.docId as string)

const loading = ref(true)
const initError = ref(false)
const status = ref<DocStatus>('uploaded')
const fileName = ref('')
const errorMessage = ref('')

const parsed = reactive({
  school: '',
  major: '',
  course: '',
  summary: '',
})

const knowledgePoints = ref<string[]>([])

let pollTimer: number | null = null

const isParsing = computed(() => status.value === 'parsing' || status.value === 'uploaded')
const isDone = computed(() => status.value === 'done')
const isFailed = computed(() => status.value === 'failed')

const applyDetail = (detail: DocDetail) => {
  fileName.value = detail.fileName
  status.value = detail.status
  parsed.school = detail.parsed?.school || ''
  parsed.major = detail.parsed?.major || ''
  parsed.course = detail.parsed?.course || ''
  parsed.summary = detail.parsed?.summary || ''
  knowledgePoints.value = detail.parsed?.knowledgePoints || []
}

const stopPolling = () => {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

const fetchDocById = async () => {
  const pageSize = 20
  let currentPage = 1
  let totalPages = 1

  while (currentPage <= totalPages) {
    const res = await getDocsList({ page: currentPage, pageSize })
    const found = res.items?.find((item) => item.docId === docId.value)
    if (found) {
      return found
    }
    if (currentPage === 1) {
      totalPages = Math.ceil((res.total || 0) / pageSize)
      if (!totalPages) {
        return null
      }
    }
    currentPage += 1
  }

  return null
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = window.setInterval(async () => {
    try {
      const detail = await fetchDocById()
      if (!detail) {
        return
      }
      applyDetail(detail)
      if (detail.status === 'done' || detail.status === 'failed') {
        stopPolling()
      }
    } catch {
      // keep polling
    }
  }, 1000)
}

const handleRetryParse = async () => {
  errorMessage.value = ''
  await startParse(docId.value)
  status.value = 'parsing'
  startPolling()
}

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
  try {
    const detail = await fetchDocById()
    if (!detail) {
      initError.value = true
      return
    }
    applyDetail(detail)
    if (detail.status === 'uploaded') {
      await startParse(docId.value)
      status.value = 'parsing'
    }
    if (status.value === 'parsing' || detail.status === 'parsing') {
      startPolling()
    }
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
  stopPolling()
  stopExercisePoll()
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
            <el-tag v-if="isParsing" type="warning">解析中</el-tag>
            <el-tag v-else-if="isDone" type="success">解析完成</el-tag>
            <el-tag v-else-if="isFailed" type="danger">解析失败</el-tag>
            <el-tag v-else type="info">已上传</el-tag>
          </div>
        </div>
      </template>

      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="section">
            <div class="section-title">学校</div>
            <div v-if="parsed.school">{{ parsed.school }}</div>
            <el-skeleton-item v-else-if="isParsing" variant="text" />
            <div v-else class="placeholder">暂无</div>
          </div>

          <div class="section">
            <div class="section-title">专业</div>
            <div v-if="parsed.major">{{ parsed.major }}</div>
            <el-skeleton-item v-else-if="isParsing" variant="text" />
            <div v-else class="placeholder">暂无</div>
          </div>

          <div class="section">
            <div class="section-title">课程</div>
            <div v-if="parsed.course">{{ parsed.course }}</div>
            <el-skeleton-item v-else-if="isParsing" variant="text" />
            <div v-else class="placeholder">暂无</div>
          </div>

          <div class="section">
            <div class="section-title">核心知识点</div>
            <div v-if="knowledgePoints.length" class="chips">
              <el-tag v-for="(item, index) in knowledgePoints" :key="index">
                {{ item }}
              </el-tag>
            </div>
            <el-skeleton-item v-else-if="isParsing" variant="text" />
            <div v-else class="placeholder">暂无</div>
          </div>

          <div class="section">
            <div class="section-title">内容摘要</div>
            <div v-if="parsed.summary" class="summary">{{ parsed.summary }}</div>
            <el-skeleton-item v-else-if="isParsing" variant="text" />
            <div v-else class="placeholder">暂无</div>
          </div>

          <div v-if="isFailed" class="error-area">
            <el-alert
              :title="errorMessage || '解析失败，请重试'"
              type="error"
              show-icon
            />
            <el-button type="primary" class="mt-12" @click="handleRetryParse">
              重新解析
            </el-button>
          </div>

          <div class="footer-actions">
            <el-button type="primary" :disabled="!isDone" @click="handleGenerateExercise">
              生成练习题
            </el-button>
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
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.section {
  margin-bottom: 18px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary {
  white-space: pre-wrap;
  line-height: 1.8;
}

.placeholder {
  color: #9aa4b2;
}

.error-area {
  margin-top: 16px;
}

.mt-12 {
  margin-top: 12px;
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

.footer-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.init-error {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
</style>
