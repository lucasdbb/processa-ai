import { z } from 'zod'

export const createPostSchema = z.object({
  title: z
    .string()
    .min(1, 'Título é obrigatório')
    .min(10, 'O título deve ter no mínimo 10 caracteres')
    .max(200, 'O título deve ter no máximo 200 caracteres'),
  content: z
    .string()
    .min(1, 'Conteúdo é obrigatório')
    .min(100, 'O conteúdo deve ter no mínimo 100 caracteres'),
  excerpt: z
    .string()
    .max(500, 'O resumo deve ter no máximo 500 caracteres')
    .optional(),
  category: z
    .string()
    .min(1, 'Categoria é obrigatória'),
  tags: z
    .array(z.string())
    .optional(),
  featured_image: z
    .string()
    .url('URL da imagem inválida')
    .optional()
    .or(z.literal('')),
  published: z
    .boolean()
    .default(false),
})

export type CreatePostFormData = z.infer<typeof createPostSchema>
