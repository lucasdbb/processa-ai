import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer: React.FC = React.memo(() => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Descrição */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-bold mb-4">Processa AI</h3>
            <p className="text-gray-300 mb-4 max-w-md">
              Plataforma completa para advogados com inteligência artificial,
              calculadoras jurídicas e as últimas notícias do meio jurídico.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-secondary-900 transition-colors">
                <Mail className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-secondary-900 transition-colors">
                <Phone className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Links Rápidos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" onClick={scrollToTop} className="text-gray-300 hover:text-secondary-900 transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link to="/blog" onClick={scrollToTop} className="text-gray-300 hover:text-secondary-900 transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/ia-juridica" onClick={scrollToTop} className="text-gray-300 hover:text-secondary-900 transition-colors">
                  IA Jurídica
                </Link>
              </li>
              <li>
                <Link to="/calculadoras" onClick={scrollToTop} className="text-gray-300 hover:text-secondary-900 transition-colors">
                  Calculadoras
                </Link>
              </li>
              <li>
                <Link to="/sobre" onClick={scrollToTop} className="text-gray-300 hover:text-secondary-900 transition-colors">
                  Sobre
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contato</h3>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2 text-gray-300">
                <Mail className="h-4 w-4" />
                <span>contato@processaai.com</span>
              </li>
              <li className="flex items-center space-x-2 text-gray-300">
                <Phone className="h-4 w-4" />
                <span>(21) 99999-9999</span>
              </li>
              <li className="flex items-center space-x-2 text-gray-300">
                <MapPin className="h-4 w-4" />
                <span>Rio de Janeiro, RJ</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 Processa AI. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;