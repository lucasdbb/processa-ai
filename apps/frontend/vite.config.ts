import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  preview: {
    // Allow custom domains (safe for production)
    allowedHosts: [
      'www.oprocessai.com.br',
      'oprocessai.com.br',
      '.railway.app', // Railway subdomains
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'vendor-utils': ['zustand', 'zod', 'react-hook-form', '@hookform/resolvers'],
          'vendor-markdown': ['marked', 'dompurify'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
