import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Header, ErrorBoundary, FooterWrapper } from './shared';
import { LoginModal, SessionTimeoutWarning, EmailConfirmedModal, AuthErrorModal, ResetPasswordModal, authService } from './features/auth';
import type { User } from './features/auth';
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const BlogPage = lazy(() => import('@/features/blog/components/BlogPage'));
const AdminPanel = lazy(() => import('@/features/blog/components/AdminPanel'));
const CreatePostPage = lazy(() => import('@/features/blog/components/CreatePostPage'));
const IAJuridicaPage = lazy(() => import('@/features/ai-chat/components/IAJuridicaPage'));
const CalculatorsPage = lazy(() => import('@/features/calculators/components/CalculatorsPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const PlanosPage = lazy(() => import('@/pages/PlanosPage'));
import { getSessionTimeoutManager } from './shared/utils/sessionTimeout';

/**
 * Main application component that handles routing, authentication, and global state
 * Provides error boundary protection and accessibility features
 */
function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTimeoutWarningOpen, setIsTimeoutWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const [isEmailConfirmedModalOpen, setIsEmailConfirmedModalOpen] = useState(false);
  const [authError, setAuthError] = useState<{ message: string; type: string } | null>(null);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string>('');

  // Check if user is already authenticated on app load
  const hasCheckedAuthRef = useRef(false);
  useEffect(() => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;

    const checkAuthStatus = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Gerenciador de timeout de sessão
  useEffect(() => {
    // Só iniciar timeout se usuário estiver autenticado
    if (!user) return;

    const timeoutManager = getSessionTimeoutManager();

    // Callback quando timeout ocorre (fazer logout)
    const handleTimeout = () => {
      console.log('[App] Sessão expirou por inatividade');
      setIsTimeoutWarningOpen(false);
      handleLogout();
    };

    // Callback quando aviso de timeout é ativado
    const handleWarning = (seconds: number) => {
      setRemainingSeconds(seconds);
      setIsTimeoutWarningOpen(true);
    };

    // Iniciar gerenciador
    timeoutManager.start(handleTimeout, handleWarning);

    // Cleanup ao desmontar ou quando usuário faz logout
    return () => {
      timeoutManager.stop();
    };
  }, [user]); // Reiniciar quando user mudar

  /**
   * Protected route component that redirects unauthenticated users to home page
   * @param {Object} props - Component props
   * @param {boolean} props.isAuthenticated - Whether user is authenticated
   * @param {JSX.Element} props.children - Child components to render if authenticated
   * @returns {JSX.Element} Protected content or redirect
   */
  const ProtectedRoute = ({
    isAuthenticated,
    children,
  }: {
    isAuthenticated: boolean;
    children: React.ReactElement;
  }) => {
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  /**
   * Admin route component that redirects non-admin users to dashboard
   * @param {Object} props - Component props
   * @param {User | null} props.user - Current user
   * @param {JSX.Element} props.children - Child components to render if admin
   * @returns {JSX.Element} Protected content or redirect
   */
  const AdminRoute = ({
    user,
    children,
  }: {
    user: User | null;
    children: React.ReactElement;
  }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    if (user.role !== 'admin') {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  const AuthorOrAdminRoute = ({
    user,
    children,
  }: {
    user: User | null;
    children: React.ReactElement;
  }) => {
    if (!user) {
      return <Navigate to="/" replace />;
    }
    if (user.role !== 'admin' && user.role !== 'author') {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  /**
   * Handles successful login by updating user state
   * @param {User} userData - User data from successful login
   */
  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setIsLoginModalOpen(false);
  };

  /**
   * Handles user logout by clearing user state and calling logout service
   */
  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsTimeoutWarningOpen(false);
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails, clear local state
      setUser(null);
      setIsTimeoutWarningOpen(false);
    }
  }, []);

  /**
   * Estende a sessão quando usuário clica em "Continuar Conectado"
   */
  const handleExtendSession = useCallback(() => {
    const timeoutManager = getSessionTimeoutManager();
    timeoutManager.extendSession();
    setIsTimeoutWarningOpen(false);
  }, []);

  /**
   * Handles profile update by calling the API and updating local state
   * @param {Partial<User>} updatedData - Updated user data
   */
  const handleUpdateProfile = async (updatedData: Partial<User>) => {
    if (!user) return;
    
    try {
      
      // Call API to update user profile
      const response = await authService.updateProfile({
        name: updatedData.name,
        email: updatedData.email,
        avatar_url: updatedData.avatar_url || undefined,
        phone: updatedData.phone,
        documentType: updatedData.documentType,
        documentNumber: updatedData.documentNumber,
        newsletter_opt_in: updatedData.newsletter_opt_in
      });

      // Update local state with the response from the API
      // Backend retorna o perfil diretamente, não dentro de { user: ... }
      const updatedUser: User = {
        ...user,
        name: response.name,
        avatar_url: response.avatar_url || undefined,
        phone: response.phone || undefined,
        documentType: response.document_type as 'cpf' | 'cnpj' | undefined,
        documentNumber: response.document_number || undefined,
        newsletter_opt_in: response.newsletter_opt_in
      };

      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-700"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <EmailConfirmationHandler onEmailConfirmed={() => setIsEmailConfirmedModalOpen(true)} />
        <AuthErrorHandler
          onAuthError={(message, type) => setAuthError({ message, type })}
        />
        <ResetPasswordHandler
          onResetPassword={(token) => {
            setResetPasswordToken(token);
            setIsResetPasswordModalOpen(true);
          }}
        />
        <div className="min-h-screen flex flex-col">
          {/* Skip Navigation Links */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-700 text-white px-4 py-2 rounded-lg z-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Pular para o conteúdo principal
          </a>
          <a
            href="#main-navigation"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-48 bg-primary-700 text-white px-4 py-2 rounded-lg z-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Pular para a navegação
          </a>

          <Header
            user={user}
            onLoginClick={() => setIsLoginModalOpen(true)}
            onLogout={handleLogout}
            onUpdateProfile={handleUpdateProfile}
          />

          <main id="main-content" className="flex-grow" role="main">
            <Suspense fallback={
              <div className="min-h-[40vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-primary-700"></div>
              </div>
            }>
            <Routes>
              <Route path="/" element={<LandingPage onLoginClick={() => setIsLoginModalOpen(true)} />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<Navigate to="/" replace />} />
              <Route
                path="/admin"
                element={
                  <AdminRoute user={user}>
                    <AdminPanel user={user!} />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/posts/new"
                element={
                  <AuthorOrAdminRoute user={user}>
                    <CreatePostPage />
                  </AuthorOrAdminRoute>
                }
              />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/ia-juridica" element={<IAJuridicaPage />} />
              <Route path="/calculadoras" element={<CalculatorsPage />} />
              <Route path="/planos" element={<PlanosPage />} />
              <Route path="/sobre" element={<AboutPage />} />
              {/* Rotas alternativas (aliases) para compatibilidade futura */}
              <Route path="/calculators" element={<CalculatorsPage />} />
            </Routes>
            </Suspense>
          </main>

          <FooterWrapper />

          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
          />

          <SessionTimeoutWarning
            isOpen={isTimeoutWarningOpen}
            remainingSeconds={remainingSeconds}
            onExtend={handleExtendSession}
            onLogout={handleLogout}
          />

          <EmailConfirmedModal
            isOpen={isEmailConfirmedModalOpen}
            onClose={() => setIsEmailConfirmedModalOpen(false)}
          />

          <AuthErrorModal
            isOpen={!!authError}
            onClose={() => setAuthError(null)}
            errorMessage={authError?.message || ''}
            errorType={authError?.type || ''}
          />

          <ResetPasswordModal
            isOpen={isResetPasswordModalOpen}
            onClose={() => {
              setIsResetPasswordModalOpen(false);
              setResetPasswordToken('');
            }}
            accessToken={resetPasswordToken}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

/**
 * Componente auxiliar que detecta o parâmetro 'confirmed' na URL
 * e dispara o callback quando o email é confirmado
 */
function EmailConfirmationHandler({ onEmailConfirmed }: { onEmailConfirmed: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    if (confirmed === 'true') {
      onEmailConfirmed();
      // Remove o parâmetro da URL para não mostrar o modal novamente ao recarregar
      searchParams.delete('confirmed');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, onEmailConfirmed]);

  return null;
}

/**
 * Componente auxiliar que detecta erros de autenticação na URL
 * e dispara o callback para mostrar o modal de erro
 */
function AuthErrorHandler({
  onAuthError
}: {
  onAuthError: (errorMessage: string, errorType: string) => void
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const authError = searchParams.get('auth_error');
    const errorType = searchParams.get('error_type');
    const errorMessage = searchParams.get('error_message');

    if (authError === 'true' && errorType && errorMessage) {
      onAuthError(decodeURIComponent(errorMessage), errorType);
      // Remove os parâmetros da URL
      searchParams.delete('auth_error');
      searchParams.delete('error_type');
      searchParams.delete('error_message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, onAuthError]);

  return null;
}

/**
 * Componente auxiliar que detecta token de reset de senha na URL
 * e abre o modal de reset de senha
 */
function ResetPasswordHandler({
  onResetPassword
}: {
  onResetPassword: (token: string) => void
}) {
  useEffect(() => {
    // Verificar se estamos na rota /reset-password
    const isResetPasswordRoute = window.location.pathname === '/reset-password';

    if (isResetPasswordRoute) {
      // Extrair token do hash fragment (#access_token=...)
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      let accessToken = hashParams.get('access_token');
      let type = hashParams.get('type');

      // Fallback: alguns provedores/links podem enviar como query string (?access_token=...)
      if (!accessToken) {
        const queryAccessToken = new URLSearchParams(window.location.search).get('access_token')
          || new URLSearchParams(window.location.search).get('token');
        if (queryAccessToken) {
          accessToken = queryAccessToken;
          type = new URLSearchParams(window.location.search).get('type') || 'recovery';
        }
      }

      if (type === 'recovery' && accessToken) {
        onResetPassword(accessToken);

        // Redirecionar para home e limpar hash
        window.history.replaceState(null, '', '/');
      }
    }
  }, [onResetPassword]);

  return null;
}

export default App;
