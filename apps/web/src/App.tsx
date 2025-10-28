import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import BlogPage from './pages/BlogPage';
import ToolsPage from './pages/ToolsPage';
import CalculatorsPage from './pages/CalculatorsPage';
import AboutPage from './pages/AboutPage';

/**
 * Main application component that handles routing, authentication, and global state
 * Provides error boundary protection and accessibility features
 */
function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

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
   * Handles user login authentication
   * @param {string} email - User email address
   * @param {string} password - User password
   */
  const handleLogin = (email: string, password: string) => {
    // Aqui você implementaria a lógica real de autenticação
    console.log('Login:', { email, password });
    
    // Simulando login bem-sucedido
    setUser({ email, name: email.split('@')[0] });
    setIsLoginModalOpen(false);
  };

  /**
   * Handles user logout by clearing user state
   */
  const handleLogout = () => {
    setUser(null);
  };

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

          <Header onLoginClick={() => setIsLoginModalOpen(true)} />
          
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
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/ferramentas" element={<ToolsPage />} />
              <Route path="/calculadoras" element={<CalculatorsPage />} />
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
            onLogin={handleLogin}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
