<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatDotRound, Delete, DocumentAdd, Operation, Setting, User } from '@element-plus/icons-vue'
import { chatStream } from '../services/chat'
import type { ChatMessage, ChatStreamOptions } from '../services/chat'
import { API_BASE_URL } from '../config/app'
import { loadChatConfig } from '../config/chatConfig'

const router = useRouter()
const route = useRoute()
/** 发送时使用的配置（从配置页保存的数据读取） */
const chatConfig = ref(loadChatConfig())

watch(() => route.path, (path) => {
  if (path === '/chat') chatConfig.value = loadChatConfig()
}, { immediate: true })

interface DebugEntry {
  id: string
  time: string
  type: string
  payload: unknown
}

interface MessageItem extends ChatMessage {
  messageId?: string
  debugLogs?: DebugEntry[]
}

interface Session {
  id: string
  title: string
  messages: MessageItem[]
}

const sessions = ref<Session[]>([{ id: crypto.randomUUID(), title: '新对话', messages: [] }])
const currentSessionId = ref<string>(sessions.value[0].id)

const currentSession = computed(() =>
  sessions.value.find((s) => s.id === currentSessionId.value)
)
const currentMessages = computed(() => currentSession.value?.messages ?? [])

const inputText = ref('')
const sending = ref(false)
const messagesEndRef = ref<HTMLElement | null>(null)

/** 每条回复下方展开的调试消息 id 集合 */
const expandedDebugIds = ref<Set<string>>(new Set())

function scrollToBottom() {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

watch(
  () => currentMessages.value.length,
  () => scrollToBottom()
)

function sessionTitle(session: Session): string {
  if (session.title && session.title !== '新对话') return session.title
  const first = session.messages.find((m) => m.role === 'user')
  if (first?.content) return first.content.slice(0, 16) + (first.content.length > 16 ? '…' : '')
  return '新对话'
}

function newConversation() {
  const session: Session = { id: crypto.randomUUID(), title: '新对话', messages: [] }
  sessions.value.push(session)
  currentSessionId.value = session.id
}

function deleteSession(sessionId: string, e: Event) {
  e.stopPropagation()
  const idx = sessions.value.findIndex((s) => s.id === sessionId)
  if (idx < 0) return
  const session = sessions.value[idx]
  const count = session.messages.length
  ElMessageBox.confirm(
    count ? `确定删除该会话（含 ${count} 条消息）？` : '确定删除该会话？',
    '删除会话',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    sessions.value.splice(idx, 1)
    if (currentSessionId.value === sessionId) {
      currentSessionId.value = sessions.value[0]?.id ?? ''
      if (!sessions.value.length) {
        sessions.value.push({ id: crypto.randomUUID(), title: '新对话', messages: [] })
        currentSessionId.value = sessions.value[0].id
      }
    }
    ElMessage.success('已删除')
  }).catch(() => {})
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value || !currentSession.value) return

  const userMsg: MessageItem = { role: 'user', content: text }
  currentSession.value.messages.push(userMsg)

  // 更新会话标题（用第一条用户消息）
  if (currentSession.value.messages.length === 1) {
    currentSession.value.title = text.slice(0, 16) + (text.length > 16 ? '…' : '')
  }

  inputText.value = ''
  sending.value = true

  const debugLogs: DebugEntry[] = []
  const assistantMsg: MessageItem = {
    role: 'assistant',
    content: '',
    messageId: crypto.randomUUID(),
    debugLogs,
  }
  currentSession.value.messages.push(assistantMsg)

  const messagesForApi: ChatMessage[] = currentSession.value.messages
    .slice(0, -1)
    .map((m) => ({ role: m.role, content: m.content }))

  const options: ChatStreamOptions = {
    model: chatConfig.value.model,
    knowledgeBaseIds: chatConfig.value.knowledgeBaseIds?.length ? chatConfig.value.knowledgeBaseIds : undefined,
    skills: chatConfig.value.skills?.length ? chatConfig.value.skills : undefined,
    systemPrompt: chatConfig.value.systemPrompt?.trim() || undefined,
  }
  const url = `${API_BASE_URL}/chat/stream`
  debugLogs.push({
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    type: 'request',
    payload: { url, body: { messages: messagesForApi, options }, time: new Date().toISOString() },
  })

  chatStream(messagesForApi, {
    onChunk(t) {
      assistantMsg.content += t
      debugLogs.push({
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type: 'chunk',
        payload: { text: t },
      })
      scrollToBottom()
    },
    onDone() {
      sending.value = false
      debugLogs.push({
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type: 'done',
        payload: { time: new Date().toISOString() },
      })
    },
    onError(err) {
      sending.value = false
      assistantMsg.content += `\n\n[错误: ${err.message}]`
      debugLogs.push({
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type: 'error',
        payload: { message: err.message },
      })
      ElMessage.error(err.message)
    },
  }, options)
}

function toggleDebugExpand(messageId: string | undefined) {
  if (!messageId) return
  const set = new Set(expandedDebugIds.value)
  if (set.has(messageId)) set.delete(messageId)
  else set.add(messageId)
  expandedDebugIds.value = set
}
</script>

<template>
  <div class="chat-page">
    <!-- 左侧：会话列表 -->
    <aside class="session-sidebar">
      <div class="sidebar-header">
        <el-button type="primary" :icon="DocumentAdd" @click="newConversation" style="width: 100%">
          新对话
        </el-button>
      </div>
      <ul class="session-list">
        <li
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === currentSessionId }"
          @click="currentSessionId = s.id"
        >
          <span class="session-item-title">{{ sessionTitle(s) }}</span>
          <el-button
            type="danger"
            link
            :icon="Delete"
            class="session-delete"
            title="删除会话"
            @click="deleteSession(s.id, $event)"
          />
        </li>
      </ul>
    </aside>

    <!-- 右侧：当前会话 -->
    <div class="chat-main">
      <div class="chat-header">
        <h1 class="chat-title">{{ currentSession ? sessionTitle(currentSession) : '智能问答' }}</h1>
      </div>

      <div class="chat-body">
        <div class="messages-wrap">
          <template v-if="currentMessages.length">
            <div
              v-for="(msg, i) in currentMessages"
              :key="msg.messageId ?? i"
              class="message-row"
              :class="msg.role"
            >
              <div class="message-avatar">
                <el-icon v-if="msg.role === 'user'"><User /></el-icon>
                <el-icon v-else><ChatDotRound /></el-icon>
              </div>
              <div class="message-block">
                <div class="message-bubble">
                  <span class="message-content">{{ msg.content }}</span>
                  <span
                    v-if="msg.role === 'assistant' && sending && i === currentMessages.length - 1"
                    class="cursor"
                  >|</span>
                </div>
                <!-- 仅助手回复且存在调试信息时显示展开按钮 -->
                <div
                  v-if="msg.role === 'assistant' && msg.debugLogs?.length"
                  class="message-debug-wrap"
                >
                  <el-button
                    link
                    type="info"
                    size="small"
                    :icon="Operation"
                    @click="toggleDebugExpand(msg.messageId)"
                  >
                    {{ expandedDebugIds.has(msg.messageId!) ? '收起调试' : '展开调试' }}
                  </el-button>
                  <div
                    v-show="expandedDebugIds.has(msg.messageId!)"
                    class="message-debug-panel"
                  >
                    <div
                      v-for="entry in msg.debugLogs"
                      :key="entry.id"
                      class="debug-entry"
                      :data-type="entry.type"
                    >
                      <span class="debug-time">{{ entry.time }}</span>
                      <span class="debug-type">{{ entry.type }}</span>
                      <pre class="debug-payload">{{ JSON.stringify(entry.payload, null, 2) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="empty-tip">
            <p>输入问题开始对话，支持多轮问答。</p>
            <p>点击左侧「新对话」可新建会话；每条回复下方可展开调试信息。</p>
          </div>
          <div ref="messagesEndRef" class="messages-end" />
        </div>

        <div class="input-area">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="2"
            placeholder="输入你的问题…"
            :disabled="sending"
            maxlength="4000"
            show-word-limit
            @keydown.enter.exact.prevent="sendMessage()"
          />
          <el-button
            type="primary"
            :loading="sending"
            :disabled="!inputText.trim()"
            @click="sendMessage"
          >
            发送
          </el-button>
        </div>
      </div>

    </div>

    <!-- 浏览器右下角齿轮：菜单 → 进入配置页 -->
    <el-dropdown trigger="click" placement="top-end" @command="(cmd: string) => cmd === 'config' && router.push('/chat/config')">
      <el-button
        class="config-gear"
        type="primary"
        plain
        circle
        :icon="Setting"
        title="问答配置"
      />
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="config">功能配置</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: calc(100vh - 56px);
  min-height: 400px;
  background: #fff;
}

.session-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
}
.session-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  flex: 1;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
}
.session-item:hover {
  background: #f0f2f5;
}
.session-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.session-item-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-delete {
  flex-shrink: 0;
  opacity: 0.6;
}
.session-item:hover .session-delete {
  opacity: 1;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}
.chat-header {
  padding: 12px 24px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}
.chat-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
}
.messages-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  background: #fff;
}
.message-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
}
.message-row.user {
  flex-direction: row-reverse;
}
.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}
.message-row.user .message-avatar {
  background: var(--el-color-primary);
  color: #fff;
}
.message-block {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.message-row.user .message-block {
  align-items: flex-end;
}
.message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  background: #f5f7fa;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.message-row.user .message-bubble {
  background: var(--el-color-primary-light-9);
}
.message-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
}
.cursor {
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}
@keyframes blink {
  50% { opacity: 0; }
}

.message-debug-wrap {
  margin-top: 4px;
}
.message-debug-panel {
  margin-top: 8px;
  padding: 10px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  max-height: 240px;
  overflow-y: auto;
}
.debug-entry {
  margin-bottom: 10px;
  padding: 8px;
  background: #fff;
  border-radius: 6px;
  border-left: 3px solid #909399;
}
.debug-entry:last-child {
  margin-bottom: 0;
}
.debug-entry[data-type="request"] { border-left-color: var(--el-color-primary); }
.debug-entry[data-type="chunk"] { border-left-color: #67c23a; }
.debug-entry[data-type="done"] { border-left-color: #409eff; }
.debug-entry[data-type="error"] { border-left-color: #f56c6c; }
.debug-time {
  color: #909399;
  margin-right: 8px;
}
.debug-type {
  font-weight: 500;
  margin-right: 8px;
}
.debug-payload {
  margin: 6px 0 0;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
  font-size: 11px;
}

.empty-tip {
  text-align: center;
  color: #909399;
  font-size: 14px;
  padding: 48px 24px;
  line-height: 1.8;
}
.messages-end {
  height: 1px;
}
.input-area {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #ebeef5;
  background: #fff;
}
.input-area .el-input {
  flex: 1;
}

.config-gear {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 44px;
  height: 44px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 50;
}
</style>
