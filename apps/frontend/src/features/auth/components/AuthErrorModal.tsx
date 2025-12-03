import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface AuthErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
  errorType?: string;
}

/**
 * Modal de erro de autenticação
 */
const AuthErrorModal: React.FC<AuthErrorModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
  errorType
}) => {
  if (!isOpen) return null;

  // Mensagens personalizadas baseadas no tipo de erro
  const getTitle = () => {
    switch (errorType) {
      case 'link_expired':
        return 'Link Expirado';
      case 'access_denied':
        return 'Acesso Negado';
      case 'invalid_link':
        return 'Link Inválido';
      case 'no_token':
        return 'Token Não Encontrado';
      default:
        return 'Erro na Autenticação';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-error-title"
      >
        {/* Header com botão fechar */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 id="auth-error-title" className="text-xl font-semibold text-gray-900">
              {getTitle()}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mensagem */}
        <p className="text-gray-600 mb-6">
          {errorMessage}
        </p>

        {/* Botão de fechar */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default AuthErrorModal;
