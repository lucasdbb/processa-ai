import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatTimeRemaining } from '../../../shared/utils/sessionTimeout';

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

/**
 * Modal de aviso de timeout de sessão
 * Aparece 2 minutos antes do logout automático
 */
const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout,
}) => {
  if (!isOpen) return null;

  const formattedTime = formatTimeRemaining(remainingSeconds);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ícone de Aviso */}
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>

        {/* Título */}
        <h2
          id="session-timeout-title"
          className="text-2xl font-bold text-center text-gray-900 mb-2"
        >
          Sessão Expirando
        </h2>

        {/* Mensagem */}
        <p className="text-center text-gray-600 mb-4">
          Você está inativo há algum tempo. Por segurança, sua sessão será encerrada em:
        </p>

        {/* Contador */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-primary-50 rounded-lg px-8 py-4 border-2 border-primary-200">
            <span className="text-4xl font-bold text-primary-700 tabular-nums">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Mensagem adicional */}
        <p className="text-center text-sm text-gray-500 mb-6">
          Clique em "Continuar Conectado" para manter sua sessão ativa ou faça logout agora.
        </p>

        {/* Botões */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            autoFocus
          >
            Continuar Conectado
          </button>
          <button
            onClick={onLogout}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Fazer Logout
          </button>
        </div>

        {/* Info adicional */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Sua sessão expira após 30 minutos de inatividade
        </p>
      </div>
    </div>
  );
};

export default SessionTimeoutWarning;
