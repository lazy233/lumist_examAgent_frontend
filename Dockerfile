# 构建阶段：使用 Node 编译 Vue/Vite 项目
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖（包含 devDependencies，构建需要）
RUN npm ci

# 复制源码
COPY . .

# 构建时可通过 --build-arg 传入 API 地址，默认使用相对路径 /api（需 nginx 反向代理后端）
ARG VITE_API_BASE_URL=/api
ARG VITE_USE_MOCK=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN npm run build

# 运行阶段：使用 nginx 提供静态文件
FROM nginx:alpine

# 复制自定义 nginx 配置（支持 SPA 路由）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制打包产物到 nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
