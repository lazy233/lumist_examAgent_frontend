# 前端在已有 ECS 上部署（80 已占用）

假设 ECS 已装好 Nginx 等，80 端口已被其他项目占用，本前端用**其他端口**（如 8080）部署。

---

## 1. 本地打包

在项目根目录执行：

```bash
npm install
npm run build
```

得到 `dist` 目录，里面就是要部署的静态文件。

---

## 2. 上传到 ECS

把 **`dist` 里的所有文件** 上传到服务器一个目录，例如：

- `/www/exam-agent/`（可自定，和现有项目分开即可）

本机示例（在项目根目录执行，把 `你的ECS公网IP` 换成实际 IP）：

```bash
scp -r dist/* root@你的ECS公网IP:/www/exam-agent/
```

或用宝塔、FTP、WinSCP 等上传到 `/www/exam-agent/`。

---

## 3. 在 Nginx 里加一个站点（用新端口）

在 Nginx 配置目录里**新建一个配置文件**（不要动现有项目的配置），例如：

```bash
vim /etc/nginx/conf.d/exam-agent.conf
```

写入（端口用 **8080**，若 8080 也被占可改成 8081、3000 等）：

```nginx
server {
    listen 8080;
    server_name _;   # 或填域名，用 IP 访问可保持 _

    root /www/exam-agent;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- `root` 要和你上传的目录一致（这里是 `/www/exam-agent`）。
- 若后端不在本机 8000，把 `http://127.0.0.1:8000` 改成后端地址。

---

## 4. 检查配置并重载 Nginx

```bash
nginx -t
systemctl reload nginx
```

---

## 5. 安全组放行端口

在阿里云 ECS 控制台 → 安全组 → 入方向规则里，放行你用的端口（如 **8080**）。

---

## 6. 访问

浏览器打开：`http://你的ECS公网IP:8080`（端口改成你配置的即可）。

---

**小结**：本地 `npm run build` → 上传 `dist` 内容到 `/www/exam-agent/` → Nginx 新加一个 `listen 8080` 的 server，root 指到该目录 → `nginx -t` 后 `reload` → 安全组放行 8080 → 用 `http://IP:8080` 访问。
