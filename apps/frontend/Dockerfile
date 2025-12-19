FROM node:20-alpine

WORKDIR /app

# Copiar package files e instalar dependências
COPY package*.json ./
RUN npm ci

# Copiar código fonte
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
