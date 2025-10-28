import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import BlogPage from './pages/BlogPage';
import ToolsPage from './pages/ToolsPage';
import CalculatorsPage from './pages/CalculatorsPage';
import AboutPage from './pages/AboutPage';

function App() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  // Componente de proteção de rota: redireciona para "/" se não autenticado
  const ProtectedRoute = ({
    isAuthenticated,
    children,
  }: {
    isAuthenticated: boolean;
    children: JSX.Element;
  }) => {
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  const handleLogin = (email: string, password: string) => {
    // Aqui você implementaria a lógica real de autenticação
    console.log('Login:', { email, password });
    
    // Simulando login bem-sucedido
    setUser({ email, name: email.split('@')[0] });
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header onLoginClick={() => setIsLoginModalOpen(true)} />
        
        <main className="flex-grow">
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
  );
}

export default App;
