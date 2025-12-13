import React, { useState, useCallback, useEffect } from 'react';
import { Menu, X, LogIn, User, Settings, LogOut, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import UserMenu from '../../features/auth/components/UserMenu';
import type { User as UserType } from '../../features/auth';

interface HeaderProps {
  user?: UserType | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onUpdateProfile: (updatedUser: Partial<UserType>) => Promise<void>;
}

const Header: React.FC<HeaderProps> = React.memo(({ user, onLoginClick, onLogout, onUpdateProfile }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const getLinkClasses = (path: string) => {
    const active = isActive(path);
    return `text-sm font-medium transition-colors duration-200 ${
      active 
        ? 'text-primary-700' 
        : 'text-gray-600 hover:text-primary-600'
    }`;
  };

  const getMobileLinkClasses = (path: string) => {
    return isActive(path)
      ? 'block px-4 py-3 text-primary-700 font-semibold bg-primary-50 rounded-xl transition-colors'
      : 'block px-4 py-3 text-gray-600 hover:text-primary-700 hover:bg-gray-50 rounded-xl transition-all duration-200';
  };

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const handleLoginClick = useCallback(() => {
    onLoginClick();
  }, [onLoginClick]);

  const prefetchRoute = useCallback((path: string) => {
    switch (path) {
      case '/blog':
        import('@/features/blog/components/BlogPage');
        break;
      case '/ia-juridica':
        import('@/features/ai-chat/components/IAJuridicaPage');
        break;
      case '/calculadoras':
        import('@/features/calculators/components/CalculatorsPage');
        break;
      case '/planos':
        import('@/pages/PlanosPage');
        break;
      case '/sobre':
        import('@/pages/AboutPage');
        break;
      default:
        import('@/pages/LandingPage');
    }
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        isScrolled || isMenuOpen 
          ? 'bg-white/80 backdrop-blur-md border-gray-200 shadow-sm' 
          : 'bg-white/0 border-transparent'
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="flex items-center hover:opacity-80 transition-opacity focus:outline-none rounded-lg"
              aria-label="Processa AI - Página inicial"
            >
              <img 
                src="/logo.png" 
                alt="Processa AI" 
                className="h-10 w-auto object-contain" 
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav id="main-navigation" className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Navegação principal">
            <Link 
              to="/" 
              className={getLinkClasses('/')}
              aria-current={isActive('/') ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute('/')}
            >
              Início
            </Link>
            <Link 
              to="/blog" 
              className={getLinkClasses('/blog')}
              aria-current={isActive('/blog') ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute('/blog')}
            >
              Blog
            </Link>
            <Link 
              to="/ia-juridica" 
              className={getLinkClasses('/ia-juridica')}
              aria-current={isActive('/ia-juridica') ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute('/ia-juridica')}
            >
              IA Jurídica
            </Link>
            <Link 
              to="/calculadoras" 
              className={getLinkClasses('/calculadoras')}
              aria-current={isActive('/calculadoras') ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute('/calculadoras')}
            >
              Calculadoras
            </Link>
            <Link 
              to="/planos" 
              className={getLinkClasses('/planos')}
              aria-current={isActive('/planos') ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute('/planos')}
            >
              Planos
            </Link>
            <Link 
              to="/sobre" 
              className={getLinkClasses('/sobre')}
              aria-current={isActive('/sobre') ? 'page' : undefined}
              onMouseEnter={() => prefetchRoute('/sobre')}
            >
              Sobre
            </Link>
          </nav>

          {/* Login Button / User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <UserMenu user={user} onLogout={onLogout} onUpdateProfile={onUpdateProfile} />
            ) : (
              <button
                onClick={handleLoginClick}
                className="group relative inline-flex items-center justify-center px-6 py-2 text-sm font-semibold text-white transition-all duration-200 bg-gray-900 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                aria-label="Fazer login na plataforma"
              >
                Entrar
                <div className="absolute inset-0 -z-10 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition-all" />
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={handleMenuToggle}
              className="text-gray-700 hover:text-gray-900 p-2 rounded-lg transition-all duration-200 focus:outline-none"
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
          <div className="md:hidden absolute top-20 left-0 right-0 bg-white border-b border-gray-100 shadow-xl animate-in slide-in-from-top-5 duration-200" id="mobile-menu">
            <nav 
              className="px-4 pt-4 pb-6 space-y-2 max-h-[calc(100vh-5rem)] overflow-y-auto" 
              role="navigation" 
              aria-label="Navegação móvel"
            >
              <Link
                to="/"
                className={getMobileLinkClasses('/')}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/') ? 'page' : undefined}
              >
                Início
              </Link>
              <Link
                to="/blog"
                className={getMobileLinkClasses('/blog')}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/blog') ? 'page' : undefined}
              >
                Blog
              </Link>
              <Link
                to="/ia-juridica"
                className={getMobileLinkClasses('/ia-juridica')}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/ia-juridica') ? 'page' : undefined}
              >
                IA Jurídica
              </Link>
              <Link
                to="/calculadoras"
                className={getMobileLinkClasses('/calculadoras')}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/calculadoras') ? 'page' : undefined}
              >
                Calculadoras
              </Link>
              <Link
                to="/planos"
                className={getMobileLinkClasses('/planos')}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/planos') ? 'page' : undefined}
              >
                Planos
              </Link>
              <Link
                to="/sobre"
                className={getMobileLinkClasses('/sobre')}
                onClick={() => setIsMenuOpen(false)}
                aria-current={isActive('/sobre') ? 'page' : undefined}
              >
                Sobre
              </Link>

              <div className="pt-4 mt-4 border-t border-gray-100">
                {user ? (
                  <>
                    <div className="px-4 py-3 flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm">
                        {(user.name || user.email.split('@')[0]).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {user.name || user.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        console.log('Navegar para perfil');
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors duration-200 flex items-center justify-between group"
                    >
                      <span className="flex items-center gap-3">
                        <User className="h-5 w-5 text-gray-400 group-hover:text-primary-600" />
                        Perfil
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                    
                    <button
                      onClick={() => {
                        console.log('Navegar para configurações');
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors duration-200 flex items-center justify-between group"
                    >
                      <span className="flex items-center gap-3">
                        <Settings className="h-5 w-5 text-gray-400 group-hover:text-primary-600" />
                        Configurações
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                    
                    <button
                      onClick={() => {
                        onLogout();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200 flex items-center gap-3 mt-2"
                    >
                      <LogOut className="h-5 w-5" />
                      Sair
                    </button>
                  </>
                ) : (
                  <div className="px-4 pb-2">
                    <button
                      onClick={() => {
                        onLoginClick();
                        setIsMenuOpen(false);
                      }}
                      className="w-full py-3 text-white bg-gray-900 hover:bg-gray-800 font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10"
                    >
                      <LogIn className="h-5 w-5" />
                      Entrar na Plataforma
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
