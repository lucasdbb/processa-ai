import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import type { LoginModalProps, AuthFormData } from '../types/auth';
import { useFormValidation } from '../hooks/useFormValidation';
import { authService } from '../services/auth.service';

/**
 * Modal component for user authentication (login/registration)
 * Features form validation, accessibility support, and keyboard navigation
 * 
 * @example
 * ```tsx
 * <LoginModal 
 *   isOpen={showModal} 
 *   onClose={() => setShowModal(false)}
 *   onLogin={(userData) => handleLogin(userData)}
 * />
 * ```
 */
const LoginModal: React.FC<LoginModalProps> = React.memo(({ isOpen, onClose, onLogin }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [formData, setFormData] = useState<AuthFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Form validation setup
  const {
    errors,
    validateForm,
    clearFieldError,
    clearErrors
  } = useFormValidation({
    name: {
      required: !isLogin,
      minLength: 2,
      maxLength: 50
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      custom: (value: string) => {
        if (!value.trim()) return 'E-mail é obrigatório';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'E-mail inválido';
        return null;
      }
    },
    password: {
      required: true,
      minLength: 8,
      custom: (value: string) => {
        if (!value) return 'Senha é obrigatória';
        if (value.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
        if (!/[A-Z]/.test(value)) return 'Senha deve conter pelo menos uma letra maiúscula';
        if (!/[a-z]/.test(value)) return 'Senha deve conter pelo menos uma letra minúscula';
        if (!/[0-9]/.test(value)) return 'Senha deve conter pelo menos um número';
        return null;
      }
    },
    confirmPassword: {
      required: !isLogin,
      custom: (value: string) => {
        if (!isLogin && value !== formData.password) {
          return 'Senhas não coincidem';
        }
        return null;
      }
    }
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isOpen, isLogin]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  /**
   * Handles form submission for both login and registration
   * @param {React.FormEvent} e - Form submission event
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Limpar mensagens anteriores
    setApiError('');
    setSuccessMessage('');

    // Validate form using the new validation system
    const fieldsToValidate: Record<string, string> = {};

    if (isLogin) {
      fieldsToValidate.email = formData.email || '';
      fieldsToValidate.password = formData.password || '';
    } else {
      fieldsToValidate.name = formData.name || '';
      fieldsToValidate.email = formData.email || '';
      fieldsToValidate.password = formData.password || '';
      fieldsToValidate.confirmPassword = formData.confirmPassword || '';
    }

    if (!validateForm(fieldsToValidate)) {
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const response = await authService.login({
          email: formData.email,
          password: formData.password
        });

        // Chamar callback de sucesso
        onLogin(formData.email, formData.password);

        // Fechar modal após sucesso
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        // Registro
        await authService.register({
          email: formData.email,
          password: formData.password,
          name: formData.name
        });

        // Mostrar mensagem de sucesso e trocar para modo login
        setSuccessMessage('Conta criada com sucesso! Faça login para continuar.');

        // Limpar senha e alternar para login após 2 segundos
        setTimeout(() => {
          setSuccessMessage('');
          setIsLogin(true);
          setFormData({
            ...formData,
            password: '',
            confirmPassword: ''
          });
        }, 2000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar requisição';
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLogin, formData, validateForm, onLogin, onClose]);

  /**
   * Handles input field changes with real-time validation
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear field error when user starts typing
    if (errors[name as keyof typeof errors]) {
      clearFieldError(name);
    }
  }, [formData, errors, clearFieldError]);



  /**
   * Toggles between login and registration modes, clearing form data and errors
   */
  const handleModeToggle = useCallback(() => {
    setIsLogin(!isLogin);
    clearErrors();
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  }, [isLogin, clearErrors]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleTogglePassword = useCallback(() => {
    setShowPassword(!showPassword);
  }, [showPassword]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg p-1"
          aria-label="Fechar modal de login"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Título */}
        <div className="text-center mb-6">
          <h2 id="modal-title" className="text-2xl font-bold text-gray-900">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </h2>
          <p className="text-gray-600 mt-2">
            {isLogin 
              ? 'Acesse sua conta na Processa AI' 
              : 'Crie sua conta e comece a usar nossas ferramentas'
            }
          </p>
        </div>

        {/* Mensagens de Erro e Sucesso */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2" role="alert">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-800">{apiError}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2" role="alert">
            <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                <input
                  ref={!isLogin ? firstInputRef : undefined}
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`input-field pl-10 ${errors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Seu nome completo"
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  aria-invalid={!!errors.name}
                />
              </div>
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.name}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
              <input
                ref={isLogin ? firstInputRef : undefined}
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`input-field pl-10 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="seu@email.com"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`input-field pl-10 pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Sua senha"
                aria-describedby={errors.password ? 'password-error' : 'password-help'}
                aria-invalid={!!errors.password}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded p-1"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.password}
              </p>
            )}
            {!errors.password && !isLogin && (
              <p id="password-help" className="mt-1 text-sm text-gray-500">
                Mínimo 8 caracteres, incluindo maiúscula, minúscula e número
              </p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`input-field pl-10 ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Confirme sua senha"
                  aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  aria-invalid={!!errors.confirmPassword}
                  autoComplete="new-password"
                />
              </div>
              {errors.confirmPassword && (
                <p id="confirm-password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {isLoading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        {/* Toggle Login/Registro */}
        <div className="text-center mt-4">
          <p className="text-gray-600">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
              onClick={handleModeToggle}
              className="text-primary-600 hover:text-primary-700 font-medium ml-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-1"
            >
              {isLogin ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
});

LoginModal.displayName = 'LoginModal';

export default LoginModal;