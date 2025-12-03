import React from 'react';
import { CheckCircle, X } from 'lucide-react';

interface EmailConfirmedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal de confirmação de email bem-sucedida
 */
const EmailConfirmedModal: React.FC<EmailConfirmedModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-confirmed-title"
      >
        {/* Header com botão fechar */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 id="email-confirmed-title" className="text-xl font-semibold text-gray-900">
              E-mail Confirmado!
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
          Seu e-mail foi confirmado com sucesso! Agora você pode fazer login na plataforma.
        </p>

        {/* Botão de fechar */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default EmailConfirmedModal;
