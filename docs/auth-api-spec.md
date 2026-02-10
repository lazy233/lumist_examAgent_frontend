# 登录与注册接口对接说明（前端）

前端项目 API 基础路径：`{API_BASE_URL}`（默认 `/api`，可通过 `VITE_API_BASE_URL` 配置）

---

## 一、登录接口

| 项目 | 说明 |
|------|------|
| **方法 / URL** | `POST {API_BASE_URL}/auth/login`（默认 `POST /api/auth/login`） |
| **Content-Type** | `application/json` |

### 请求体（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

### 成功响应（200）

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | JWT 或会话令牌，前端存入 localStorage，后续请求头 `Authorization: Bearer {token}` |
| user | object | 用户信息 |
| user.id | string | 用户 ID |
| user.name | string | 显示名称 |

### 错误响应

- 4xx/5xx：按常规 HTTP 错误处理，`message` 或 `detail` 为说明文案。

---

## 二、注册接口

| 项目 | 说明 |
|------|------|
| **方法 / URL** | `POST {API_BASE_URL}/auth/register`（默认 `POST /api/auth/register`） |
| **Content-Type** | `application/json` |

### 请求体（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名（建议唯一） |
| password | string | 是 | 密码（前端已校验至少 6 位） |
| name | string | 否 | 姓名/昵称 |

### 成功响应（200）

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | 注册成功后直接登录的令牌 |
| user | object | 用户信息 |
| user.id | string | 用户 ID |
| user.name | string | 显示名称（优先使用请求中的 name） |

### 错误响应

- 400：如用户名已存在等，`message` 或 `detail` 为说明
- 4xx/5xx：按常规 HTTP 错误处理

---

## 三、前端流程

- **登录**：填写用户名、密码 → 调用 `POST /auth/login` → 成功则写入 token 和 user，跳转首页
- **注册**：填写用户名、姓名、密码、确认密码 → 校验两次密码一致 → 调用 `POST /auth/register` → 成功则写入 token 和 user，跳转首页

---

## 四、User 对象扩展（可选）

若后端 `user` 包含更多字段（如 `school`、`grade` 等），前端 `UserInfo` 可扩展，当前已支持：`id`、`name` 及个人资料相关字段。
