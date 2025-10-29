// Validação e tipagem de variáveis de ambiente

interface Environment {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  FRONTEND_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * Valida se todas as variáveis de ambiente necessárias estão presentes
 */
export const validateEnvironment = (): Environment => {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
  ] as const;

  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    NODE_ENV: (process.env.NODE_ENV as any) || 'production',
  };
};

/**
 * Variáveis de ambiente validadas e tipadas
 */
export const env = validateEnvironment();
