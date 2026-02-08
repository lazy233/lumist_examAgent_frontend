<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Difficulty, ExerciseListItem } from '../services/exercises'
import { deleteExercise, getExercisesList } from '../services/exercises'

const router = useRouter()
const loading = ref(false)
const loadError = ref(false)
const list = ref<ExerciseListItem[]>([])
const total = ref(0)
const keyword = ref('')
const difficulty = ref<Difficulty | ''>('')
const page = ref(1)
const pageSize = ref(10)

const difficultyMap: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const difficultyOptions: { value: '' | Difficulty; label: string }[] = [
  { value: '', label: '全部难度' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

const fetchList = async () => {
  loading.value = true
  loadError.value = false
  try {
    const res = await getExercisesList({
      keyword: keyword.value || undefined,
      difficulty: difficulty.value || undefined,
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

const handleView = (row: ExerciseListItem) => {
  router.push(`/exercises/${row.exerciseId}`)
}

const handleRetry = (row: ExerciseListItem) => {
  router.push(`/exercises/${row.exerciseId}?retry=1`)
}

const handleDelete = async (row: ExerciseListItem) => {
  await ElMessageBox.confirm(
    `确定删除练习「${row.title || row.exerciseId}」吗？删除后无法恢复。`,
    '确认删除',
    {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    }
  )
  try {
    await deleteExercise(row.exerciseId)
    ElMessage.success('删除成功')
    fetchList()
  } catch {
    // error handled by http interceptor
  }
}

const hasScore = (row: ExerciseListItem) => row.score != null

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
  <div class="page exercises-list-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>我的练习</span>
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
          placeholder="搜索练习标题"
          clearable
          style="width: 200px; max-width: 100%"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="difficulty"
          placeholder="难度"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option
            v-for="opt in difficultyOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
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
            description="暂无练习，去出题中心生成一份吧"
            :image-size="100"
          >
            <el-button type="primary" @click="router.push('/dashboard')">
              去出题中心生成练习
            </el-button>
          </el-empty>
        </template>
        <el-table-column prop="title" label="练习标题" min-width="180" />
        <el-table-column prop="count" label="题量" width="80" />
        <el-table-column label="难度" width="90">
          <template #default="{ row }">
            {{ difficultyMap[row.difficulty as Difficulty] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="得分" width="90">
          <template #default="{ row }">
            {{ row.score != null ? row.score : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">
              {{ hasScore(row) ? '查看' : '继续作答' }}
            </el-button>
            <el-button
              v-if="hasScore(row)"
              type="primary"
              link
              @click="handleRetry(row)"
            >
              再做一次
            </el-button>
            <el-button type="danger" link @click="handleDelete(row)">
              删除
            </el-button>
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
.exercises-list-page .card-header {
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
  .toolbar .el-input,
  .toolbar .el-select {
    width: 100% !important;
    max-width: 100%;
  }
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
