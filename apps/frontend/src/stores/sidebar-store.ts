import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  isExpanded: boolean
  isMobileOpen: boolean
  toggle: () => void
  setExpanded: (expanded: boolean) => void
  setMobileOpen: (open: boolean) => void
  closeMobile: () => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isExpanded: true,
      isMobileOpen: false,
      toggle: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setExpanded: (isExpanded) => set({ isExpanded }),
      setMobileOpen: (isMobileOpen) => set({ isMobileOpen }),
      closeMobile: () => set({ isMobileOpen: false }),
    }),
    {
      name: 'sidebar-storage',
      partialize: (state) => ({ isExpanded: state.isExpanded }),
    }
  )
)
