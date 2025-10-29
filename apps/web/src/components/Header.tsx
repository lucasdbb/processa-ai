import React, { useState, useCallback } from 'react';
import { Menu, X, LogIn, User, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import UserMenu from './UserMenu';

interface HeaderProps {
  user?: {
    id: string;
    email: string;
    name?: string;
  } | null;
  onLoginClick: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = React.memo(({ user, onLoginClick, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const getLinkClasses = (path: string) => {
    return isActive(path)
      ? 'relative text-primary-700 font-semibold transition-colors after:absolute after:bottom-[-8px] after:left-0 after:right-0 after:h-0.5 after:bg-primary-700'
      : 'text-gray-700 hover:text-primary-700 hover:font-medium transition-all duration-200';
  };

  const getMobileLinkClasses = (path: string) => {
    return isActive(path)
      ? 'block px-3 py-2 text-primary-700 font-semibold bg-primary-50 rounded-lg transition-colors'
      : 'block px-3 py-2 text-gray-700 hover:text-primary-700 hover:bg-warm-bg rounded-lg transition-all duration-200';
  };

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const handleLoginClick = useCallback(() => {
    onLoginClick();
  }, [onLoginClick]);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="flex items-center hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg"
              aria-label="Processa AI - Página inicial"
            >
              <img 
                src="/logo.svg" 
                alt="Processa AI - Plataforma de soluções jurídicas com inteligência artificial" 
                className="h-12 w-auto object-contain" 
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav id="main-navigation" className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Navegação principal">
            <Link 
              to="/" 
              className={`${getLinkClasses('/')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              Início
            </Link>
            <Link 
              to="/blog" 
              className={`${getLinkClasses('/blog')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1`}
              aria-current={isActive('/blog') ? 'page' : undefined}
            >
              Blog
            </Link>
            <Link 
              to="/ferramentas" 
              className={`${getLinkClasses('/ferramentas')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1`}
              aria-current={isActive('/ferramentas') ? 'page' : undefined}
            >
              Ferramentas
            </Link>
            <Link 
              to="/calculadoras" 
              className={`${getLinkClasses('/calculadoras')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1`}
              aria-current={isActive('/calculadoras') ? 'page' : undefined}
            >
              Calculadoras
            </Link>
            <Link 
              to="/sobre" 
              className={`${getLinkClasses('/sobre')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1`}
              aria-current={isActive('/sobre') ? 'page' : undefined}
            >
              Sobre
            </Link>
          </nav>

          {/* Login Button / User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <UserMenu user={user} onLogout={onLogout} />
            ) : (
              <button
                onClick={handleLoginClick}
                className="flex items-center space-x-2 btn-primary hover:shadow-lg transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label="Fazer login na plataforma"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Entrar</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={handleMenuToggle}
              className="text-gray-700 hover:text-primary-700 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden" id="mobile-menu">
            <nav 
              className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200" 
              role="navigation" 
              aria-label="Navegação móvel"
            >
              <Link
                to="/"
                className={`${getMobileLinkClasses('/')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/') ? 'page' : undefined}
              >
                Início
              </Link>
              <Link
                to="/blog"
                className={`${getMobileLinkClasses('/blog')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/blog') ? 'page' : undefined}
              >
                Blog
              </Link>
              <Link
                to="/ferramentas"
                className={`${getMobileLinkClasses('/ferramentas')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/ferramentas') ? 'page' : undefined}
              >
                Ferramentas
              </Link>
              <Link
                to="/calculadoras"
                className={`${getMobileLinkClasses('/calculadoras')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/calculadoras') ? 'page' : undefined}
              >
                Calculadoras
              </Link>
              <Link
                to="/sobre"
                className={`${getMobileLinkClasses('/sobre')} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/sobre') ? 'page' : undefined}
              >
                Sobre
              </Link>
              {user ? (
                <>
                  {/* User info in mobile menu */}
                  <div className="px-3 py-2 border-t border-gray-200 mt-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {(user.name || user.email.split('@')[0]).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.name || user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* User menu options */}
                  <button
                    onClick={() => {
                      // TODO: Implementar navegação para perfil
                      console.log('Navegar para perfil');
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span>Perfil</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      // TODO: Implementar navegação para configurações
                      console.log('Navegar para configurações');
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <div className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      <span>Configurações</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      onLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <div className="flex items-center space-x-2">
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span>Sair</span>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onLoginClick();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-white bg-primary-700 hover:bg-primary-800 font-medium rounded-lg transition-colors duration-200 mt-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  aria-label="Fazer login na plataforma"
                >
                  <div className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    <span>Entrar</span>
                  </div>
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;