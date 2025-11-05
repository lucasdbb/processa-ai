import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@processa-ai/types': path.resolve(__dirname, '../../packages/types'),
      '@processa-ai/ui': path.resolve(__dirname, '../../packages/ui'),
      '@processa-ai/utils': path.resolve(__dirname, '../../packages/utils'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    // Permite acesso pelo domínio do Railway e por hosts comuns
    allowedHosts: [
      'processa-ai.up.railway.app',
      'localhost',
      '127.0.0.1',
    ],
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
