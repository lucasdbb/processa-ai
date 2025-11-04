/**
 * Central type definitions export for the Processa AI application
 * 
 * This file provides a single entry point for importing all type definitions
 * used throughout the application, improving developer experience and
 * maintaining consistency.
 * 
 * @example
 * ```typescript
 * import { User, BlogPost, CalculatorFormData } from '@/types';
 * ```
 */

// Authentication types
export type {
  AuthMode,
  UserRole,
  AuthStatus,
  AuthFormData,
  AuthFormErrors,
  User,
  AuthContextState,
  AuthContextActions,
  AuthContext,
  LoginModalProps,
  AuthFormProps,
  ProtectedRouteProps,
  AuthResponse,
  PasswordRequirements,
  EmailValidation,
  PasswordValidation
} from '@/features/auth/types/auth';

// Blog types
export type {
  BlogCategory,
  BlogTag,
  BlogCategoryId,
  BlogPost,
  BlogFilterProps,
  BlogPostCardProps
} from '@/features/blog/types/blog';

// Calculator types
export type {
  TipoRescisao,
  Sexo,
  TipoAposentadoria,
  CalculatorType,
  CalculatorFormData,
  DetalhesRescisao,
  DetalhesAposentadoria,
  ResultadoRescisao,
  ResultadoAposentadoria,
  Resultado,
  CalculatorConfig,
  CalculatorInputProps,
  CalculatorResultProps
} from '@/features/calculators/types/calculator';

// Common utility types
export type {
  ApiResponse,
  LoadingState,
  ErrorState,
  PaginationParams,
  SortOrder,
  FilterParams
} from './common';