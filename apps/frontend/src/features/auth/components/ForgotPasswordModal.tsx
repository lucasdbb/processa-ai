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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setEmail('');
      setError('');
      setSuccess(false);
      setIsLoading(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/forgot-password`, {
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
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
          aria-label="Fechar modal de recuperação de senha"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 rounded-xl mb-3 text-white">
            <Mail className="h-5 w-5" />
          </div>
          <h2 id="forgot-password-title" className="text-2xl font-bold text-gray-900 tracking-tight">
            Recuperar Senha
          </h2>
          <p className="text-gray-500 mt-1 text-base">
            {success
              ? 'E-mail enviado com sucesso'
              : 'Recupere o acesso à sua conta'
            }
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3" role="alert">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium">
                  Verifique sua caixa de entrada
                </p>
                <p className="text-sm text-green-700 mt-1 leading-relaxed">
                  Enviamos um link de recuperação para <strong>{email}</strong>. Verifique também a pasta de spam.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all shadow-lg shadow-gray-900/20"
            >
              Voltar para o Login
            </button>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3" role="alert">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="recovery-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    type="email"
                    id="recovery-email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-gray-900 focus:border-gray-900 block pl-10 p-2.5 transition-colors ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' : ''}`}
                    placeholder="seu@email.com"
                    aria-describedby={error ? 'email-error' : undefined}
                    aria-invalid={!!error}
                    autoComplete="email"
                  />
                </div>
                {error && (
                  <p id="email-error" className="mt-1 text-sm text-red-600 font-medium" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-gray-900/20"
              >
                {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {isLoading ? 'Enviando Link...' : 'Enviar Link de Recuperação'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 font-semibold text-sm focus:outline-none rounded px-1 inline-flex items-center gap-2 transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
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
