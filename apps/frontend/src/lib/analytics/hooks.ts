import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from './index';

/**
 * Hook para rastrear visualizações de página automaticamente.
 * Deve ser usado no componente raiz ou layout principal que esteja dentro do Router.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Rastreia a mudança de rota
    // O setTimeout garante que o título da página já tenha sido atualizado (se houver lógica para isso)
    // e evita bloqueios na renderização principal
    const timeoutId = setTimeout(() => {
      analytics.pageView(location.pathname + location.search);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [location]);
}
