import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TourProvider } from '@/features/onboarding/tour-provider'
import { router } from './router'

function App() {
  return (
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
  )
}

export default App
