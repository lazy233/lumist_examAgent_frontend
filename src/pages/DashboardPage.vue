<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { CircleCheck, Loading, UploadFilled } from '@element-plus/icons-vue'
import { getDocsList, startParse, uploadDoc } from '../services/docs'
import type { DocListItem, DocParsed } from '../services/docs'
import { dashboardPresets } from '../config/dashboardPresets'
import type { UsageInfo } from '../services/exercises'
import { analyzeForConfirm, generateExerciseStreamFromText } from '../services/exercises'

const router = useRouter()
const fileInputRef = ref<HTMLInputElement | null>(null)

const docList = ref<DocListItem[]>([])
const docListLoading = ref(false)
const selectedDocId = ref('')

/** 用户选择的文件（本地上传） */
const selectedFile = ref<File | null>(null)
/** 当前显示的文件标题（上传文件名 或 资料库选中的文档名） */
const displayedFileTitle = ref('')
const isDragOver = ref(false)

/** 是否已有文件/资料可出题 */
const hasFileSource = computed(() => !!selectedFile.value || !!selectedDocId.value)

const loadDocList = async () => {
  docListLoading.value = true
  try {
    const res = await getDocsList({ pageSize: 100 })
    docList.value = res.items ?? []
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
/** 文件解析流式状态 */
const fileParseStatusText = ref('')
const fileParseLogs = ref<string[]>([])
let currentParseAbort: { abort: () => void } | null = null

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
const count = ref(1)
const minCount = 1
const maxCount = 50
const incrementCount = () => {
  if (count.value < maxCount) count.value++
}
defineExpose({ incrementCount })

// 动态交互面板
type PanelMode = 'message' | 'wait_confirm' | 'preview'
const panelMode = ref<PanelMode>('message')
const panelMessage = ref('输入文字材料后点击「AI 出题」，或选择/上传文件后出题。')
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
  const keyPoints = d?.keyPoints ?? []
  const analysis = isFileFlow.value ? '' : (editableConfirmContent.value.trim() || d?.keyPoints?.join('\n') || '')
  return {
    content: getContentForGenerate(),
    title,
    questionType: d?.questionType ?? selectedType.value,
    difficulty: d?.difficulty ?? selectedDifficulty.value,
    count: d?.count ?? count.value,
    keyPoints,
    analysis,
  }
}

const resetFileParseStream = () => {
  fileParseStatusText.value = ''
  fileParseLogs.value = []
}

const buildParsedContent = (parsed: DocParsed) => {
  const sections: string[] = []
  const info: string[] = []
  if (parsed.school) info.push(`学校：${parsed.school}`)
  if (parsed.major) info.push(`专业：${parsed.major}`)
  if (parsed.course) info.push(`课程：${parsed.course}`)
  if (info.length) sections.push(info.join(' / '))
  if (parsed.summary) sections.push(`摘要：\n${parsed.summary}`)
  if (parsed.knowledgePoints?.length) {
    sections.push(`知识点：\n- ${parsed.knowledgePoints.join('\n- ')}`)
  }
  return sections.join('\n\n')
}

/** 执行资料解析（SSE）并进入确认 */
const runDocParseStream = async (docId: string, fileName: string) => {
  panelMode.value = 'wait_confirm'
  confirmData.value = null
  fileAnalyzeResult.value = null
  usageAnalyze.value = null
  isFileFlow.value = true
  isEditingConfirm.value = false
  confirmLoading.value = true
  resetFileParseStream()

  if (currentParseAbort) currentParseAbort.abort()
  fileParseStatusText.value = '正在解析材料，请稍候…'

  const typeLabel = questionTypeOptions.find((o) => o.value === selectedType.value)?.label ?? '单选题'
  const diffLabel = difficultyOptions.find((o) => o.value === selectedDifficulty.value)?.label ?? '中等'

  const parseTask = startParse(docId, {
    onStatus: (data) => {
      fileParseStatusText.value = '解析开始…'
      fileParseLogs.value = [...fileParseLogs.value, `状态：${data.status}`]
    },
    onProgress: (data) => {
      fileParseStatusText.value = `处理中：${data.stage}`
      fileParseLogs.value = [...fileParseLogs.value, `阶段：${data.stage}`]
    },
    onChunk: (data) => {
      if (!fileAnalyzeResult.value) {
        fileAnalyzeResult.value = { content: '', title: fileName }
      }
      fileAnalyzeResult.value.content += data.content || ''
    },
    onResult: (data) => {
      const content = buildParsedContent(data.parsed)
      fileAnalyzeResult.value = { content, title: fileName }
      fileTitleEdit.value = data.parsed.course || fileName
      confirmData.value = {
        keyPoints: ['材料内容见下方'],
        questionType: selectedType.value,
        questionTypeLabel: typeLabel,
        difficulty: selectedDifficulty.value,
        difficultyLabel: diffLabel,
        count: count.value,
      }
      confirmLoading.value = false
    },
    onError: (data) => {
      panelMessage.value = data.detail || '文件解析失败，请稍后重试。'
      panelMode.value = 'message'
      isFileFlow.value = false
      confirmLoading.value = false
    },
    onClose: () => {
      if (confirmLoading.value) {
        confirmLoading.value = false
      }
    },
  })
  currentParseAbort = parseTask
  try {
    await parseTask.done
  } catch {
    if (confirmLoading.value) {
      panelMessage.value = '文件解析失败，请稍后重试。'
      panelMode.value = 'message'
      isFileFlow.value = false
      confirmLoading.value = false
    }
  }
}

/** 上传文件出题：先上传，后 SSE 解析 */
const handleFileFromUpload = async () => {
  const file = selectedFile.value
  if (!file) return
  try {
    panelMode.value = 'wait_confirm'
    confirmData.value = null
    fileAnalyzeResult.value = null
    usageAnalyze.value = null
    isFileFlow.value = true
    isEditingConfirm.value = false
    confirmLoading.value = true
    resetFileParseStream()
    fileParseStatusText.value = '正在上传文件…'
    const res = await uploadDoc(file, { saveToLibrary: false })
    const fileName = res.fileName || file.name
    displayedFileTitle.value = fileName
    await runDocParseStream(res.docId, fileName)
  } catch {
    panelMessage.value = '文件上传失败，请稍后重试。'
    panelMode.value = 'message'
    isFileFlow.value = false
    confirmLoading.value = false
  }
}

/** 资料库出题：SSE 解析 */
const handleFileFromDocLib = async () => {
  const docId = selectedDocId.value
  if (!docId) return
  const doc = docList.value.find((d) => d.docId === docId)
  const fileName = doc?.fileName || docId
  displayedFileTitle.value = fileName
  await runDocParseStream(docId, fileName)
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
  resetFileParseStream()

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
  if (hasFileSource.value) {
    if (selectedFile.value) {
      await handleFileFromUpload()
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

// 选择文件：仅存储并显示标题，不跳转；选择文件时清空资料库选择
const applySelectedFile = (file: File) => {
  if (!beforeFileSelect(file)) return
  selectedDocId.value = ''
  selectedFile.value = file
  displayedFileTitle.value = file.name
}

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  applySelectedFile(file)
  target.value = ''
}

const onDropFile = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) applySelectedFile(file)
}

const triggerUpload = () => fileInputRef.value?.click()

/** 格式化文件大小显示 */
const formatFileSize = (file: File): string => {
  const n = file.size
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

/** 获取文件扩展名（用于展示） */
const getFileExt = (file: File): string => {
  const ext = file.name.split('.').pop()?.toUpperCase() ?? ''
  return ext ? `.${ext}` : ''
}

/** 清除已选文件 */
const clearSelectedFile = () => {
  selectedFile.value = null
  displayedFileTitle.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

/** 清除已选资料 */
const clearSelectedDoc = () => {
  selectedDocId.value = ''
  displayedFileTitle.value = ''
}

/** 替换为上传文件：清空资料，触发文件选择 */
const replaceWithUpload = () => {
  clearSelectedDoc()
  triggerUpload()
}

watch(selectedDocId, (id) => {
  if (id) {
    selectedFile.value = null
    const doc = docList.value.find((d) => d.docId === id)
    displayedFileTitle.value = doc?.fileName || id
  } else {
    displayedFileTitle.value = ''
  }
})
onMounted(() => {
  loadDocList()
})
</script>

<template>
  <div class="page dashboard-page">
    <!-- 顶部：标题 + 资料库选择 -->
    <div class="top-bar">
      <h1 class="page-title">出题中心</h1>
      <div class="top-actions">
        <span class="top-actions-label">资料库</span>
        <el-select
          v-model="selectedDocId"
          placeholder="选择资料"
          size="default"
          :loading="docListLoading"
          filterable
          class="top-doc-select"
        >
          <el-option
            v-for="d in docList"
            :key="d.docId"
            :value="d.docId"
            :label="d.fileName || d.docId"
          />
        </el-select>
      </div>
    </div>

    <!-- 统一卡片：上传文件 + 资料库选择 -->
    <el-card class="upload-card" shadow="never">
      <input
        ref="fileInputRef"
        type="file"
        accept=".pdf,.docx,.pptx,.txt"
        class="file-input"
        @change="onFileSelected"
      />
      <!-- 未选择：大框上传 -->
      <div v-if="!hasFileSource" class="upload-zone-wrap">
        <div
          class="upload-zone upload-zone--empty"
          :class="{ 'is-dragover': isDragOver }"
          @click="triggerUpload"
          @dragenter.prevent="isDragOver = true"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop="onDropFile"
        >
          <el-icon class="upload-zone-icon"><UploadFilled /></el-icon>
          <div class="upload-zone-text">点击选择文件</div>
          <div class="upload-zone-hint-row">
            <span class="upload-zone-hint">支持 pdf / docx / pptx / txt</span>
            <span class="upload-zone-hint-secondary">也可从右上角资料库选择</span>
          </div>
        </div>
      </div>
      <!-- 已选择：统一的文件/资料展示区块 -->
      <div v-else class="upload-file-block">
        <div v-if="confirmLoading" class="upload-file-analyzing">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在分析材料…</span>
        </div>
        <div class="upload-file-header">
          <el-icon class="upload-file-status-icon success"><CircleCheck /></el-icon>
          <span>当前已选文件</span>
        </div>
        <div class="upload-file-meta">
          <template v-if="selectedFile">
            <span class="upload-file-name">{{ displayedFileTitle }}</span>
            <span class="upload-file-type">{{ getFileExt(selectedFile) }}</span>
            <span class="upload-file-size">{{ formatFileSize(selectedFile) }}</span>
          </template>
          <template v-else>
            <span class="upload-file-name">{{ displayedFileTitle }}</span>
            <span class="upload-file-type">资料库</span>
          </template>
          <span class="upload-file-badge success">已就绪</span>
        </div>
        <div class="upload-file-actions">
          <el-button size="small" @click="selectedFile ? triggerUpload() : replaceWithUpload()">
            {{ selectedFile ? '替换文件' : '替换为上传文件' }}
          </el-button>
          <el-button size="small" type="danger" plain @click="selectedFile ? clearSelectedFile() : clearSelectedDoc()">
            {{ selectedFile ? '删除文件' : '清空选择' }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 主内容区：输入 + 控制 + 面板 -->
    <div class="main-card">
      <div class="input-row">
        <div class="input-card">
          <div class="input-card-header">
            <span class="input-card-title">题目输入</span>
            <span class="input-card-tip">支持粘贴文本或指令</span>
          </div>
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
        <el-button
          type="primary"
          size="large"
          class="ai-btn"
          :disabled="confirmLoading"
          @click="handleAiGenerate"
        >
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
                <span>{{ fileParseStatusText || '正在分析材料，请稍候…' }}</span>
              </div>
              <div v-if="fileParseLogs.length" class="panel-stream-log">
                <div class="panel-stream-log-title">解析进度</div>
                <pre class="panel-stream-text">{{ fileParseLogs.join('\n') }}</pre>
              </div>
              <div v-if="isFileFlow && fileAnalyzeResult?.content" class="panel-stream-preview">
                <div class="panel-stream-header">
                  <span class="panel-stream-dot" />
                  <span class="panel-stream-title">实时解析内容</span>
                </div>
                <div class="panel-stream-content">{{ fileAnalyzeResult.content }}</div>
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
.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.top-actions-label {
  font-size: 13px;
  color: #606266;
}
.top-doc-select {
  width: 220px;
}
.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1f2329;
  letter-spacing: -0.02em;
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

/* 卡片式上传组件（仅上传模式） */
.upload-card {
  border-radius: 12px;
  border: 1px solid #ebeef5;
  overflow: hidden;
}
.upload-card :deep(.el-card__body) {
  padding: 10px 12px;
  min-height: 120px;
}
.upload-zone {
  padding: 4px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.upload-zone--empty {
  border: 2px dashed #dcdfe6;
  border-radius: 10px;
  margin: 16px;
  background: #fafbfc;
}
.upload-zone--empty:hover {
  border-color: var(--el-color-primary-light-5);
  background: #f0f9ff;
}
.upload-zone--empty.is-dragover {
  border-color: var(--el-color-primary);
  background: #eef7ff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
}
.upload-zone-icon {
  font-size: 36px;
  color: #c0c4cc;
  margin-bottom: 0;
  display: block;
}
.upload-zone--empty:hover .upload-zone-icon {
  color: var(--el-color-primary);
}
.upload-zone-text {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 0;
  line-height: 1.3;
}
.upload-zone-hint-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 12px;
  font-size: 12px;
  color: #909399;
  line-height: 1.3;
}
.upload-zone-hint {
  color: #909399;
}
.upload-zone-hint-secondary {
  color: #909399;
}
.upload-zone-wrap {
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  height: 100%;
}
.upload-zone-wrap .upload-zone--empty {
  margin: 0;
}
.upload-file-block {
  padding: 10px 12px;
  position: relative;
  background: linear-gradient(135deg, #f0f9ff 0%, #fff 100%);
  border-radius: 10px;
  margin: 0;
  border: 1px solid #d9ecff;
  height: 100%;
}
.upload-file-analyzing {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  color: #606266;
}
.upload-file-analyzing .el-icon.is-loading {
  font-size: 20px;
}
.upload-file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}
.upload-file-status-icon {
  font-size: 20px;
}
.upload-file-status-icon.success {
  color: #67c23a;
}
.upload-file-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 14px;
  font-size: 13px;
}
.upload-file-name {
  font-weight: 500;
  color: #303133;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-file-type,
.upload-file-size {
  color: #606266;
}
.upload-file-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.upload-file-badge.success {
  background: #e1f3d8;
  color: #67c23a;
}
.upload-file-actions {
  display: flex;
  gap: 10px;
}
.upload-block-hint {
  font-size: 13px;
  color: #e6a23c;
  font-weight: 500;
  margin-right: 12px;
}
.ai-btn--disabled-upload:not(:disabled) {
  opacity: 0.65;
}
.ai-btn:disabled {
  cursor: not-allowed;
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
.input-card {
  background: #f8fafc;
  border: 1px solid #e6ebf5;
  border-radius: 12px;
  padding: 12px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}
.input-card:focus-within {
  background: #fff;
  border-color: var(--lumist-secondary);
  box-shadow: 0 0 0 3px rgba(var(--lumist-secondary-rgb), 0.15);
}
.input-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.input-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.input-card-tip {
  font-size: 12px;
  color: #909399;
}
.main-textarea :deep(.el-textarea__inner) {
  border-radius: 8px;
  padding: 0;
  font-size: 14px;
  line-height: 1.6;
  border: none;
  box-shadow: none;
  background: transparent;
  resize: none;
}
.main-textarea :deep(.el-textarea__inner):focus {
  border-color: transparent;
  box-shadow: none;
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
  display: inline-block;
  margin-bottom: 8px;
  white-space: nowrap;
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
.panel-stream-log {
  margin-top: 10px;
  background: #f8f9fb;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 120px;
  overflow: auto;
}
.panel-stream-log-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.panel-stream-text {
  margin: 0;
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
}
.panel-stream-preview {
  margin-top: 10px;
  border: 1px solid #dfe7ff;
  background: linear-gradient(135deg, #f5f8ff 0%, #ffffff 60%);
  border-radius: 8px;
  padding: 12px 14px;
  max-height: 180px;
  overflow: auto;
}
.panel-stream-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.panel-stream-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
  animation: pulse 1.6s ease-in-out infinite;
}
.panel-stream-title {
  font-size: 12px;
  color: #4c6fff;
  font-weight: 600;
}
.panel-stream-content {
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
  white-space: pre-wrap;
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
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.2); opacity: 0.5; }
}

@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .top-actions {
    width: 100%;
  }
  .top-doc-select {
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
