import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Smartphone, AlertCircle, X } from 'lucide-react';
import { authService } from '../services/auth.service';

interface LogoutMenuProps {
  onLogout: () => void;
  onClose: () => void;
}

/**
 * Menu de logout com opção de sair de todos os dispositivos
 */
const LogoutMenu: React.FC<LogoutMenuProps> = ({ onLogout, onClose }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showConfirm) {
          setShowConfirm(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showConfirm, onClose]);

  const handleLogoutHere = () => {
    onLogout();
    onClose();
  };

  const handleLogoutAll = async () => {
    setIsLoading(true);
    setError('');

    try {
      await authService.logoutAll();
      onLogout();
      onClose();
    } catch (err) {
      setError('Erro ao fazer logout em todos os dispositivos');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirm) {
    return (
      <div
        ref={menuRef}
        className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-full">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Confirmar Logout Global</h3>
          </div>
          <button
            onClick={() => setShowConfirm(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem */}
        <p className="text-sm text-gray-600 mb-4">
          Você será desconectado de <strong>todos os dispositivos</strong> onde está logado (computadores, tablets, celulares, etc.).
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleLogoutAll}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saindo...
              </>
            ) : (
              'Confirmar'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
      role="menu"
    >
      {/* Sair deste dispositivo */}
      <button
        onClick={handleLogoutHere}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        role="menuitem"
      >
        <LogOut className="w-5 h-5 text-gray-600" />
        <div>
          <div className="font-medium text-gray-900">Sair</div>
          <div className="text-xs text-gray-500">Apenas deste dispositivo</div>
        </div>
      </button>

      <div className="border-t border-gray-200"></div>

      {/* Sair de todos os dispositivos */}
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        role="menuitem"
      >
        <Smartphone className="w-5 h-5 text-red-600" />
        <div>
          <div className="font-medium text-red-600">Sair de Todos</div>
          <div className="text-xs text-gray-500">Desconectar todos os dispositivos</div>
        </div>
      </button>
    </div>
  );
};

export default LogoutMenu;
