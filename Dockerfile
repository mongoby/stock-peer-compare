# ====== 构建阶段：前端 ======
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ====== 运行阶段 ======
FROM python:3.11-slim

# 安装 Nginx
RUN apt-get update && apt-get install -y nginx curl && \
    rm -rf /var/lib/apt/lists/*

# 后端依赖
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt gunicorn

# 复制代码
COPY backend/ /app/backend/
COPY china_stock.py /app/
WORKDIR /app

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# 启动 Nginx + Gunicorn
CMD nginx && gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 30 backend.app:app
