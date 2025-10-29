import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import SessionTimeoutWarning from './components/SessionTimeoutWarning';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import BlogPage from './pages/BlogPage';
import ToolsPage from './pages/ToolsPage';
import CalculatorsPage from './pages/CalculatorsPage';
import AboutPage from './pages/AboutPage';
import AdminPanel from './pages/AdminPanel';
import PlanosPage from './pages/PlanosPage';
import { authService } from './services/auth.service';
import { getSessionTimeoutManager } from './utils/sessionTimeout';
import type { User } from './types/auth';

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

  // Check if user is already authenticated on app load
  useEffect(() => {
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
      return <Navigate to="/dashboard" replace />;
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
        phone: updatedData.phone
      });

      // Update local state with the response from the API
      const updatedUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role as 'admin' | 'user',
        avatar_url: response.user.avatar_url || undefined,
        phone: response.user.phone,
        createdAt: response.user.createdAt,
        emailVerified: response.user.emailVerified
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
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute isAuthenticated={!!user}>
                    <Dashboard user={user} onLogout={handleLogout} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute user={user}>
                    <AdminPanel user={user!} />
                  </AdminRoute>
                }
              />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/ferramentas" element={<ToolsPage />} />
              <Route path="/calculadoras" element={<CalculatorsPage />} />
              <Route path="/planos" element={<PlanosPage />} />
              <Route path="/sobre" element={<AboutPage />} />
              {/* Rotas alternativas (aliases) para compatibilidade futura */}
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/calculators" element={<CalculatorsPage />} />
            </Routes>
          </main>

          <Footer />

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
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
