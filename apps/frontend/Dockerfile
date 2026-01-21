# Build stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build args for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BACKEND_URL

# Set environment variables for build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Build the app
RUN npm run build

# Expose port (Railway uses $PORT env variable)
EXPOSE 3000

# Start Vite preview server
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
