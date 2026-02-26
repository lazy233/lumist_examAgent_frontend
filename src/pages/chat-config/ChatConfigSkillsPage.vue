<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Upload } from '@element-plus/icons-vue'
import {
  getSkillFilesList,
  uploadSkillFile,
  deleteSkillFile,
  type SkillFileItem,
} from '../../services/skillFiles'

const list = ref<SkillFileItem[]>([])
const loading = ref(false)
const uploadLoading = ref(false)

function loadList() {
  loading.value = true
  getSkillFilesList({ pageSize: 100 })
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
  uploadSkillFile(file)
    .then(() => {
      ElMessage.success('上传成功')
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

function handleDelete(row: SkillFileItem) {
  ElMessageBox.confirm(`确定删除「${row.name}」？`, '删除文件', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => deleteSkillFile(row.id))
    .then(() => {
      ElMessage.success('已删除')
      loadList()
    })
    .catch(() => {})
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<template>
  <div class="config-subpage">
    <h2 class="subpage-title">Skills 管理</h2>
    <p class="subpage-desc">文件管理系统：上传、管理 Skills 相关文件，供问答能力调用。</p>

    <!-- 上传 -->
    <section class="block">
      <h3 class="block-title">上传文件</h3>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        :disabled="uploadLoading"
        drag
        @change="(uf: { raw?: File }) => uf?.raw && handleUpload(uf.raw)"
      >
        <el-icon class="upload-icon"><Upload /></el-icon>
        <div class="upload-text">将文件拖到此处，或<em>点击上传</em></div>
      </el-upload>
      <div v-if="uploadLoading" class="loading-tip">上传中…</div>
    </section>

    <!-- 文件列表 -->
    <section class="block">
      <h3 class="block-title">文件列表</h3>
      <el-table v-loading="loading" :data="list" stripe style="width: 100%">
        <el-table-column prop="name" label="文件名" min-width="200" />
        <el-table-column prop="size" label="大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="上传时间" width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" size="small" :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!list.length && !loading" class="empty-hint">暂无文件，请先上传</div>
    </section>
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
.loading-tip {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
}
.empty-hint {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
