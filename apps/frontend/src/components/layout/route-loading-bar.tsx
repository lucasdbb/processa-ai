import { useNavigation } from 'react-router-dom'

interface RouteLoadingBarProps {
  /** CSS class for top offset, e.g. "top-0" or "top-16" */
  topClass?: string
}

export function RouteLoadingBar({ topClass = 'top-0' }: RouteLoadingBarProps) {
  const navigation = useNavigation()
  const isLoading = navigation.state !== 'idle'

  if (!isLoading) return null

  return (
    <div className={`fixed ${topClass} left-0 right-0 z-[60] h-1 bg-muted`}>
      <div
        className="h-full bg-slate-900 transition-all duration-300"
        style={{
          animation: 'loading 1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
