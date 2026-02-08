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
docker run -d -p 80:80 --name front lumist-exam-agent-front
```

访问 `http://服务器IP` 即可打开前端。

- 若需指定后端 API 地址再构建：  
  `docker build --build-arg VITE_API_BASE_URL=https://你的API域名 -t lumist-exam-agent-front .`
- 若前后端同机部署、希望 nginx 代理 `/api` 到后端，可修改 `nginx.conf` 中注释的 `location /api/` 后重新构建。
