import { lazy, Suspense } from 'react'
import { createBrowserRouter, redirect } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthGuard } from '@/components/auth/auth-guard'
import { AdminGuard } from '@/components/auth/admin-guard'

// Public pages
import HomePage from '@/pages/home'
import BlogPage from '@/pages/blog'
import BlogPostPage from '@/pages/blog-post'
import PlanosPage from '@/pages/planos'
import SobrePage from '@/pages/sobre'
import MaterialsPage from '@/pages/materials'
import CallbackPage from '@/pages/auth/CallbackPage'
import TermosPage from '@/pages/termos'
import PrivacidadePage from '@/pages/privacidade'

// App pages (eager loading - frequently accessed)
import DashboardPage from '@/pages/app/dashboard'
import ClientesPage from '@/pages/app/clientes'
import ClienteDetalhePage from '@/pages/app/clientes/[id]'
import ProcessosPage from '@/pages/app/processos'
import ProcessoDetalhePage from '@/pages/app/processos/[id]'
import PrazosPage from '@/pages/app/prazos'
import DocumentosPage from '@/pages/app/documentos'
import NotificacoesPage from '@/pages/app/notificacoes'
import ConfiguracoesPage from '@/pages/app/configuracoes'
import AjudaPage from '@/pages/app/ajuda'

// App pages (lazy loading - less frequently accessed)
const CalculadorasAppPage = lazy(() => import('@/pages/app/calculadoras'))
const IAJuridicaHubPage = lazy(() => import('@/pages/app/ia-juridica'))
const IAAppPage = lazy(() => import('@/pages/app/ia'))

// Admin pages (lazy loading - restricted access + heavy markdown editor)
const AdminPage = lazy(() => import('@/pages/admin'))
const AdminNewPostPage = lazy(() => import('@/pages/admin-new-post'))
const AdminEditPostPage = lazy(() => import('@/pages/admin-edit-post'))

// Loading fallback component
// eslint-disable-next-line react-refresh/only-export-components
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100" />
  </div>
)

export const router = createBrowserRouter([
  {
    path: '/apps/*',
    loader: ({ request }) => {
      const url = new URL(request.url)
      const nextPathname = url.pathname.replace(/^\/apps\b/, '/app')
      throw redirect(`${nextPathname}${url.search}`)
    },
  },
  // Public routes (marketing site)
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'blog',
        element: <BlogPage />,
      },
      {
        path: 'blog/:id',
        element: <BlogPostPage />,
      },
      {
        path: 'planos',
        element: <PlanosPage />,
      },
      {
        path: 'sobre',
        element: <SobrePage />,
      },
      {
        path: 'materiais',
        element: <MaterialsPage />,
      },
      {
        path: 'termos',
        element: <TermosPage />,
      },
      {
        path: 'privacidade',
        element: <PrivacidadePage />,
      },
      {
        path: 'auth/callback',
        element: <CallbackPage />,
      },
    ],
  },

  // App routes (authenticated users)
  {
    path: '/app',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'clientes',
        element: <ClientesPage />,
      },
      {
        path: 'clientes/:id',
        element: <ClienteDetalhePage />,
      },
      {
        path: 'processos',
        element: <ProcessosPage />,
      },
      {
        path: 'processos/:id',
        element: <ProcessoDetalhePage />,
      },
      {
        path: 'notificacoes',
        element: <NotificacoesPage />,
      },
      {
        path: 'prazos',
        element: <PrazosPage />,
      },
      {
        path: 'calculadoras',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CalculadorasAppPage />
          </Suspense>
        ),
      },
      {
        path: 'calculadoras/:calculatorId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CalculadorasAppPage />
          </Suspense>
        ),
      },
      {
        path: 'ia',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <IAJuridicaHubPage />
          </Suspense>
        ),
      },
      {
        path: 'ia/:toolId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <IAAppPage />
          </Suspense>
        ),
      },
      {
        path: 'materiais',
        element: <MaterialsPage />,
      },
      {
        path: 'documentos',
        element: <DocumentosPage />,
      },
      {
        path: 'configuracoes',
        element: <ConfiguracoesPage />,
      },
      {
        path: 'ajuda',
        element: <AjudaPage />,
      },
    ],
  },

  // Admin routes (admin/author users only)
  {
    path: '/admin',
    element: (
      <AdminGuard>
        <RootLayout />
      </AdminGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AdminPage />
          </Suspense>
        ),
      },
      {
        path: 'posts/novo',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AdminNewPostPage />
          </Suspense>
        ),
      },
      {
        path: 'posts/:id',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AdminEditPostPage />
          </Suspense>
        ),
      },
    ],
  },
])
