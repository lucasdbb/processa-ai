import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, AlertCircle, Loader2, FileText } from 'lucide-react';
import type { LoginModalProps, AuthFormData, DocumentType } from '../types/auth';
import { useFormValidation } from '../../../shared/hooks/useFormValidation';
import { authService, AuthError } from '../services/auth.service';
import { cpfMask, cnpjMask, isValidCpf, isValidCnpj } from '../../../shared/utils/masks';
import { sanitizeName, sanitizeEmail, sanitizeDocument } from '../../../shared/utils/sanitize';
import ForgotPasswordModal from './ForgotPasswordModal';

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
const LoginModal: React.FC<LoginModalProps> = React.memo(({ isOpen, onClose, onLoginSuccess, initialView = 'login' }) => {
  const [isLogin, setIsLogin] = useState<boolean>(initialView === 'login');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [documentType, setDocumentType] = useState<DocumentType>('cpf');
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<AuthFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    documentType: 'cpf',
    documentNumber: ''
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
    },
    documentNumber: {
      required: !isLogin,
      custom: (value: string) => {
        if (isLogin) return null; // Não validar no login
        if (!value || value.trim() === '') return 'Documento é obrigatório';

        const isValid = documentType === 'cpf' ? isValidCpf(value) : isValidCnpj(value);
        if (!isValid) {
          return documentType === 'cpf' ? 'CPF inválido' : 'CNPJ inválido';
        }
        return null;
      }
    }
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens or closes, or when switching modes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // If initialView prop changes while open, we might want to respect it, 
      // but usually we want to respect the user's toggle.
      // For now, let's only reset if it was closed and is now opening.
      // However, the `isLogin` state is initialized from `initialView` prop.
      // If we want to support dynamic changing of initialView while mounted but closed:
      setIsLogin(initialView === 'login');
    } else {
      document.body.style.overflow = 'unset';
    }

    setFormData({
      email: '',
      password: '',
      name: '',
      confirmPassword: '',
      documentType: 'cpf',
      documentNumber: ''
    });
    setApiError('');
    setSuccessMessage('');
    clearErrors();
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, clearErrors, initialView]);

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
      fieldsToValidate.documentNumber = formData.documentNumber || '';
    }

    if (!validateForm(fieldsToValidate)) {
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        await authService.login({
          email: formData.email,
          password: formData.password
        });

        // Buscar dados completos do usuário via /me
        const userData = await authService.getCurrentUser();

        // Chamar callback de sucesso com dados completos do usuário
        onLoginSuccess(userData);

        // Fechar modal após sucesso
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        // Registro
        await authService.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber
        });

        // Mostrar mensagem de sucesso e trocar para modo login
        setSuccessMessage('Solicitação enviada com sucesso! Confirme o seu e-mail.');

      }
    } catch (error) {
      let message = 'Erro ao processar requisição';
      
      if (error instanceof AuthError) {
        message = error.message;
        
        // Se for erro de email já existente durante registro, sugerir login
        if (error.code === 'EMAIL_EXISTS' && !isLogin) {
          setApiError(message);          
          setIsLoading(false);
          return;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLogin, formData, validateForm, onLoginSuccess, onClose]);

  /**
   * Handles input field changes with real-time validation
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Sanitizar e processar valor
    let processedValue = value;

    // Aplicar sanitização específica por tipo de campo
    if (name === 'name') {
      processedValue = sanitizeName(value);
    } else if (name === 'email') {
      processedValue = sanitizeEmail(value);
    } else if (name === 'documentNumber') {
      // Sanitizar antes de aplicar máscara
      const sanitized = sanitizeDocument(value);
      processedValue = documentType === 'cpf' ? cpfMask(sanitized) : cnpjMask(sanitized);
    }

    setFormData({
      ...formData,
      [name]: processedValue
    });

    // Clear field error when user starts typing
    if (errors[name as keyof typeof errors]) {
      clearFieldError(name);
    }
  }, [formData, errors, clearFieldError, documentType]);

  const handleDocumentTypeChange = useCallback((type: DocumentType) => {
    setDocumentType(type);
    setFormData({
      ...formData,
      documentType: type,
      documentNumber: '' // Limpa o campo ao trocar tipo
    });
    clearFieldError('documentNumber');
  }, [formData, clearFieldError]);



  /**
   * Toggles between login and registration modes, clearing form data and errors
   */
  const handleModeToggle = useCallback(() => {
    setIsLogin(!isLogin);
    clearErrors();
    setDocumentType('cpf');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      documentType: 'cpf',
      documentNumber: ''
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
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
          aria-label="Fechar modal de login"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Título */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 rounded-xl mb-3 text-white">
            <User className="h-5 w-5" />
          </div>
          <h2 id="modal-title" className="text-2xl font-bold text-gray-900 tracking-tight">
            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h2>
          <p className="text-gray-500 mt-1 text-base">
            {isLogin 
              ? 'Acesse seu painel jurídico' 
              : 'Comece a transformar sua advocacia'
            }
          </p>
        </div>

        {/* Mensagens de Erro e Sucesso */}
        {apiError && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 mb-6" role="alert">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-700 font-medium">{apiError}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3 mb-6" role="alert">
            <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-green-700 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                <input
                  ref={!isLogin ? firstInputRef : undefined}
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${errors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' : ''}`}
                  placeholder="Seu nome completo"
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  aria-invalid={!!errors.name}
                />
              </div>
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600 font-medium" role="alert">
                  {errors.name}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
              <input
                ref={isLogin ? firstInputRef : undefined}
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' : ''}`}
                placeholder="seu@email.com"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600 font-medium" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          {/* Campo de Documento (CPF/CNPJ) - Apenas no registro */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Documento
              </label>

              <div className="flex gap-2.5">
                {/* Toggle CPF/CNPJ */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-1/3">
                  <button
                    type="button"
                    onClick={() => handleDocumentTypeChange('cpf')}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                      documentType === 'cpf'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    CPF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDocumentTypeChange('cnpj')}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                      documentType === 'cnpj'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    CNPJ
                  </button>
                </div>

                {/* Campo de documento */}
                <div className="flex-1">
                  <input
                    type="text"
                    id="documentNumber"
                    name="documentNumber"
                    value={formData.documentNumber}
                    onChange={handleInputChange}
                    placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                    className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block p-2.5 transition-colors ${errors.documentNumber ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' : ''}`}
                    aria-describedby={errors.documentNumber ? 'document-error' : undefined}
                    aria-invalid={!!errors.documentNumber}
                  />
                </div>
              </div>
              {errors.documentNumber && (
                <p id="document-error" className="mt-1 text-sm text-red-600 font-medium" role="alert">
                  {errors.documentNumber}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 pr-10 p-2.5 transition-colors ${errors.password ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' : ''}`}
                placeholder="••••••••"
                aria-describedby={errors.password ? 'password-error' : 'password-help'}
                aria-invalid={!!errors.password}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
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
              <p id="password-error" className="mt-1 text-sm text-red-600 font-medium" role="alert">
                {errors.password}
              </p>
            )}
            {!errors.password && !isLogin && (
              <p id="password-help" className="mt-1 text-xs text-gray-500">
                Mínimo 8 caracteres, maiúscula, minúscula e número
              </p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' : ''}`}
                  placeholder="••••••••"
                  aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  aria-invalid={!!errors.confirmPassword}
                  autoComplete="new-password"
                />
              </div>
              {errors.confirmPassword && (
                <p id="confirm-password-error" className="mt-1 text-sm text-red-600 font-medium" role="alert">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-gray-900/20 !mt-6"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {isLoading ? 'Processando...' : (isLogin ? 'Entrar na Plataforma' : 'Criar Conta Gratuita')}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-4 space-y-4">
          {/* Forgot Password */}
          {isLogin && (
            <div className="text-center">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>
          )}

          {/* Toggle Login/Registro */}
          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-gray-600 text-sm">
              {isLogin ? 'Ainda não tem uma conta?' : 'Já possui cadastro?'}
              <button
                onClick={handleModeToggle}
                className="text-gray-900 hover:text-black font-bold ml-1.5 transition-colors"
              >
                {isLogin ? 'Cadastre-se gratuitamente' : 'Fazer login'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
});

LoginModal.displayName = 'LoginModal';

export default LoginModal;