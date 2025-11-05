import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Auth Callback Page
 * Handles Supabase authentication redirects for:
 * - Email confirmation
 * - Password recovery
 * - Magic link login (future)
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');

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

        // Se houver erro do Supabase, mostrar mensagem específica
        if (error || errorDescription || errorCode) {
          let errorMessage = 'Erro na autenticação';

          if (errorCode === 'otp_expired') {
            errorMessage = 'O link de recuperação expirou. Por favor, solicite um novo link.';
          } else if (error === 'access_denied') {
            errorMessage = 'Acesso negado. O link pode ter expirado ou já foi usado.';
          } else if (errorDescription) {
            errorMessage = decodeURIComponent(errorDescription);
          }

          setError(errorMessage);
          setTimeout(() => navigate('/?error=link_expired'), 5000);
          return;
        }

        // Se não tem tipo, pode estar faltando configuração
        if (!type) {
          console.warn('No type parameter found in callback URL');
          setError('Link de autenticação inválido. Verifique se a URL de redirecionamento está configurada corretamente no Supabase.');
          setTimeout(() => navigate('/'), 5000);
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
              setError('Token de recuperação não encontrado. Por favor, solicite um novo link.');
              setTimeout(() => navigate('/?error=no_token'), 3000);
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
              setError('Token de autenticação não encontrado');
              setTimeout(() => navigate('/'), 3000);
            }
            break;

          default:
            // Tipo desconhecido ou não especificado
            console.warn('Unknown auth callback type:', type);
            navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Error processing auth callback:', err);
        setError('Erro ao processar autenticação. Redirecionando...');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro na Autenticação</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecionando para a página inicial...</p>
          </div>
        </div>
      </div>
    );
  }

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
