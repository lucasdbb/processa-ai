import { z } from 'zod'

/**
 * Validation schemas for authentication forms using Zod
 * These provide runtime type validation and error messages
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'A senha deve ter no mínimo 8 caracteres'),
})

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número'),
  confirmPassword: z
    .string()
    .min(1, 'Confirmação de senha é obrigatória'),
  newsletter_opt_in: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
})

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número'),
  confirmPassword: z
    .string()
    .min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

// CPF validation (simplified)
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
const cpfUnmaskedRegex = /^\d{11}$/

// CNPJ validation (simplified)
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/
const cnpjUnmaskedRegex = /^\d{14}$/

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(3, 'O nome deve ter no mínimo 3 caracteres')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, 'Telefone inválido')
    .optional()
    .or(z.literal('')),
  document_type: z.enum(['cpf', 'cnpj']).optional(),
  document_number: z
    .string()
    .optional()
    .or(z.literal('')),
  newsletter_opt_in: z.boolean().optional(),
}).refine((data) => {
  if (data.document_number && data.document_type) {
    if (data.document_type === 'cpf') {
      return cpfRegex.test(data.document_number) || cpfUnmaskedRegex.test(data.document_number)
    }
    if (data.document_type === 'cnpj') {
      return cnpjRegex.test(data.document_number) || cnpjUnmaskedRegex.test(data.document_number)
    }
  }
  return true
}, {
  message: 'Documento inválido',
  path: ['document_number'],
})

// Type inference from schemas
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
