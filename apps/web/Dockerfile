# syntax=docker/dockerfile:1

# Build stage: compila a SPA com Vite
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar arquivos essenciais do monorepo para instalar dependências com workspaces
COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Instalar dependências (respeita npm workspaces)
RUN npm ci

# Build do frontend (SPA) localizado em apps/web
RUN npm run build -w apps/web


# Runtime stage: servir arquivos estáticos com Nginx
FROM nginx:1.25-alpine AS runner

# Instalar envsubst para interpolar PORT no template do Nginx
RUN apk add --no-cache bash gettext

# Copiar artefatos de build para a pasta pública do Nginx
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/apps/web/dist ./

# Copiar template de configuração e entrypoint
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY apps/web/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Definir porta padrão (Railway injeta $PORT automaticamente)
ENV PORT=8080

# Expor porta (apenas documentação; Railway usa $PORT)
EXPOSE 8080

# Iniciar Nginx com config gerada a partir do template
CMD ["/entrypoint.sh"]