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

// App pages
import DashboardPage from '@/pages/app/dashboard'
import ClientesPage from '@/pages/app/clientes'
import ProcessosPage from '@/pages/app/processos'
import PrazosPage from '@/pages/app/prazos'
import CalculadorasAppPage from '@/pages/app/calculadoras'
import IAAppPage from '@/pages/app/ia'
import DocumentosPage from '@/pages/app/documentos'
import ConfiguracoesPage from '@/pages/app/configuracoes'

// Admin pages
import AdminPage from '@/pages/admin'
import AdminNewPostPage from '@/pages/admin-new-post'
import AdminEditPostPage from '@/pages/admin-edit-post'

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
        path: 'processos',
        element: <ProcessosPage />,
      },
      {
        path: 'prazos',
        element: <PrazosPage />,
      },
      {
        path: 'calculadoras',
        element: <CalculadorasAppPage />,
      },
      {
        path: 'calculadoras/:calculatorId',
        element: <CalculadorasAppPage />,
      },
      {
        path: 'ia',
        element: <IAAppPage />,
      },
      {
        path: 'ia/:toolId',
        element: <IAAppPage />,
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
        element: <AdminPage />,
      },
      {
        path: 'posts/novo',
        element: <AdminNewPostPage />,
      },
      {
        path: 'posts/:id',
        element: <AdminEditPostPage />,
      },
    ],
  },
])
