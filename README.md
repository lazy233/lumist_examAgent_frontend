# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

---

## Docker 部署（服务器拉代码后构建并运行）

在服务器上克隆本仓库后，在项目根目录执行：

```bash
# 1. 构建镜像
docker build -t lumist-exam-agent-front .

# 2. 运行容器（映射 80 端口）
# 若后端在同一台机的 8000 端口，Linux 需加 --add-host 以便容器访问宿主机
docker run -d -p 80:80 --add-host=host.docker.internal:host-gateway --name front lumist-exam-agent-front
```

访问 `http://服务器IP` 即可打开前端。

- **后端在同一台服务器 8000 端口**：当前 `nginx.conf` 已把 `/api` 代理到宿主机 8000 端口，前端请求会打到后端；运行容器时 Linux 需加 `--add-host=host.docker.internal:host-gateway`（Windows/Mac Docker Desktop 可省略）。
- 若需指定后端为其他地址再构建：  
  `docker build --build-arg VITE_API_BASE_URL=https://你的API域名 -t lumist-exam-agent-front .`

---

## 服务器无法访问 Docker Hub 时的部署方式

若应用服务器到 Docker Hub（及镜像源）的 HTTPS 被运营商/云平台限制，无法在服务器上 `docker build` 或 `docker pull`，可采用下面两种方式。

### 方式一：本地构建 → 导出镜像 → 上传到服务器再加载（推荐，不依赖任何镜像仓库）

在**能正常访问外网的本机**（如你的开发机）完成构建和导出，把镜像文件传到服务器后加载运行。

**本机（Windows / 有 Docker 的环境）：**

```bash
# 1. 进入项目目录，构建镜像
cd lumist_examAgent_frontend
docker build -t lumist-exam-agent-front:latest .

# 2. 导出为 tar 文件（约几十 MB～百 MB）
docker save -o lumist-exam-agent-front.tar lumist-exam-agent-front:latest
```

**把 `lumist-exam-agent-front.tar` 传到服务器**（任选一种）：

- 用 SCP：`scp lumist-exam-agent-front.tar 用户@服务器IP:/home/用户/`
- 用 WinSCP、FileZilla 等图形工具上传
- 若服务器在同一云厂商，可先上传到对象存储（如 OSS），再在服务器上下载

**服务器上：**

```bash
# 3. 加载镜像（无需访问 Docker Hub）
docker load -i lumist-exam-agent-front.tar

# 4. 运行容器（后端同机 8000 端口时 Linux 加 --add-host）
docker run -d -p 80:80 --add-host=host.docker.internal:host-gateway --name front lumist-exam-agent-front:latest
```

之后更新版本：本机重新 `docker build` → `docker save` → 传新 tar 到服务器 → 服务器上先 `docker stop front; docker rm front`，再 `docker load` 新 tar 并重新 `docker run`。

### 方式二：GitHub Actions 构建并推送到 GitHub 容器仓库，服务器从 ghcr.io 拉取

若**服务器能访问 GitHub**（例如能 `git clone`），可让 GitHub Actions 在云端构建镜像并推送到 **GitHub Container Registry (ghcr.io)**，服务器只从 ghcr.io 拉取镜像，无需在服务器上构建、也无需访问 Docker Hub。

1. 在仓库中启用 GitHub Actions，并添加工作流（见下方示例）。
2. 在仓库 Settings → Actions → General 中为 workflow 配置写权限（Allow read and write permissions）。
3. 每次推送到 `main`（或你指定的分支）会自动构建并推送镜像到 `ghcr.io/lazy233/lumist_exam_agent_frontend:latest`。
4. 服务器上首次使用需登录（仅一次）：  
   `echo "你的GitHub_PAT" | docker login ghcr.io -u 你的GitHub用户名 --password-stdin`  
   然后：  
   `docker pull ghcr.io/lazy233/lumist_exam_agent_frontend:latest`  
   `docker run -d -p 80:80 --name front ghcr.io/lazy233/lumist_exam_agent_frontend:latest`

本仓库已包含 `.github/workflows/docker-publish.yml`，推送代码到 `main` 后会自动构建并推送镜像到 GitHub 容器仓库。拉取镜像时使用（镜像名会按仓库名转成小写）：

```bash
docker pull ghcr.io/lazy233/lumist_examagent_frontend:latest
docker run -d -p 80:80 --add-host=host.docker.internal:host-gateway --name front ghcr.io/lazy233/lumist_examagent_frontend:latest
```

若仓库名为 `lumist_examAgent_frontend`，GHCR 中可能显示为 `lumist_examagent_frontend`，以 GitHub 仓库页 Packages 中实际名称为准。
