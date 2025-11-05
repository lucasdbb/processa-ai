import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { sanitizeEmail } from '../../../shared/utils/sanitize';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal component for password recovery
 * Allows users to request a password reset email
 */
const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = React.memo(({ isOpen, onClose }) => {
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setError('');
      setSuccess(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  /**
   * Handles form submission for password recovery
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous messages
    setError('');

    // Validate email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      setError('E-mail é obrigatório');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      setError('E-mail inválido');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: sanitizedEmail }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao solicitar recuperação de senha');
      }

      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao processar requisição. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  /**
   * Handles email input changes
   */
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeEmail(e.target.value);
    setEmail(sanitized);
    if (error) setError('');
  }, [error]);

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
      aria-labelledby="forgot-password-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg p-1"
          aria-label="Fechar modal de recuperação de senha"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 id="forgot-password-title" className="text-2xl font-bold text-gray-900">
            Recuperar Senha
          </h2>
          <p className="text-gray-600 mt-2">
            {success
              ? 'E-mail de recuperação enviado!'
              : 'Digite seu e-mail para receber o link de recuperação'
            }
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3" role="alert">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium">
                  Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
                </p>
                <p className="text-sm text-green-700 mt-2">
                  Verifique sua caixa de entrada e também a pasta de spam.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full btn-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Fechar
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
                <label htmlFor="recovery-email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    type="email"
                    id="recovery-email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    className={`input-field pl-10 ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="seu@email.com"
                    aria-describedby={error ? 'email-error' : undefined}
                    aria-invalid={!!error}
                    autoComplete="email"
                  />
                </div>
                {error && (
                  <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="text-center mt-4">
              <button
                onClick={onClose}
                className="text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-1 inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para o login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

ForgotPasswordModal.displayName = 'ForgotPasswordModal';

export default ForgotPasswordModal;
