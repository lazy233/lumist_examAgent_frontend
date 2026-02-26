<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import { loadChatConfig, saveChatConfig } from '../../config/chatConfig'

export interface ModelItem {
  id: string
  name: string
  value: string
  endpoint?: string
  isDefault: boolean
}

const MODELS_STORAGE_KEY = 'lumist_chat_models'

const defaultModels: ModelItem[] = [
  { id: '1', name: 'GPT-4o', value: 'gpt-4o', isDefault: false },
  { id: '2', name: 'GPT-4o Mini', value: 'gpt-4o-mini', isDefault: true },
  { id: '3', name: 'GPT-4 Turbo', value: 'gpt-4-turbo', isDefault: false },
  { id: '4', name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', isDefault: false },
]

function loadModels(): ModelItem[] {
  try {
    const raw = localStorage.getItem(MODELS_STORAGE_KEY)
    if (!raw) return defaultModels.map((m) => ({ ...m }))
    return JSON.parse(raw)
  } catch {
    return defaultModels.map((m) => ({ ...m }))
  }
}

function saveModels(models: ModelItem[]) {
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models))
}

const list = ref<ModelItem[]>([])
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = ref<ModelItem>({
  id: '',
  name: '',
  value: '',
  endpoint: '',
  isDefault: false,
})

const isEditing = computed(() => !!editingId.value)

onMounted(() => {
  list.value = loadModels()
})

function openAdd() {
  editingId.value = null
  form.value = { id: '', name: '', value: '', endpoint: '', isDefault: false }
  dialogVisible.value = true
}

function openEdit(row: ModelItem) {
  editingId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

function setDefault(row: ModelItem) {
  list.value = list.value.map((m) => ({ ...m, isDefault: m.id === row.id }))
  saveModels(list.value)
  const config = loadChatConfig()
  config.model = row.value
  saveChatConfig(config)
  ElMessage.success(`已设「${row.name}」为默认模型`)
}

function submitModel() {
  const { name, value } = form.value
  if (!name?.trim() || !value?.trim()) {
    ElMessage.warning('请填写模型名称与标识')
    return
  }
  if (isEditing.value) {
    const idx = list.value.findIndex((m) => m.id === editingId.value)
    if (idx >= 0) {
      list.value[idx] = { ...form.value }
    }
    ElMessage.success('已更新')
  } else {
    list.value.push({
      ...form.value,
      id: crypto.randomUUID(),
    })
    ElMessage.success('已添加')
  }
  saveModels(list.value)
  dialogVisible.value = false
}

function handleDelete(row: ModelItem) {
  if (row.isDefault) {
    ElMessage.warning('请先将其他模型设为默认再删除')
    return
  }
  ElMessageBox.confirm(`确定删除模型「${row.name}」？`, '删除模型', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      list.value = list.value.filter((m) => m.id !== row.id)
      saveModels(list.value)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}
</script>

<template>
  <div class="config-subpage">
    <h2 class="subpage-title">模型管理</h2>
    <p class="subpage-desc">管理可用模型，设置默认模型后将在智能问答中使用。</p>

    <section class="block">
      <div class="block-head">
        <h3 class="block-title">模型列表</h3>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加模型</el-button>
      </div>
      <el-table :data="list" stripe style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="value" label="模型标识" min-width="140" />
        <el-table-column prop="endpoint" label="端点" min-width="180" show-overflow-tooltip />
        <el-table-column label="默认" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="success" size="small">默认</el-tag>
            <el-button v-else link type="primary" size="small" @click="setDefault(row)">
              设为默认
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :icon="Edit" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button link type="danger" size="small" :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑模型' : '添加模型'"
      width="480px"
      destroy-on-close
    >
      <el-form label-width="90px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如：GPT-4o" />
        </el-form-item>
        <el-form-item label="模型标识">
          <el-input v-model="form.value" placeholder="如：gpt-4o" />
        </el-form-item>
        <el-form-item label="端点（可选）">
          <el-input v-model="form.endpoint" placeholder="API 端点" />
        </el-form-item>
        <el-form-item label="默认模型">
          <el-switch v-model="form.isDefault" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitModel">确定</el-button>
      </template>
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
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.block-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #606266;
}
</style>
