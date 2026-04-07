import { lazy, Suspense } from 'react'
import { createBrowserRouter, redirect } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthGuard } from '@/components/auth/auth-guard'
import { AdminGuard } from '@/components/auth/admin-guard'
import { RequirePlan } from '@/components/auth/require-plan'
import { PortalGuard } from '@/components/auth/portal-guard'
import { PortalLayout } from '@/components/layout/portal-layout'
import PortalPage from '@/pages/portal'
import PortalAtivarPage from '@/pages/portal/ativar'
import { RouterErrorBoundary } from '@/components/router-error-boundary'
import NotFoundPage from '@/pages/not-found'

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
import TransparenciaIAPage from '@/pages/transparencia-ia'

// Retry wrapper for lazy imports — handles chunk load failures after deployments
// by reloading the page once when the JS chunk file is no longer available.
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    importFn().catch((error: unknown) => {
      const isChunkError =
        error instanceof Error &&
        (error.message.includes('Failed to fetch dynamically imported module') ||
          error.message.includes('Loading chunk') ||
          error.message.includes('Loading CSS chunk') ||
          error.name === 'ChunkLoadError')

      if (isChunkError) {
        const reloadKey = 'chunk_reload_' + window.location.pathname
        const lastReload = sessionStorage.getItem(reloadKey)
        const now = Date.now()

        // Only auto-reload once per route per 30s to prevent infinite loops
        if (!lastReload || now - Number(lastReload) > 30_000) {
          sessionStorage.setItem(reloadKey, String(now))
          window.location.reload()
        }
      }

      throw error
    }),
  )
}

// App pages (lazy loading for code splitting)
const DashboardPage = lazyWithRetry(() => import('@/pages/app/dashboard'))
const ClientesPage = lazyWithRetry(() => import('@/pages/app/clientes'))
const ClienteDetalhePage = lazyWithRetry(() => import('@/pages/app/clientes/[id]'))
const ProcessosPage = lazyWithRetry(() => import('@/pages/app/processos'))
const ProcessoDetalhePage = lazyWithRetry(() => import('@/pages/app/processos/[id]'))
const ServicosPage = lazyWithRetry(() => import('@/pages/app/servicos'))
const ServicoDetalhePage = lazyWithRetry(() => import('@/pages/app/servicos/[id]'))
const CalendarioPage = lazyWithRetry(() => import('@/pages/app/calendario'))
const DocumentosPage = lazyWithRetry(() => import('@/pages/app/documentos'))
const NotificacoesPage = lazyWithRetry(() => import('@/pages/app/notificacoes'))
const ConfiguracoesPage = lazyWithRetry(() => import('@/pages/app/configuracoes'))
const AssinaturaPage = lazyWithRetry(() => import('@/pages/app/assinatura'))
const AjudaPage = lazyWithRetry(() => import('@/pages/app/ajuda'))

// App pages (lazy loading - less frequently accessed)
const CalculadorasAppPage = lazyWithRetry(() => import('@/pages/app/calculadoras'))
const IAJuridicaHubPage = lazyWithRetry(() => import('@/pages/app/ia-juridica'))
const IAAppPage = lazyWithRetry(() => import('@/pages/app/ia'))

// Admin pages (lazy loading - restricted access + heavy markdown editor)
const AdminPage = lazyWithRetry(() => import('@/pages/admin'))
const AdminNewPostPage = lazyWithRetry(() => import('@/pages/admin-new-post'))
const AdminEditPostPage = lazyWithRetry(() => import('@/pages/admin-edit-post'))

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
    errorElement: <RouterErrorBoundary />,
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
        path: 'transparencia-ia',
        element: <TransparenciaIAPage />,
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
    errorElement: <RouterErrorBoundary />,
    children: [
      {
        index: true,
        element: <Suspense fallback={<LoadingFallback />}><DashboardPage /></Suspense>,
      },
      {
        element: <RequirePlan />,
        children: [
          {
            path: 'clientes',
            element: <Suspense fallback={<LoadingFallback />}><ClientesPage /></Suspense>,
          },
          {
            path: 'clientes/:id',
            element: <Suspense fallback={<LoadingFallback />}><ClienteDetalhePage /></Suspense>,
          },
          {
            path: 'processos',
            element: <Suspense fallback={<LoadingFallback />}><ProcessosPage /></Suspense>,
          },
          {
            path: 'processos/:id',
            element: <Suspense fallback={<LoadingFallback />}><ProcessoDetalhePage /></Suspense>,
          },
          {
            path: 'servicos',
            element: <Suspense fallback={<LoadingFallback />}><ServicosPage /></Suspense>,
          },
          {
            path: 'servicos/:id',
            element: <Suspense fallback={<LoadingFallback />}><ServicoDetalhePage /></Suspense>,
          },
          {
            path: 'calendario',
            element: <Suspense fallback={<LoadingFallback />}><CalendarioPage /></Suspense>,
          },
        ]
      },
      {
        path: 'notificacoes',
        element: <Suspense fallback={<LoadingFallback />}><NotificacoesPage /></Suspense>,
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
        element: <Suspense fallback={<LoadingFallback />}><DocumentosPage /></Suspense>,
      },
      {
        path: 'configuracoes',
        element: <Suspense fallback={<LoadingFallback />}><ConfiguracoesPage /></Suspense>,
      },
      {
        path: 'assinatura',
        element: <Suspense fallback={<LoadingFallback />}><AssinaturaPage /></Suspense>,
      },
      {
        path: 'ajuda',
        element: <Suspense fallback={<LoadingFallback />}><AjudaPage /></Suspense>,
      },
    ],
  },

  // Portal activation (public — user arrives from invite email with token in URL hash)
  {
    path: '/portal/ativar',
    element: <PortalAtivarPage />,
    errorElement: <RouterErrorBoundary />,
  },

  // Portal routes (office_client users only)
  {
    path: '/portal',
    element: (
      <PortalGuard>
        <PortalLayout />
      </PortalGuard>
    ),
    errorElement: <RouterErrorBoundary />,
    children: [
      {
        index: true,
        element: <PortalPage />,
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
    errorElement: <RouterErrorBoundary />,
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

  // Catch-all 404
  {
    path: '*',
    element: (
      <RootLayout />
    ),
    children: [
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
