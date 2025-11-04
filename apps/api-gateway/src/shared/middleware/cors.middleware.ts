import cors from 'cors';
import { env } from '../../config/env.js';

/**
 * Configuração de CORS
 */
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // Vite preview
  ...(env.NODE_ENV === 'production' ? ['https://processa-ai.vercel.app'] : [])
].filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (mobile apps, Postman, etc)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
});
