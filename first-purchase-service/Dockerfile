# 首购法币支付网关服务 Dockerfile

FROM node:18-alpine

LABEL maintainer="MemoPark Team"
LABEL description="首购法币支付网关服务"

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src ./src

# 创建日志目录
RUN mkdir -p /app/logs

# 暴露端口
EXPOSE 3100

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/api/first-purchase/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 启动服务
CMD ["node", "src/index.js"]

