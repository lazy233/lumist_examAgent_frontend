<script setup lang="ts">
import { ref } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { Loading, UploadFilled } from '@element-plus/icons-vue'
import { startParse, uploadDoc } from '../services/docs'

const router = useRouter()
const uploading = ref(false)

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
    const data = await uploadDoc(options.file as File, { saveToLibrary: true })
    await startParse(data.docId)
    ElMessage.success('已保存到资料库，正在解析，可在列表中查看解析状态')
    options.onSuccess?.(data)
    router.push('/docs')
  } catch (err) {
    ElMessage.error('上传失败，请重试')
    options.onError?.(err as never)
  } finally {
    uploading.value = false
  }
}

</script>

<template>
  <div class="page doc-create-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>添加资料到资料库</span>
          <el-button text type="primary" @click="router.push('/docs')">返回我的资料</el-button>
        </div>
      </template>
      <div class="upload-area">
        <el-upload
          drag
          :show-file-list="false"
          :http-request="handleUpload"
          :before-upload="beforeUpload"
          :accept="'.pdf,.docx,.pptx,.txt'"
          :disabled="uploading"
          :class="{ 'is-uploading': uploading }"
          class="upload-block"
        >
          <div class="upload-inner">
            <el-icon v-if="!uploading" class="upload-icon"><UploadFilled /></el-icon>
            <el-icon v-else class="upload-icon spin"><Loading /></el-icon>
            <div class="upload-text">将文档拖到此处，或点击选择文件</div>
            <div class="upload-tip">支持 pdf / docx / pptx / txt，保存后将出现在「我的资料」</div>
          </div>
        </el-upload>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.doc-create-page {
  max-width: 560px;
  margin: 0 auto;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.upload-area {
  width: 100%;
}
.upload-block :deep(.el-upload-dragger) {
  padding: 40px 24px;
  border-radius: 10px;
  border: 1px dashed #c0c4cc;
  background: #fafbfc;
}
.upload-block :deep(.el-upload-dragger:hover) {
  border-color: var(--lumist-secondary);
  background: var(--lumist-secondary-light);
}
.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.upload-icon {
  font-size: 48px;
  color: var(--lumist-secondary);
}
.upload-icon.spin {
  animation: spin 1s linear infinite;
}
.upload-text {
  font-size: 15px;
  color: #303133;
}
.upload-tip {
  font-size: 12px;
  color: #909399;
}
.is-uploading :deep(.el-upload-dragger) {
  cursor: not-allowed;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
