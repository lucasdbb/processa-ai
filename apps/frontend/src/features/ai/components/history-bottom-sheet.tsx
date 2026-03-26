import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { History, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryBottomSheetProps {
  children: ReactNode
  itemCount?: number
  trigger: (open: () => void) => ReactNode
}

export function HistoryBottomSheet({ children, itemCount = 0, trigger }: HistoryBottomSheetProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const open = useCallback(() => setIsOpen(true), [])

  return (
    <>
      {trigger(open)}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={cn(
          "lg:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col bg-card border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ maxHeight: '80vh', height: '80vh' }}
      >
        {/* Handle bar + header */}
        <div className="flex flex-col items-center pt-2 pb-0 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mb-2" />
          <div className="w-full flex items-center justify-between px-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">Histórico</span>
              {itemCount > 0 && (
                <span className="text-xs text-muted-foreground">({itemCount})</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </>
  )
}
