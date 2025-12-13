import React, { useEffect } from 'react';
import { AlertCircle, X, Loader2 } from 'lucide-react';

interface LogoutMenuProps {
  onLogout: () => void;
  onClose: () => void;
}

/**
 * Modal de confirmação de logout centralizado
 */
const LogoutMenu: React.FC<LogoutMenuProps> = ({ onLogout, onClose }) => {
  const [isLoading, setIsLoading] = React.useState(false);

  // Fechar com ESC e bloquear scroll
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleConfirmLogout = async () => {
    setIsLoading(true);
    try {
      await onLogout();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-xl mb-4 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Confirmar Logout</h3>
          <p className="text-gray-500 mt-2 text-base">
            Tem certeza que deseja sair da sua conta?
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmLogout}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-gray-200 shadow-lg shadow-gray-900/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saindo...
              </>
            ) : (
              'Sair'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutMenu;
