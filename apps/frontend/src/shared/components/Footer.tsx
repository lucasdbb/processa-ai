import React from 'react';
import { Linkedin, Instagram, Facebook } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer: React.FC<{ variant?: 'default' | 'simple' }> = React.memo(({ variant = 'default' }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white border-t border-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* Brand & Copyright */}
          <div className="flex items-center gap-4">
            <Link to="/" onClick={scrollToTop} className="flex items-center gap-2 group">
              <img src="/logo.png" alt="" className="h-6 w-auto object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
              <span className="text-lg font-bold text-gray-400 group-hover:text-gray-900 transition-colors">Processa AI</span>
            </Link>
            <span className="hidden md:block w-px h-4 bg-gray-300"></span>
            <p className="text-sm text-gray-400">
              © 2025. Todos os direitos reservados.
            </p>
          </div>

          {/* Minimal Links */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to="/termos" onClick={scrollToTop} className="hover:text-primary-600 transition-colors">Termos</Link>
            <Link to="/privacidade" onClick={scrollToTop} className="hover:text-primary-600 transition-colors">Privacidade</Link>
            <Link to="/contato" onClick={scrollToTop} className="hover:text-primary-600 transition-colors">Contato</Link>
          </div>

          {/* Social Icons Minimal */}
          <div className="flex gap-4">
            <a href="#" className="text-gray-400 hover:text-primary-600 transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-pink-600 transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
              <Facebook className="w-5 h-5" />
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
