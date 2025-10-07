import React, { useState } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onLoginClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLoginClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/logo.svg" alt="Processa AI" className="h-8 w-8 text-navy-800" />
              <span className="text-xl font-bold text-navy-900">Processa AI</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-navy-700 transition-colors">
              Início
            </Link>
            <Link to="/blog" className="text-gray-700 hover:text-navy-700 transition-colors">
              Blog
            </Link>
            <Link to="/tools" className="text-gray-700 hover:text-navy-700 transition-colors">
              Ferramentas
            </Link>
            <Link to="/calculators" className="text-gray-700 hover:text-navy-700 transition-colors">
              Calculadoras
            </Link>
            <Link to="/about" className="text-gray-700 hover:text-navy-700 transition-colors">
              Sobre
            </Link>
          </nav>

          {/* Login Button */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={onLoginClick}
              className="flex items-center space-x-2 btn-primary"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-navy-700"
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
                className="block px-3 py-2 text-gray-700 hover:text-navy-700 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Início
              </Link>
              <Link
                to="/blog"
                className="block px-3 py-2 text-gray-700 hover:text-navy-700 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                to="/tools"
                className="block px-3 py-2 text-gray-700 hover:text-navy-700 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Ferramentas
              </Link>
              <Link
                to="/calculators"
                className="block px-3 py-2 text-gray-700 hover:text-navy-700 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Calculadoras
              </Link>
              <Link
                to="/about"
                className="block px-3 py-2 text-gray-700 hover:text-navy-700 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Sobre
              </Link>
              <button
                onClick={() => {
                  onLoginClick();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-navy-700 font-medium"
              >
                Entrar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;