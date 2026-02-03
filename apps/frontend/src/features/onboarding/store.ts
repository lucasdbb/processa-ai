import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TourId } from "./types";

interface OnboardingState {
  completedTours: TourId[];
  currentTour: TourId | null;
  isOpen: boolean;
  startTour: (tourId: TourId) => void;
  completeTour: (tourId: TourId) => void;
  closeTour: () => void;
  resetTours: () => void;
  hasCompletedTour: (tourId: TourId) => boolean;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedTours: [],
      currentTour: null,
      isOpen: false,

      startTour: (tourId) => {
        set({ currentTour: tourId, isOpen: true });
      },

      completeTour: (tourId) => {
        set((state) => ({
          completedTours: [...new Set([...state.completedTours, tourId])],
          currentTour: null,
          isOpen: false,
        }));
      },

      closeTour: () => {
        set({ currentTour: null, isOpen: false });
      },

      resetTours: () => {
        set({ completedTours: [], currentTour: null, isOpen: false });
      },

      hasCompletedTour: (tourId) => {
        return get().completedTours.includes(tourId);
      },
    }),
    {
      name: "onboarding-storage",
    },
  ),
);
