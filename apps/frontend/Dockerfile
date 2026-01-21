FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port (Railway uses $PORT env variable)
EXPOSE 3000

# Start Vite preview server
CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port ${PORT:-3000}"]
