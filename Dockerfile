# Sử dụng Node.js bản nhẹ nhất
FROM node:20-alpine AS builder

WORKDIR /app
# Copy package.json của root và các workspace
COPY package*.json ./
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/ai-worker/package*.json ./services/ai-worker/

# Cài đặt dependencies (Nên dùng npm ci hoặc yarn install nếu dùng Monorepo)
RUN npm install

# Copy toàn bộ mã nguồn backend
COPY services ./services
COPY packages ./packages

# Build TypeScript sang JavaScript
RUN cd services/api-gateway && npm run build
RUN cd services/ai-worker && npm run build

# --- Stage 2: Production ---
FROM node:20-alpine AS runner
WORKDIR /app

# Chỉ copy file đã build và thư mục node_modules từ stage builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/ai-worker/dist ./services/ai-worker/dist

# Tạo thư mục tạm để lưu audio upload
RUN mkdir -p /tmp/uploads/audio && chown -R node:node /tmp/uploads

USER node
