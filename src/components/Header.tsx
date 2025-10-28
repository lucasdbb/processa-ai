import React, { useState } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  onLoginClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLoginClick }) => {
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
      : 'block px-3 py-2 text-gray-700 hover:text-primary-700 hover:bg-gray-50 rounded-lg transition-all duration-200';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Processa AI" className="h-8 w-8 text-navy-800" />
              <span className="text-xl font-bold text-primary-900">Processa AI</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className={getLinkClasses('/')}>
              Início
            </Link>
            <Link to="/blog" className={getLinkClasses('/blog')}>
              Blog
            </Link>
            <Link to="/ferramentas" className={getLinkClasses('/ferramentas')}>
              Ferramentas
            </Link>
            <Link to="/calculadoras" className={getLinkClasses('/calculadoras')}>
              Calculadoras
            </Link>
            <Link to="/sobre" className={getLinkClasses('/sobre')}>
              Sobre
            </Link>
          </nav>

          {/* Login Button */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={onLoginClick}
              className="flex items-center space-x-2 btn-primary hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-primary-700 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              <Link
                to="/"
                className={getMobileLinkClasses('/')}
                onClick={() => setIsMenuOpen(false)}
              >
                Início
              </Link>
              <Link
                to="/blog"
                className={getMobileLinkClasses('/blog')}
                onClick={() => setIsMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                to="/ferramentas"
                className={getMobileLinkClasses('/ferramentas')}
                onClick={() => setIsMenuOpen(false)}
              >
                Ferramentas
              </Link>
              <Link
                to="/calculadoras"
                className={getMobileLinkClasses('/calculadoras')}
                onClick={() => setIsMenuOpen(false)}
              >
                Calculadoras
              </Link>
              <Link
                to="/sobre"
                className={getMobileLinkClasses('/sobre')}
                onClick={() => setIsMenuOpen(false)}
              >
                Sobre
              </Link>
              <button
                onClick={() => {
                  onLoginClick();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-white bg-primary-700 hover:bg-primary-800 font-medium rounded-lg transition-colors duration-200 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <LogIn className="h-4 w-4" />
                  <span>Entrar</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;