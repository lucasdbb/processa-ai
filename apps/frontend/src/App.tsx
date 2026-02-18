import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TourProvider } from '@/features/onboarding/tour-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { router } from './router'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <TourProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton />
        </TourProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
