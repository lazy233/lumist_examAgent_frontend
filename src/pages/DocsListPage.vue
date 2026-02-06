<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { DocListItem, DocStatus } from '../services/docs'
import { deleteDoc, getDocsList } from '../services/docs'

const router = useRouter()
const loading = ref(false)
const loadError = ref(false)
const list = ref<DocListItem[]>([])
const total = ref(0)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)

const statusMap: Record<DocStatus, string> = {
  uploaded: '已上传',
  parsing: '解析中',
  done: '解析完成',
  failed: '解析失败',
}

const statusTypeMap: Record<DocStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  uploaded: 'info',
  parsing: 'warning',
  done: 'success',
  failed: 'danger',
}

const fetchList = async () => {
  loading.value = true
  loadError.value = false
  try {
    const res = await getDocsList({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    list.value = res.items || []
    total.value = res.total || 0
  } catch {
    list.value = []
    total.value = 0
    loadError.value = true
  } finally {
    loading.value = false
  }
}

watch([page, pageSize], fetchList)

const handleSearch = () => {
  if (page.value === 1) {
    fetchList()
  } else {
    page.value = 1
  }
}

const handleView = (row: DocListItem) => {
  router.push(`/docs/${row.docId}`)
}

const handleDelete = async (row: DocListItem) => {
  await ElMessageBox.confirm(
    `确定删除资料「${row.fileName}」吗？删除后无法恢复。`,
    '确认删除',
    {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    }
  )
  try {
    await deleteDoc(row.docId)
    ElMessage.success('删除成功')
    fetchList()
  } catch {
    // error handled by http interceptor
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('zh-CN')
  } catch {
    return dateStr
  }
}

onMounted(() => {
  fetchList()
})
</script>

<template>
  <div class="page docs-list-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>我的资料</span>
          <el-button type="primary" @click="router.push('/docs/create')">
            上传资料
          </el-button>
        </div>
      </template>

      <div v-if="loadError" class="error-bar">
        <el-alert
          title="加载失败，请检查网络后重试"
          type="error"
          show-icon
          closable
        />
        <el-button type="primary" size="small" class="retry-btn" @click="fetchList">
          重试
        </el-button>
      </div>
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="按文件名或课程名搜索"
          clearable
          style="width: 260px; max-width: 100%"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        stripe
        style="width: 100%; margin-top: 16px"
      >
        <template #empty>
          <el-empty
            v-if="!loading"
            description="暂无资料，去出题中心上传一份吧"
            :image-size="100"
          >
            <el-button type="primary" @click="router.push('/docs/create')">
              上传资料
            </el-button>
          </el-empty>
        </template>
        <el-table-column prop="fileName" label="文件名" min-width="180" />
        <el-table-column label="课程名" min-width="140">
          <template #default="{ row }">
            {{ row.parsed?.course || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="解析状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTypeMap[row.status as DocStatus]" size="small">
              {{ statusMap[row.status as DocStatus] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">查看</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > 0" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.docs-list-page .card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.error-bar .retry-btn {
  flex-shrink: 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .toolbar .el-input {
    width: 100% !important;
  }
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
