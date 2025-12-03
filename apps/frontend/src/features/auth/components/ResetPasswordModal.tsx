import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useFormValidation } from '../../../shared/hooks/useFormValidation';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
}

/**
 * Reset Password Modal
 * Handles password reset in a modal overlay
 */
const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, accessToken }) => {
  const navigate = useNavigate();
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Form validation
  const { errors, validateForm, clearFieldError } = useFormValidation({
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
      required: true,
      custom: (value: string) => {
        if (value !== password) {
          return 'Senhas não coincidem';
        }
        return null;
      }
    }
  });

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !success) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, success]);

  /**
   * Handles password reset form submission
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous messages
    setError('');

    // Validate form
    if (!validateForm({ password, confirmPassword })) {
      return;
    }

    if (!accessToken) {
      setError('Token de acesso não disponível. Por favor, solicite um novo link de recuperação.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: accessToken,
          new_password: password
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao redefinir senha');
      }

      setSuccess(true);

      // Redirect to home after 3 seconds
      setTimeout(() => {
        onClose();
        navigate('/');
      }, 3000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao processar requisição. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, accessToken, validateForm, navigate, onClose]);

  /**
   * Handles password input changes
   */
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password) clearFieldError('password');
  }, [errors.password, clearFieldError]);

  /**
   * Handles confirm password input changes
   */
  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (errors.confirmPassword) clearFieldError('confirmPassword');
  }, [errors.confirmPassword, clearFieldError]);

  const handleClose = useCallback(() => {
    if (!success) {
      onClose();
    }
  }, [success, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !success) {
      onClose();
    }
  }, [onClose, success]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        {/* Close Button */}
        {!success && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg p-1"
            aria-label="Fechar modal"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <h1 id="reset-password-title" className="text-3xl font-bold text-gray-900">
            Redefinir Senha
          </h1>
          <p className="text-gray-600 mt-2">
            {success ? 'Senha atualizada com sucesso!' : 'Digite sua nova senha'}
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3" role="alert">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium">
                  Sua senha foi redefinida com sucesso!
                </p>
                <p className="text-sm text-green-700 mt-2">
                  Você será redirecionado para a página inicial em alguns segundos...
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                navigate('/');
              }}
              className="w-full btn-primary"
            >
              Ir para Página Inicial
            </button>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2" role="alert">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={handlePasswordChange}
                    className={`input-field pl-10 pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Sua nova senha"
                    aria-describedby={errors.password ? 'password-error' : 'password-help'}
                    aria-invalid={!!errors.password}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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
                {!errors.password && (
                  <p id="password-help" className="mt-1 text-sm text-gray-500">
                    Mínimo 8 caracteres, incluindo maiúscula, minúscula e número
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    className={`input-field pl-10 ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Confirme sua nova senha"
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

              <button
                type="submit"
                disabled={isLoading || !accessToken}
                className="w-full btn-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
