<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { Loading, UploadFilled } from '@element-plus/icons-vue'
import { startParse, uploadDoc } from '../services/docs'
import { getDocsList } from '../services/docs'
import type { DocListItem } from '../services/docs'
import { dashboardPresets } from '../config/dashboardPresets'
import { analyzeForConfirm, generateExerciseStreamFromText } from '../services/exercises'

const router = useRouter()
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 文档出题方式：资料库出题 | 上传文件
const uploadMode = ref<'doc_lib' | 'upload'>('upload')
const docList = ref<DocListItem[]>([])
const docListLoading = ref(false)
const selectedDocId = ref('')
const saveToLibrary = ref(false)

const loadDocList = async () => {
  if (uploadMode.value !== 'doc_lib') return
  docListLoading.value = true
  try {
    const res = await getDocsList({ pageSize: 100 })
    docList.value = res.items ?? []
    if (docList.value.length && !selectedDocId.value) {
      selectedDocId.value = docList.value[0].docId
    }
  } catch {
    docList.value = []
  } finally {
    docListLoading.value = false
  }
}

const goToDocAndGenerate = () => {
  if (!selectedDocId.value) return
  router.push(`/docs/${selectedDocId.value}`)
}

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
const decrementCount = () => {
  if (count.value > minCount) count.value--
}
const incrementCount = () => {
  if (count.value < maxCount) count.value++
}
defineExpose({ incrementCount })

// 动态交互面板
type PanelMode = 'message' | 'wait_confirm' | 'preview'
const panelMode = ref<PanelMode>('message')
const panelMessage = ref('输入文字材料后点击「AI 出题」，或使用下方一键生成预设；也可用右上角上传文档。')
const keyPoints = ref<string[]>([])
const previewContent = ref('')
const confirmLoading = ref(false)
const streaming = ref(false)
const generatedExerciseId = ref('')
const MAX_DISPLAY_CHARS = 800

const displayContent = computed(() => {
  const s = previewContent.value
  if (!streaming.value || s.length <= MAX_DISPLAY_CHARS) return s
  return s.slice(0, MAX_DISPLAY_CHARS) + '…'
})

/** useAnalyzeApi: true = 调用后端分析接口；false = 预设生成，直接本地确认 */
const handleAiGenerate = async (useAnalyzeApi = true) => {
  const text = inputText.value.trim()
  if (!text) {
    panelMode.value = 'message'
    panelMessage.value = '请先输入文字材料或指令。'
    return
  }
  panelMode.value = 'wait_confirm'
  keyPoints.value = []

  if (!useAnalyzeApi) {
    // 预设生成：不请求分析接口，直接展示本地确认信息
    keyPoints.value = [
      '材料主题：' + (text.slice(0, 30) + (text.length > 30 ? '…' : '')),
      '题型：' + (questionTypeOptions.find((o) => o.value === selectedType.value)?.label ?? ''),
      '难度：' + (difficultyOptions.find((o) => o.value === selectedDifficulty.value)?.label ?? '中等'),
      '数量：' + count.value + ' 道',
    ]
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
    keyPoints.value = res.keyPoints?.length ? res.keyPoints : [
      '材料主题：' + (text.slice(0, 30) + (text.length > 30 ? '…' : '')),
      '题型：' + (questionTypeOptions.find((o) => o.value === selectedType.value)?.label ?? ''),
      '难度：' + (difficultyOptions.find((o) => o.value === selectedDifficulty.value)?.label ?? '中等'),
      '数量：' + count.value + ' 道',
    ]
  } catch {
    panelMessage.value = '获取确认信息失败，请稍后重试。'
    panelMode.value = 'message'
  } finally {
    confirmLoading.value = false
  }
}

const handleConfirm = () => {
  panelMode.value = 'preview'
  previewContent.value = ''
  generatedExerciseId.value = ''
  streaming.value = true
  generateExerciseStreamFromText(
    {
      content: inputText.value.trim(),
      questionType: selectedType.value,
      difficulty: selectedDifficulty.value,
      count: count.value,
    },
    {
      onChunk: (text) => {
        previewContent.value += text
      },
      onDone: (exerciseId) => {
        streaming.value = false
        generatedExerciseId.value = exerciseId || ''
      },
      onError: (err) => {
        streaming.value = false
        panelMessage.value = '题目生成失败，请重试。'
        panelMode.value = 'message'
        ElMessage.error(err?.message || '题目生成失败，请重试。')
      },
    }
  )
}

const handleEdit = () => {
  panelMode.value = 'message'
  panelMessage.value = '请修改上方输入后重新点击「AI出题」。'
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
const beforeUpload = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allow = ['pdf', 'docx', 'pptx', 'txt']
  if (!ext || !allow.includes(ext)) {
    ElMessage.error('仅支持 pdf / docx / pptx / txt')
    return false
  }
  return true
}

const handleUpload = async (options: UploadRequestOptions) => {
  try {
    uploading.value = true
    const data = await uploadDoc(options.file as File, { saveToLibrary: saveToLibrary.value })
    await startParse(data.docId)
    ElMessage.success(saveToLibrary.value ? '已保存到资料库，正在解析' : '上传成功，正在解析')
    options.onSuccess?.(data)
    router.push(`/docs/${data.docId}`)
  } catch (err) {
    ElMessage.error('上传失败，请重试')
    options.onError?.(err as never)
  } finally {
    uploading.value = false
  }
}

// 按钮触发的上传（隐藏 input）
const onFileSelected = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!beforeUpload(file)) {
    target.value = ''
    return
  }
  try {
    uploading.value = true
    const data = await uploadDoc(file, { saveToLibrary: saveToLibrary.value })
    await startParse(data.docId)
    ElMessage.success(saveToLibrary.value ? '已保存到资料库，正在解析' : '上传成功，正在解析')
    router.push(`/docs/${data.docId}`)
  } catch (err) {
    ElMessage.error('上传失败，请重试')
  } finally {
    uploading.value = false
    target.value = ''
  }
}

const triggerUpload = () => fileInputRef.value?.click()

watch(uploadMode, (mode) => {
  if (mode === 'doc_lib') loadDocList()
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
            :disabled="!selectedDocId"
            @click="goToDocAndGenerate"
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
            :loading="uploading"
            size="default"
            class="upload-btn"
            @click="triggerUpload"
          >
            <el-icon><UploadFilled /></el-icon>
            选择文件出题
          </el-button>
          <el-checkbox v-model="saveToLibrary" class="save-checkbox">
            保存本次文档到资料库
          </el-checkbox>
        </template>
        <span class="upload-hint">支持 pdf / docx / pptx / txt</span>
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

      <!-- 一键生成预设 -->
      <div class="preset-row">
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

      <!-- 动态面板：填充剩余空间 -->
      <div class="panel-wrap">
        <div class="dynamic-panel" :class="panelMode">
          <div v-if="panelMode === 'message'" class="panel-message">
            <p class="panel-text">{{ panelMessage }}</p>
          </div>
          <div v-else-if="panelMode === 'wait_confirm'" class="panel-wait-confirm">
            <ul v-if="!confirmLoading" class="key-points">
              <li v-for="(point, i) in keyPoints" :key="i">{{ point }}</li>
            </ul>
            <div v-else class="panel-loading-hint">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在分析材料，请稍候…</span>
            </div>
            <div class="panel-actions">
              <el-button type="primary" :loading="confirmLoading" :disabled="confirmLoading" @click="handleConfirm">✅ 确认</el-button>
              <el-button :disabled="confirmLoading" @click="handleEdit">✏️ 修改</el-button>
            </div>
          </div>
          <div v-else-if="panelMode === 'preview'" class="panel-preview">
            <div v-if="streaming" class="panel-streaming-hint">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在生成题目… 已显示前 {{ Math.min(previewContent.length, MAX_DISPLAY_CHARS) }} 字</span>
            </div>
            <pre class="preview-content">{{ displayContent }}</pre>
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
  flex: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}
.dynamic-panel {
  flex: 1;
  border-radius: 8px;
  background: #fafbfc;
  border: 1px dashed #e4e7ed;
  padding: 20px 24px;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.dynamic-panel.message .panel-message {
  flex: 1;
  display: flex;
  align-items: center;
}
.dynamic-panel.message .panel-text {
  margin: 0;
  color: #8c8c8c;
  font-size: 14px;
  line-height: 1.7;
}
.panel-wait-confirm {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-wait-confirm .key-points {
  margin: 0;
  padding-left: 20px;
  color: #303133;
  line-height: 1.9;
  font-size: 14px;
}
.panel-wait-confirm .panel-actions {
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
  display: flex;
  flex-direction: column;
  gap: 16px;
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
.panel-preview .preview-content {
  flex: 1;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
  margin: 0;
  min-height: 120px;
  overflow-y: auto;
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
