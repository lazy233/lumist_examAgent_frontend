<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { Loading, UploadFilled } from '@element-plus/icons-vue'
import { getDocFile, getDocsList } from '../services/docs'
import type { DocListItem } from '../services/docs'
import { dashboardPresets } from '../config/dashboardPresets'
import type { UsageInfo } from '../services/exercises'
import { analyzeFile, analyzeForConfirm, generateExerciseStreamFromText } from '../services/exercises'

const router = useRouter()
const fileInputRef = ref<HTMLInputElement | null>(null)

// 文档出题方式：资料库出题 | 上传文件
const uploadMode = ref<'doc_lib' | 'upload'>('upload')
const docList = ref<DocListItem[]>([])
const docListLoading = ref(false)
const selectedDocId = ref('')

/** 上传模式：用户选择的文件（不跳转，仅在本页出题） */
const selectedFile = ref<File | null>(null)
/** 当前显示的文件标题（上传文件名 或 资料库选中的文档名） */
const displayedFileTitle = ref('')

const loadDocList = async () => {
  if (uploadMode.value !== 'doc_lib') return
  docListLoading.value = true
  try {
    const res = await getDocsList({ pageSize: 100 })
    docList.value = res.items ?? []
    const first = docList.value[0]
    if (first && !selectedDocId.value) {
      selectedDocId.value = first.docId
    }
    const doc = docList.value.find((d) => d.docId === selectedDocId.value)
    if (doc) displayedFileTitle.value = doc.fileName || doc.docId
  } catch {
    docList.value = []
  } finally {
    docListLoading.value = false
  }
}

/** 文件分析结果（用于确认） */
const fileAnalyzeResult = ref<{ content: string; title: string } | null>(null)
/** 文件流下用户可编辑的标题 */
const fileTitleEdit = ref('')

// 核心输入区
const inputText = ref('')

// 控制栏：题型
const questionTypeOptions = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'short_answer', label: '简答题' },
]
const selectedType = ref('single_choice')

// 难度
const difficultyOptions = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const selectedDifficulty = ref('medium')

// 生成数量
const count = ref(5)
const minCount = 1
const maxCount = 50
const incrementCount = () => {
  if (count.value < maxCount) count.value++
}
defineExpose({ incrementCount })

// 动态交互面板
type PanelMode = 'message' | 'wait_confirm' | 'preview'
const panelMode = ref<PanelMode>('message')
const panelMessage = ref('输入文字材料后点击「AI 出题」，也可用右上角上传文档。')
/** 是否为文件出题流程（文件分析结果的确认） */
const isFileFlow = ref(false)
const confirmData = ref<{
  keyPoints: string[]
  questionType: string
  questionTypeLabel: string
  difficulty: string
  difficultyLabel: string
  count: number
} | null>(null)
const editableConfirmContent = ref('')
const isEditingConfirm = ref(false)
const previewContent = ref('')
const confirmLoading = ref(false)
const streaming = ref(false)
const generatedExerciseId = ref('')
/** 分析接口返回的 token 消耗 */
const usageAnalyze = ref<UsageInfo | null>(null)
/** 流式生成结束返回的 token 消耗 */
const usageGenerate = ref<UsageInfo | null>(null)

/** 从流式文本中解析题目：支持 1. 题干 / A. 选项 等格式，实时解析 */
interface ParsedQuestion {
  index: number
  stem: string
  options?: Record<string, string>
}

const parseQuestionsFromStream = (text: string): { questions: ParsedQuestion[]; partial?: string } => {
  if (!text.trim()) return { questions: [] }
  let s = text.trim()
  // 移除末尾可能的 JSON 行（exerciseId）
  const lines = s.split(/\r?\n/)
  const lastLine = lines[lines.length - 1]?.trim()
  if (lastLine && (lastLine.startsWith('{') || lastLine.startsWith('['))) {
    try {
      JSON.parse(lastLine)
      lines.pop()
      s = lines.join('\n').trim()
    } catch {
      // 不是有效 JSON，忽略
    }
  }
  // 按题目边界分割：1. / 1、/ ## 1 / 【1】/ 题目1
  const parts = s.split(/(?=\n(?:\d+[\.、．]\s|##\s*\d+[\.、．]?\s|【\d+】\s|题目\d+[：:]\s))/)
  const questions: ParsedQuestion[] = []
  let lastPartial = ''
  for (let i = 0; i < parts.length; i++) {
    const block = (parts[i] ?? '').trim()
    if (!block) continue
    const blockLines = block.split(/\r?\n/).filter((l) => l.trim())
    if (blockLines.length === 0) continue
    const firstLine = blockLines[0] ?? ''
    const stem = firstLine.replace(/^(?:\d+[\.、．]\s?|##\s*\d+[\.、．]?\s?|【\d+】\s?|题目\d+[：:]\s?)/, '').trim()
    const options: Record<string, string> = {}
    for (let j = 1; j < blockLines.length; j++) {
      const line = blockLines[j] ?? ''
      const optMatch = line.match(/^([A-D])[\.、．]\s*(.+)$/)
      if (optMatch && optMatch[1] && optMatch[2]) {
        options[optMatch[1]] = optMatch[2].trim()
      }
    }
    if (stem || Object.keys(options).length > 0) {
      questions.push({
        index: questions.length + 1,
        stem: stem || '(题干解析中…)',
        options: Object.keys(options).length ? options : undefined,
      })
      lastPartial = ''
    } else {
      lastPartial = block
    }
  }
  return { questions, partial: lastPartial || undefined }
}

const parsedPreview = computed(() => parseQuestionsFromStream(previewContent.value))

/** 获取用于生成的 content：文本流用输入/编辑内容，文件流用分析结果 */
const getContentForGenerate = () => {
  if (isFileFlow.value && fileAnalyzeResult.value) {
    return fileAnalyzeResult.value.content
  }
  if (isEditingConfirm.value && editableConfirmContent.value.trim()) {
    return editableConfirmContent.value.trim()
  }
  return inputText.value.trim()
}

/** 获取用于生成的参数（优先使用后端返回的确认数据） */
const getParamsForGenerate = () => {
  const d = confirmData.value
  const title = isFileFlow.value ? (fileTitleEdit.value.trim() || fileAnalyzeResult.value?.title || null) : null
  return {
    content: getContentForGenerate(),
    title,
    questionType: d?.questionType ?? selectedType.value,
    difficulty: d?.difficulty ?? selectedDifficulty.value,
    count: d?.count ?? count.value,
  }
}

/** 执行文件分析并进入确认 */
const runFileAnalyze = async (file: File) => {
  panelMode.value = 'wait_confirm'
  confirmData.value = null
  fileAnalyzeResult.value = null
  usageAnalyze.value = null
  isFileFlow.value = true
  isEditingConfirm.value = false
  confirmLoading.value = true
  try {
    const res = await analyzeFile(file)
    fileAnalyzeResult.value = { content: res.content, title: res.title }
    fileTitleEdit.value = res.title
    usageAnalyze.value = res.usage ?? null
    const typeLabel = questionTypeOptions.find((o) => o.value === selectedType.value)?.label ?? '单选题'
    const diffLabel = difficultyOptions.find((o) => o.value === selectedDifficulty.value)?.label ?? '中等'
    confirmData.value = {
      keyPoints: ['材料内容见下方'],
      questionType: selectedType.value,
      questionTypeLabel: typeLabel,
      difficulty: selectedDifficulty.value,
      difficultyLabel: diffLabel,
      count: count.value,
    }
  } catch {
    panelMessage.value = '文件分析失败，请稍后重试。'
    panelMode.value = 'message'
    isFileFlow.value = false
  } finally {
    confirmLoading.value = false
  }
}

/** 资料库出题：获取文件后分析 */
const handleFileFromDocLib = async () => {
  const docId = selectedDocId.value
  if (!docId) return
  const doc = docList.value.find((d) => d.docId === docId)
  const fileName = doc?.fileName || docId
  displayedFileTitle.value = fileName
  try {
    const blob = await getDocFile(docId)
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
    await runFileAnalyze(file)
  } catch {
    panelMessage.value = '获取文件失败，请稍后重试。'
    panelMode.value = 'message'
  }
}

/** 文本出题：调用分析接口 */
const handleTextAnalyze = async (useAnalyzeApi = true) => {
  const text = inputText.value.trim()
  if (!text) {
    panelMode.value = 'message'
    panelMessage.value = '请输入文字材料，或选择/上传文件后点击出题。'
    return
  }
  panelMode.value = 'wait_confirm'
  confirmData.value = null
  fileAnalyzeResult.value = null
  usageAnalyze.value = null
  isFileFlow.value = false
  isEditingConfirm.value = false

  if (!useAnalyzeApi) {
    const typeLabel = questionTypeOptions.find((o) => o.value === selectedType.value)?.label ?? '单选题'
    const diffLabel = difficultyOptions.find((o) => o.value === selectedDifficulty.value)?.label ?? '中等'
    confirmData.value = {
      keyPoints: [
        '材料主题：' + (text.slice(0, 30) + (text.length > 30 ? '…' : '')),
        '题型：' + typeLabel,
        '难度：' + diffLabel,
        '数量：' + count.value + ' 道',
      ],
      questionType: selectedType.value,
      questionTypeLabel: typeLabel,
      difficulty: selectedDifficulty.value,
      difficultyLabel: diffLabel,
      count: count.value,
    }
    editableConfirmContent.value = confirmData.value.keyPoints.join('\n')
    return
  }

  confirmLoading.value = true
  try {
    const res = await analyzeForConfirm({
      content: text,
      questionType: selectedType.value,
      difficulty: selectedDifficulty.value,
      count: count.value,
    })
    const typeLabel = res.questionTypeLabel ?? questionTypeOptions.find((o) => o.value === (res.questionType ?? selectedType.value))?.label ?? '单选题'
    const diffLabel = res.difficultyLabel ?? difficultyOptions.find((o) => o.value === (res.difficulty ?? selectedDifficulty.value))?.label ?? '中等'
    confirmData.value = {
      keyPoints: res.keyPoints?.length ? res.keyPoints : [
        '材料主题：' + (text.slice(0, 30) + (text.length > 30 ? '…' : '')),
        '题型：' + typeLabel,
        '难度：' + diffLabel,
        '数量：' + (res.count ?? count.value) + ' 道',
      ],
      questionType: res.questionType ?? selectedType.value,
      questionTypeLabel: typeLabel,
      difficulty: res.difficulty ?? selectedDifficulty.value,
      difficultyLabel: diffLabel,
      count: res.count ?? count.value,
    }
    editableConfirmContent.value = confirmData.value.keyPoints.join('\n')
    usageAnalyze.value = res.usage ?? null
  } catch {
    panelMessage.value = '获取确认信息失败，请稍后重试。'
    panelMode.value = 'message'
  } finally {
    confirmLoading.value = false
  }
}

/** 统一出题入口：根据是否有文件走不同逻辑 */
const handleAiGenerate = async (useAnalyzeApi = true) => {
  const hasFile = (uploadMode.value === 'upload' && selectedFile.value) || (uploadMode.value === 'doc_lib' && selectedDocId.value)
  if (hasFile) {
    if (uploadMode.value === 'upload') {
      await runFileAnalyze(selectedFile.value!)
    } else {
      await handleFileFromDocLib()
    }
    return
  }
  await handleTextAnalyze(useAnalyzeApi)
}

const handleConfirm = () => {
  panelMode.value = 'preview'
  previewContent.value = ''
  generatedExerciseId.value = ''
  usageGenerate.value = null
  streaming.value = true
  const params = getParamsForGenerate()
  generateExerciseStreamFromText(params, {
    onChunk: (text) => {
      previewContent.value += text
    },
    onDone: (exerciseId, usage) => {
      streaming.value = false
      generatedExerciseId.value = exerciseId || ''
      usageGenerate.value = usage ?? null
    },
    onError: (err) => {
      streaming.value = false
      panelMessage.value = '题目生成失败，请重试。'
      panelMode.value = 'message'
      ElMessage.error(err?.message || '题目生成失败，请重试。')
    },
  })
}

const handleEdit = () => {
  if (isEditingConfirm.value) {
    isEditingConfirm.value = false
    return
  }
  isEditingConfirm.value = true
  editableConfirmContent.value = confirmData.value?.keyPoints?.join('\n') ?? editableConfirmContent.value
}

const handleGoToDetail = () => {
  if (generatedExerciseId.value) {
    router.push(`/exercises/${generatedExerciseId.value}`)
  } else {
    router.push('/exercises')
  }
}

// 一键生成：应用预设后直接展示本地确认信息，不请求分析接口
const applyPreset = (preset: (typeof dashboardPresets)[number]) => {
  inputText.value = preset.content
  if (preset.type) selectedType.value = preset.type
  if (preset.difficulty) selectedDifficulty.value = preset.difficulty
  if (preset.count != null) count.value = Math.min(maxCount, Math.max(minCount, preset.count))
  handleAiGenerate(false)
}

// 上传：校验
const beforeFileSelect = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allow = ['pdf', 'docx', 'pptx', 'txt']
  if (!ext || !allow.includes(ext)) {
    ElMessage.error('仅支持 pdf / docx / pptx / txt')
    return false
  }
  return true
}

// 选择文件：仅存储并显示标题，不跳转
const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!beforeFileSelect(file)) {
    target.value = ''
    return
  }
  selectedFile.value = file
  displayedFileTitle.value = file.name
  target.value = ''
}

const triggerUpload = () => fileInputRef.value?.click()

watch(uploadMode, (mode) => {
  selectedFile.value = null
  displayedFileTitle.value = ''
  if (mode === 'doc_lib') loadDocList()
})
watch(selectedDocId, (id) => {
  if (uploadMode.value === 'doc_lib' && id) {
    const doc = docList.value.find((d) => d.docId === id)
    displayedFileTitle.value = doc?.fileName || id
  }
})
onMounted(() => {
  if (uploadMode.value === 'doc_lib') loadDocList()
})
</script>

<template>
  <div class="page dashboard-page">
    <!-- 顶部：标题 + 上传入口 -->
    <div class="top-bar">
      <h1 class="page-title">出题中心</h1>
      <div class="upload-entry">
        <el-select
          v-model="uploadMode"
          size="default"
          class="upload-mode-select"
          style="width: 140px"
        >
          <el-option value="doc_lib" label="资料库出题" />
          <el-option value="upload" label="上传文件" />
        </el-select>
        <!-- 资料库出题：选择资料 -->
        <template v-if="uploadMode === 'doc_lib'">
          <el-select
            v-model="selectedDocId"
            placeholder="选择资料"
            size="default"
            :loading="docListLoading"
            filterable
            style="width: 200px"
          >
            <el-option
              v-for="d in docList"
              :key="d.docId"
              :value="d.docId"
              :label="d.fileName || d.docId"
            />
          </el-select>
          <el-button
            type="primary"
            size="default"
            :loading="confirmLoading"
            :disabled="!selectedDocId"
            @click="handleFileFromDocLib"
          >
            用此资料出题
          </el-button>
        </template>
        <!-- 上传文件：选择文件 + 保存到资料库 -->
        <template v-else>
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,.docx,.pptx,.txt"
            class="file-input"
            @change="onFileSelected"
          />
          <el-button
            size="default"
            class="upload-btn"
            @click="triggerUpload"
          >
            <el-icon><UploadFilled /></el-icon>
            选择文件出题
          </el-button>
        </template>
        <span class="upload-hint">支持 pdf / docx / pptx / txt</span>
        <span v-if="displayedFileTitle" class="file-title-display">当前：{{ displayedFileTitle }}</span>
      </div>
    </div>

    <!-- 主内容区：输入 + 控制 + 面板 -->
    <div class="main-card">
      <div class="input-row">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="4"
          placeholder="输入文字材料或指令，AI 将根据内容出题…"
          maxlength="1000"
          show-word-limit
          class="main-textarea"
        />
      </div>

      <!-- 一键生成预设（暂时隐藏） -->
      <div v-if="false" class="preset-row">
        <span class="preset-label">一键生成</span>
        <div class="preset-btns">
          <el-button
            v-for="p in dashboardPresets"
            :key="p.id"
            size="small"
            plain
            class="preset-btn"
            @click="applyPreset(p)"
          >
            {{ p.title }}
          </el-button>
        </div>
      </div>

      <div class="control-row">
        <div class="control-group">
          <span class="control-label">题型</span>
          <el-radio-group v-model="selectedType" class="radio-group type-group">
            <el-radio-button
              v-for="opt in questionTypeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="control-group">
          <span class="control-label">难度</span>
          <el-radio-group v-model="selectedDifficulty" class="radio-group">
            <el-radio-button
              v-for="opt in difficultyOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="control-group count-group">
          <span class="control-label">数量</span>
          <el-input-number
            v-model="count"
            :min="minCount"
            :max="maxCount"
            controls-position="right"
            size="default"
            class="count-input"
          />
          <span class="count-unit">道</span>
        </div>
        <el-button type="primary" size="large" class="ai-btn" @click="handleAiGenerate">
          AI 出题
        </el-button>
      </div>

      <!-- 动态面板：固定高度 -->
      <div class="panel-wrap">
        <div class="dynamic-panel" :class="panelMode">
          <div v-if="panelMode === 'message'" class="panel-message">
            <p class="panel-text">{{ panelMessage }}</p>
          </div>
          <div v-else-if="panelMode === 'wait_confirm'" class="panel-wait-confirm">
            <template v-if="confirmLoading">
              <div class="panel-loading-hint">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>正在分析材料，请稍候…</span>
              </div>
            </template>
            <template v-else-if="isEditingConfirm">
              <div class="panel-edit-area">
                <div class="panel-edit-label">可修改下方内容后点击「确认」生成：</div>
                <el-input
                  v-model="editableConfirmContent"
                  type="textarea"
                  :rows="12"
                  placeholder="编辑确认内容…"
                  class="panel-edit-input"
                />
              </div>
            </template>
            <template v-else-if="confirmData || fileAnalyzeResult">
              <div class="confirm-info">
                <!-- 文件流：显示可编辑标题与材料内容 -->
                <template v-if="isFileFlow && fileAnalyzeResult">
                  <div class="confirm-row">
                    <span class="confirm-label">试卷标题</span>
                    <el-input v-model="fileTitleEdit" placeholder="建议标题" size="default" class="title-edit-input" />
                  </div>
                  <div class="confirm-section">
                    <span class="confirm-label">材料内容</span>
                    <div class="content-preview">{{ fileAnalyzeResult.content }}</div>
                  </div>
                </template>
                <!-- 文本流：显示要点 -->
                <template v-else-if="confirmData">
                  <div class="confirm-row">
                    <span class="confirm-label">题型</span>
                    <span class="confirm-value">{{ confirmData.questionTypeLabel }}</span>
                  </div>
                  <div class="confirm-row">
                    <span class="confirm-label">难度</span>
                    <span class="confirm-value">{{ confirmData.difficultyLabel }}</span>
                  </div>
                  <div class="confirm-row">
                    <span class="confirm-label">数量</span>
                    <span class="confirm-value">{{ confirmData.count }} 道</span>
                  </div>
                  <div class="confirm-section">
                    <span class="confirm-label">要点</span>
                    <ul class="confirm-key-points">
                      <li v-for="(point, i) in confirmData.keyPoints" :key="i">{{ point }}</li>
                    </ul>
                  </div>
                </template>
                <!-- 文件流时也显示题型/难度/数量 -->
                <template v-if="isFileFlow && confirmData">
                  <div class="confirm-row">
                    <span class="confirm-label">题型</span>
                    <span class="confirm-value">{{ confirmData.questionTypeLabel }}</span>
                  </div>
                  <div class="confirm-row">
                    <span class="confirm-label">难度</span>
                    <span class="confirm-value">{{ confirmData.difficultyLabel }}</span>
                  </div>
                  <div class="confirm-row">
                    <span class="confirm-label">数量</span>
                    <span class="confirm-value">{{ confirmData.count }} 道</span>
                  </div>
                </template>
                <div v-if="usageAnalyze" class="usage-row">
                  <span class="usage-label">本次分析 Token 消耗</span>
                  <span class="usage-value">输入 {{ usageAnalyze.inputTokens }} · 输出 {{ usageAnalyze.outputTokens }} · 共计 {{ usageAnalyze.totalTokens }}</span>
                </div>
              </div>
            </template>
            <div class="panel-actions">
              <el-button type="primary" :loading="confirmLoading" :disabled="confirmLoading" @click="handleConfirm">确认</el-button>
              <el-button v-if="!isFileFlow" :disabled="confirmLoading" @click="handleEdit">{{ isEditingConfirm ? '取消' : '修改' }}</el-button>
            </div>
          </div>
          <div v-else-if="panelMode === 'preview'" class="panel-preview">
            <div v-if="streaming" class="panel-streaming-hint">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在生成题目… 已解析 {{ parsedPreview.questions.length }} 题</span>
            </div>
            <div class="preview-questions">
              <div
                v-for="q in parsedPreview.questions"
                :key="q.index"
                class="question-card"
              >
                <div class="question-stem">{{ q.index }}. {{ q.stem }}</div>
                <div v-if="q.options && Object.keys(q.options).length" class="question-options">
                  <div
                    v-for="(val, key) in q.options"
                    :key="key"
                    class="option-row"
                  >
                    {{ key }}. {{ val }}
                  </div>
                </div>
              </div>
              <div v-if="streaming && parsedPreview.partial" class="question-card partial">
                <div class="question-stem">解析中…</div>
                <pre class="partial-raw">{{ parsedPreview.partial }}</pre>
              </div>
              <div v-else-if="streaming && previewContent && !parsedPreview.questions.length" class="question-card partial">
                <div class="question-stem">解析中…</div>
                <pre class="partial-raw">{{ previewContent.slice(0, 300) }}{{ previewContent.length > 300 ? '…' : '' }}</pre>
              </div>
            </div>
            <div v-if="!streaming && usageGenerate" class="usage-row">
              <span class="usage-label">本次生成 Token 消耗</span>
              <span class="usage-value">输入 {{ usageGenerate.inputTokens }} · 输出 {{ usageGenerate.outputTokens }} · 共计 {{ usageGenerate.totalTokens }}</span>
            </div>
            <el-button type="primary" class="full-btn" :disabled="streaming" @click="handleGoToDetail">
              {{ streaming ? '生成中，请稍候…' : '查看全部题目' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 32px;
  min-height: calc(100vh - 120px);
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: nowrap;
  min-width: 0;
}
.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1f2329;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}
.upload-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  flex-shrink: 0;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}
.upload-entry .upload-mode-select,
.upload-entry .el-select,
.upload-entry .el-button,
.upload-entry .el-checkbox {
  flex-shrink: 0;
}
.file-input {
  display: none;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.save-checkbox {
  margin-left: 4px;
}
.upload-hint {
  font-size: 12px;
  color: #8c8c8c;
  flex-shrink: 0;
}

.main-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #ebeef5;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
}
.input-row {
  width: 100%;
}
.main-textarea :deep(.el-textarea__inner) {
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
  border-color: #e4e7ed;
}
.main-textarea :deep(.el-textarea__inner):focus {
  border-color: var(--lumist-secondary);
  box-shadow: 0 0 0 2px rgba(var(--lumist-secondary-rgb), 0.15);
}

.preset-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.preset-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  flex-shrink: 0;
}
.preset-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.preset-btn {
  font-size: 13px;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 24px;
}
.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.control-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  flex-shrink: 0;
}
.radio-group :deep(.el-radio-button__inner) {
  padding: 6px 14px;
  font-size: 13px;
}
.type-group {
  flex-wrap: wrap;
}
.count-group {
  gap: 8px;
}
.count-input {
  width: 100px;
}
.count-input :deep(.el-input__inner) {
  text-align: center;
}
.count-unit {
  font-size: 13px;
  color: #606266;
}
.ai-btn {
  min-width: 120px;
  height: 40px;
  font-size: 15px;
  margin-left: auto;
}

.panel-wrap {
  flex-shrink: 0;
  height: 360px;
  display: flex;
  flex-direction: column;
}
.dynamic-panel {
  height: 100%;
  border-radius: 8px;
  background: #fafbfc;
  border: 1px dashed #e4e7ed;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dynamic-panel.message .panel-message {
  flex: 1;
  display: flex;
  align-items: center;
  overflow-y: auto;
}
.dynamic-panel.message .panel-text {
  margin: 0;
  color: #8c8c8c;
  font-size: 14px;
  line-height: 1.7;
}
.panel-wait-confirm {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}
.confirm-info {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}
.confirm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 14px;
}
.confirm-label {
  flex-shrink: 0;
  width: 56px;
  color: #606266;
  font-weight: 500;
}
.confirm-value {
  color: #303133;
}
.confirm-section {
  margin-top: 12px;
}
.confirm-section .confirm-label {
  display: block;
  margin-bottom: 8px;
}
.confirm-key-points {
  margin: 0;
  padding-left: 20px;
  color: #303133;
  line-height: 1.9;
  font-size: 14px;
}
.title-edit-input {
  flex: 1;
  max-width: 300px;
}
.content-preview {
  max-height: 120px;
  overflow-y: auto;
  padding: 8px 0;
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
  white-space: pre-wrap;
}
.file-title-display {
  font-size: 13px;
  color: #606266;
  margin-left: 8px;
}
.usage-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  font-size: 13px;
}
.usage-label {
  color: #909399;
  margin-right: 8px;
}
.usage-value {
  color: #606266;
}
.panel-edit-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}
.panel-edit-label {
  flex-shrink: 0;
  font-size: 13px;
  color: #606266;
}
.panel-edit-input {
  flex: 1;
  min-height: 0;
}
.panel-edit-input :deep(.el-textarea__inner) {
  height: 100% !important;
  min-height: 160px;
}
.panel-wait-confirm .panel-actions {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
}
.panel-loading-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #606266;
  font-size: 14px;
}
.panel-loading-hint .el-icon {
  font-size: 18px;
}
.panel-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}
.panel-streaming-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #606266;
  font-size: 13px;
  flex-shrink: 0;
}
.panel-streaming-hint .el-icon {
  font-size: 16px;
}
.preview-questions {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
.question-card {
  padding: 12px 14px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  font-size: 14px;
}
.question-card.partial {
  background: #fafbfc;
  border-style: dashed;
}
.question-stem {
  font-weight: 500;
  color: #303133;
  line-height: 1.6;
  margin-bottom: 8px;
}
.question-options {
  margin-top: 8px;
  padding-left: 4px;
}
.option-row {
  padding: 4px 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}
.partial-raw {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.panel-preview .usage-row {
  flex-shrink: 0;
}
.panel-preview .full-btn {
  width: 100%;
  height: 42px;
  flex-shrink: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .upload-entry {
    width: 100%;
  }
  .preset-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .preset-btns {
    width: 100%;
  }
  .control-row {
    flex-direction: column;
    align-items: stretch;
  }
  .ai-btn {
    margin-left: 0;
  }
  .radio-group :deep(.el-radio-button) {
    margin-bottom: 4px;
  }
}
</style>
