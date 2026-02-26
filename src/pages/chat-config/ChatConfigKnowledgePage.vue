<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Document, Search, Upload } from '@element-plus/icons-vue'
import {
  getKnowledgeList,
  uploadKnowledgeFile,
  deleteKnowledgeDoc,
  recallTest,
  getKnowledgeContent,
  type KnowledgeDoc,
  type RecallChunk,
} from '../../services/knowledge'

const list = ref<KnowledgeDoc[]>([])
const loading = ref(false)
const uploadLoading = ref(false)

const recallQuery = ref('')
const recallLoading = ref(false)
const recallResult = ref<RecallChunk[]>([])

const contentVisible = ref(false)
const contentDocId = ref('')
const contentChunks = ref<{ id: string; content: string }[]>([])
const contentLoading = ref(false)

function loadList() {
  loading.value = true
  getKnowledgeList({ pageSize: 100 })
    .then((res) => {
      list.value = res.items ?? []
    })
    .finally(() => {
      loading.value = false
    })
}

onMounted(loadList)

function handleUpload(file: File) {
  uploadLoading.value = true
  uploadKnowledgeFile(file)
    .then(() => {
      ElMessage.success('上传成功，正在构建索引')
      loadList()
    })
    .catch((e: Error) => {
      ElMessage.error(e?.message || '上传失败')
    })
    .finally(() => {
      uploadLoading.value = false
    })
  return false
}

function handleRecall() {
  const q = recallQuery.value.trim()
  if (!q) {
    ElMessage.warning('请输入检索内容')
    return
  }
  recallLoading.value = true
  recallResult.value = []
  recallTest(q, 10)
    .then((chunks) => {
      recallResult.value = chunks
      if (chunks.length === 0) ElMessage.info('无相关结果')
    })
    .catch((e: Error) => {
      ElMessage.error(e?.message || '召回失败')
    })
    .finally(() => {
      recallLoading.value = false
    })
}

function handleDelete(row: KnowledgeDoc) {
  ElMessageBox.confirm(`确定删除「${row.fileName}」？删除后需重新上传构建。`, '删除知识库文档', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      return deleteKnowledgeDoc(row.id)
    })
    .then(() => {
      ElMessage.success('已删除')
      loadList()
    })
    .catch(() => {})
}

function showContent(row: KnowledgeDoc) {
  contentDocId.value = row.id
  contentVisible.value = true
  contentChunks.value = []
  contentLoading.value = true
  getKnowledgeContent(row.id)
    .then((res) => {
      contentChunks.value = res.chunks ?? []
    })
    .finally(() => {
      contentLoading.value = false
    })
}

const statusMap: Record<string, string> = {
  pending: '待处理',
  indexing: '索引中',
  done: '已完成',
  failed: '失败',
}
</script>

<template>
  <div class="config-subpage">
    <h2 class="subpage-title">知识库管理</h2>
    <p class="subpage-desc">向量数据库：上传文件构建知识库，支持召回测试与内容查看。</p>

    <!-- 上传构建 -->
    <section class="block">
      <h3 class="block-title">上传文件构建知识库</h3>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        :disabled="uploadLoading"
        accept=".txt,.md,.pdf,.doc,.docx"
        drag
        @change="(uf: { raw?: File }) => uf?.raw && handleUpload(uf.raw)"
      >
        <el-icon class="upload-icon"><Upload /></el-icon>
        <div class="upload-text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="upload-tip">支持 txt / md / pdf / doc / docx，上传后将自动解析并写入向量库</div>
        </template>
      </el-upload>
      <div v-if="uploadLoading" class="loading-tip">上传中…</div>
    </section>

    <!-- 召回测试 -->
    <section class="block">
      <h3 class="block-title">召回测试</h3>
      <div class="recall-row">
        <el-input
          v-model="recallQuery"
          placeholder="输入问题或关键词进行检索测试"
          clearable
          style="max-width: 360px"
          @keyup.enter="handleRecall"
        />
        <el-button type="primary" :icon="Search" :loading="recallLoading" @click="handleRecall">
          检索
        </el-button>
      </div>
      <div v-if="recallResult.length" class="recall-result">
        <div v-for="(c, i) in recallResult" :key="c.id" class="recall-item">
          <span class="recall-index">{{ i + 1 }}</span>
          <div class="recall-content">{{ c.content }}</div>
          <span v-if="c.score != null" class="recall-score">相似度: {{ (c.score * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </section>

    <!-- 管理知识库 / 显示内容 -->
    <section class="block">
      <h3 class="block-title">知识库列表</h3>
      <el-table v-loading="loading" :data="list" stripe style="width: 100%">
        <el-table-column prop="fileName" label="文件名" min-width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            {{ statusMap[row.status] ?? row.status }}
          </template>
        </el-table-column>
        <el-table-column prop="chunkCount" label="片段数" width="90" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showContent(row)">查看内容</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!list.length && !loading" class="empty-hint">暂无知识库文档，请先上传文件构建</div>
    </section>

    <!-- 知识库内容弹窗 -->
    <el-dialog v-model="contentVisible" title="知识库内容" width="640px" destroy-on-close>
      <div v-loading="contentLoading" class="content-list">
        <div v-for="(chunk, i) in contentChunks" :key="chunk.id" class="content-chunk">
          <span class="chunk-index">{{ i + 1 }}</span>
          <pre class="chunk-text">{{ chunk.content }}</pre>
        </div>
        <div v-if="!contentChunks.length && !contentLoading" class="empty-hint">暂无片段或接口未实现</div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.config-subpage {
  max-width: 900px;
}
.subpage-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.subpage-desc {
  margin: 0 0 24px;
  font-size: 14px;
  color: #909399;
  line-height: 1.5;
}
.block {
  margin-bottom: 32px;
}
.block-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 500;
  color: #606266;
}
.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
}
.upload-text {
  margin-top: 8px;
  font-size: 14px;
  color: #606266;
}
.upload-text em {
  color: var(--el-color-primary);
  font-style: normal;
}
.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.loading-tip {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
}
.recall-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.recall-result {
  margin-top: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
.recall-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.recall-item:last-child {
  border-bottom: none;
}
.recall-index {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  border-radius: 4px;
  font-size: 12px;
}
.recall-content {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.recall-score {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
}
.empty-hint {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
.content-list {
  max-height: 400px;
  overflow-y: auto;
}
.content-chunk {
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.chunk-index {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}
.chunk-text {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
