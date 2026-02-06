<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import type {
  Difficulty,
  ExerciseDetail,
  Question,
  ResultItem,
} from '../services/exercises'
import { getExerciseDetail, submitExercise } from '../services/exercises'

const route = useRoute()
const exerciseId = computed(() => route.params.exerciseId as string)

const loading = ref(true)
const initError = ref(false)
const submitting = ref(false)
const detail = ref<ExerciseDetail | null>(null)
const answers = reactive<Record<string, string>>({})
const results = ref<ResultItem[] | null>(null)
const onlyWrong = ref(false)
let pollTimer: number | null = null

const difficultyMap: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const questions = computed(() => detail.value?.questions ?? [])
const currentIndex = ref(0)
const currentQuestion = computed(
  () => questions.value[currentIndex.value] ?? null
)
const hasSubmitted = computed(() => results.value !== null)
const displayQuestions = computed(() => {
  const list = questions.value
  if (!hasSubmitted.value || !onlyWrong.value) return list
  const resultMap = new Map(results.value!.map((r) => [r.questionId, r]))
  return list.filter((q) => !resultMap.get(q.questionId)?.isCorrect)
})
const submitResp = ref<{ score: number; correctRate: number } | null>(null)

const stopPoll = () => {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

const fetchDetail = async () => {
  const d = await getExerciseDetail(exerciseId.value)
  detail.value = d
  if (d.status === 'generating') {
    pollTimer = window.setInterval(async () => {
      try {
        const next = await getExerciseDetail(exerciseId.value)
        detail.value = next
        if (next.status === 'ready' || next.status === 'failed') {
          stopPoll()
        }
      } catch {
        // keep polling
      }
    }, 1500)
  }
}

const initAnswers = () => {
  questions.value.forEach((q) => {
    if (!(q.questionId in answers)) {
      answers[q.questionId] = ''
    }
  })
}

const goToQuestion = (index: number) => {
  currentIndex.value = Math.max(0, Math.min(index, questions.value.length - 1))
}

const handleSubmit = async () => {
  const list = questions.value
  const answerList = list.map((q) => ({
    questionId: q.questionId,
    answer: answers[q.questionId] ?? '',
  }))
  try {
    submitting.value = true
    const res = await submitExercise(exerciseId.value, answerList)
    results.value = res.results
    submitResp.value = { score: res.score, correctRate: res.correctRate }
    if (detail.value) {
      detail.value = { ...detail.value, score: res.score }
    }
    ElMessage.success('提交成功')
  } finally {
    submitting.value = false
  }
}

const getResult = (questionId: string) => {
  return results.value?.find((r) => r.questionId === questionId)
}

const getOptionKeys = (q: Question) =>
  q.options ? Object.keys(q.options).sort() : []

watch(questions, (q) => {
  if (q.length > 0) initAnswers()
}, { immediate: true })

const handleRetryLoad = async () => {
  initError.value = false
  loading.value = true
  try {
    await fetchDetail()
  } catch {
    initError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  handleRetryLoad()
})

onBeforeUnmount(() => {
  stopPoll()
})
</script>

<template>
  <div class="page exercise-detail-page">
    <div v-if="initError" class="init-error">
      <el-alert
        title="加载失败，请检查网络后重试"
        type="error"
        show-icon
      />
      <el-button type="primary" @click="handleRetryLoad">重试</el-button>
    </div>
    <el-card v-else v-loading="loading">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">{{ detail?.title || '练习作答' }}</div>
            <div class="meta">
              <el-tag size="small">{{ difficultyMap[detail?.difficulty ?? 'medium'] }}</el-tag>
              <span>{{ detail?.count ?? 0 }} 题</span>
            </div>
          </div>
        </div>
      </template>

      <template v-if="detail?.status === 'failed'">
        <el-alert type="error" title="练习生成失败，请重新生成" show-icon />
      </template>

      <template v-else-if="detail?.status === 'generating'">
        <div class="generating-hint">
          <el-icon class="spin"><Loading /></el-icon>
          <span>题目生成中，请稍候…</span>
        </div>
      </template>

      <template v-else-if="questions.length > 0">
        <!-- 已提交：展示总分、正确率、只看错题、题目结果列表 -->
        <template v-if="hasSubmitted && submitResp">
          <div class="result-summary">
            <div class="score-item">
              <span class="label">得分</span>
              <span class="value">{{ submitResp.score }}</span>
            </div>
            <div class="score-item">
              <span class="label">正确率</span>
              <span class="value">{{ Math.round((submitResp.correctRate ?? 0) * 100) }}%</span>
            </div>
            <el-switch
              v-model="onlyWrong"
              active-text="只看错题"
              class="wrong-toggle"
            />
          </div>

          <div v-if="displayQuestions.length === 0 && onlyWrong" class="all-correct">
            全部正确，没有错题
          </div>
          <div v-else class="questions-result-list">
            <div
              v-for="(q, idx) in displayQuestions"
              :key="q.questionId"
              class="question-block"
            >
              <div class="question-stem">
                {{ idx + 1 }}. {{ q.stem }}
              </div>
              <div class="result-row">
                <el-tag :type="getResult(q.questionId)?.isCorrect ? 'success' : 'danger'" size="small">
                  {{ getResult(q.questionId)?.isCorrect ? '正确' : '错误' }}
                </el-tag>
                <span class="ans-label">你的答案：</span>
                <span class="ans-value">{{ getResult(q.questionId)?.userAnswer ?? '-' }}</span>
              </div>
              <div class="result-row">
                <span class="ans-label">正确答案：</span>
                <span class="ans-value correct">{{ getResult(q.questionId)?.correctAnswer ?? '-' }}</span>
              </div>
              <div v-if="getResult(q.questionId)?.analysis" class="analysis">
                {{ getResult(q.questionId)?.analysis }}
              </div>
            </div>
          </div>
        </template>

        <!-- 未提交：逐题作答 -->
        <template v-else>
          <div class="question-nav">
            <el-button
              v-for="(q, i) in questions"
              :key="q.questionId"
              :type="currentIndex === i ? 'primary' : 'default'"
              size="small"
              circle
              @click="goToQuestion(i)"
            >
              {{ i + 1 }}
            </el-button>
          </div>

          <div v-if="currentQuestion" class="question-area">
            <div class="question-stem">{{ currentIndex + 1 }}. {{ currentQuestion.stem }}</div>

            <!-- 单选题 -->
            <div v-if="currentQuestion.type === 'single_choice'" class="options">
              <el-radio-group v-model="answers[currentQuestion.questionId]">
                <el-radio
                  v-for="key in getOptionKeys(currentQuestion)"
                  :key="key"
                  :label="key"
                >
                  {{ key }}. {{ currentQuestion.options?.[key] ?? '' }}
                </el-radio>
              </el-radio-group>
            </div>

            <!-- 填空题 -->
            <div v-else-if="currentQuestion.type === 'fill_blank'" class="input-wrap">
              <el-input
                v-model="answers[currentQuestion.questionId]"
                placeholder="请输入答案"
              />
            </div>

            <!-- 简答题 -->
            <div v-else-if="currentQuestion.type === 'short_answer'" class="input-wrap">
              <el-input
                v-model="answers[currentQuestion.questionId]"
                type="textarea"
                :rows="4"
                placeholder="请输入答案"
              />
            </div>
          </div>

          <div class="nav-actions">
            <el-button
              :disabled="currentIndex <= 0"
              @click="goToQuestion(currentIndex - 1)"
            >
              上一题
            </el-button>
            <el-button
              :disabled="currentIndex >= questions.length - 1"
              @click="goToQuestion(currentIndex + 1)"
            >
              下一题
            </el-button>
            <el-button
              type="primary"
              :loading="submitting"
              @click="handleSubmit"
            >
              提交
            </el-button>
          </div>
        </template>
      </template>

      <el-empty v-else-if="!loading" description="暂无题目" />
    </el-card>
  </div>
</template>

<style scoped>
.exercise-detail-page .card-header .title {
  font-weight: 600;
}
.meta {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 13px;
}
.meta .el-tag {
  margin-right: 8px;
}
.generating-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
}
.generating-hint .spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.result-summary {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}
.score-item .label {
  margin-right: 8px;
  color: #8c8c8c;
}
.score-item .value {
  font-weight: 600;
  font-size: 18px;
}
.wrong-toggle {
  margin-left: auto;
}
.all-correct {
  padding: 24px;
  text-align: center;
  color: #67c23a;
  font-size: 16px;
}
.questions-result-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.question-block {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.question-stem {
  font-weight: 500;
  margin-bottom: 12px;
  line-height: 1.6;
}
.result-row {
  margin-bottom: 8px;
  font-size: 14px;
}
.ans-label {
  color: #8c8c8c;
  margin-right: 8px;
}
.ans-value.correct {
  color: #67c23a;
}
.analysis {
  margin-top: 12px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
}
.question-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.question-area {
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}
.options :deep(.el-radio) {
  display: block;
  margin-bottom: 12px;
}
.input-wrap {
  margin-top: 12px;
}
.nav-actions {
  display: flex;
  gap: 12px;
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
