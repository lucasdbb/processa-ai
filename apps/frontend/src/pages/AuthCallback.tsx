import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Auth Callback Page
 * Handles Supabase authentication redirects for:
 * - Email confirmation
 * - Password recovery
 * - Magic link login (future)
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const processAuthCallback = () => {
      try {
        // Supabase pode enviar tokens de duas formas:
        // 1. Hash fragment: #access_token=...&type=recovery
        // 2. Query params: ?token=...&type=recovery

        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);

        let params = new URLSearchParams(hash || search);

        const type = params.get('type');
        const accessToken = params.get('access_token');
        const token = params.get('token');
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');
        const error = params.get('error');

        console.log('Auth callback params:', {
          type,
          hasAccessToken: !!accessToken,
          hasToken: !!token,
          error,
          errorCode,
          errorDescription
        });

        // Se houver erro do Supabase, redirecionar com parâmetro de erro
        if (error || errorDescription || errorCode) {
          let errorMessage = 'Erro na autenticação';
          let errorType = 'auth_error';

          if (errorCode === 'otp_expired') {
            errorMessage = 'O link de recuperação expirou. Por favor, solicite um novo link.';
            errorType = 'link_expired';
          } else if (error === 'access_denied') {
            errorMessage = 'Acesso negado. O link pode ter expirado ou já foi usado.';
            errorType = 'access_denied';
          } else if (errorDescription) {
            errorMessage = decodeURIComponent(errorDescription);
          }

          navigate(`/?auth_error=true&error_type=${errorType}&error_message=${encodeURIComponent(errorMessage)}`, { replace: true });
          return;
        }

        // Se não tem tipo, pode estar faltando configuração
        if (!type) {
          console.warn('No type parameter found in callback URL');
          navigate(`/?auth_error=true&error_type=invalid_link&error_message=${encodeURIComponent('Link de autenticação inválido. Verifique se a URL de redirecionamento está configurada corretamente no Supabase.')}`, { replace: true });
          return;
        }

        switch (type) {
          case 'recovery':
            // Password recovery - redirecionar para página de reset com token
            if (accessToken) {
              // Token no hash fragment (mais comum)
              console.log('Redirecting to reset password with access token');
              navigate(`/reset-password#access_token=${accessToken}&type=recovery`, { replace: true });
            } else if (token) {
              // Token em query param (menos comum, mas pode acontecer)
              console.log('Redirecting to reset password with token');
              navigate(`/reset-password?token=${token}&type=recovery`, { replace: true });
            } else {
              navigate(`/?auth_error=true&error_type=no_token&error_message=${encodeURIComponent('Token de recuperação não encontrado. Por favor, solicite um novo link.')}`, { replace: true });
            }
            break;

          case 'signup':
          case 'email_change':
          case 'invite':
            // Email confirmation - mostrar sucesso e redirecionar
            navigate('/?confirmed=true', { replace: true });
            break;

          case 'magiclink':
            // Magic link login (futuro)
            if (accessToken) {
              // Aqui você pode fazer auto-login com o token
              navigate('/dashboard', { replace: true });
            } else {
              navigate(`/?auth_error=true&error_type=no_token&error_message=${encodeURIComponent('Token de autenticação não encontrado')}`, { replace: true });
            }
            break;

          default:
            // Tipo desconhecido ou não especificado
            console.warn('Unknown auth callback type:', type);
            navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Error processing auth callback:', err);
        navigate(`/?auth_error=true&error_type=processing_error&error_message=${encodeURIComponent('Erro ao processar autenticação')}`, { replace: true });
      }
    };

    processAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Processando...</h1>
          <p className="text-gray-600">Aguarde enquanto validamos sua autenticação.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
