import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/root-layout'

import HomePage from '@/pages/home'
import BlogPage from '@/pages/blog'
import BlogPostPage from '@/pages/blog-post'
import IAPage from '@/pages/ia'
import CalculadorasPage from '@/pages/calculadoras'
import PlanosPage from '@/pages/planos'
import SobrePage from '@/pages/sobre'
import MaterialsPage from '@/pages/materials'
import AdminPage from '@/pages/admin'
import AdminNewPostPage from '@/pages/admin-new-post'
import AdminEditPostPage from '@/pages/admin-edit-post'

export const router = createBrowserRouter([
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
        path: 'ia-juridica',
        element: <IAPage />,
      },
      {
        path: 'calculadoras',
        element: <CalculadorasPage />,
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
        path: 'admin',
        element: <AdminPage />,
      },
      {
        path: 'admin/posts/novo',
        element: <AdminNewPostPage />,
      },
      {
        path: 'admin/posts/:id',
        element: <AdminEditPostPage />,
      },
    ],
  },
])
