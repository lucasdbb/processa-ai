# Build stage: instala dependências do monorepo e compila o gateway
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar arquivos essenciais do monorepo
COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Instalar dependências (respeita npm workspaces)
RUN npm install

# Build do api-gateway
RUN npm run build --workspace=@processa-ai/api-gateway

# Runtime stage: executar o gateway
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/apps/api-gateway/dist ./dist
COPY --from=builder /app/apps/api-gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["node", "dist/server.js"]
