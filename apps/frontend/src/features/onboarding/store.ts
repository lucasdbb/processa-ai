import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TourId } from "./types";

interface OnboardingState {
  completedTours: TourId[];
  currentTour: TourId | null;
  isOpen: boolean;
  isWelcomeModalOpen: boolean;
  hasUsedAiTool: boolean;
  hasUsedCalculator: boolean;
  isChecklistDismissed: boolean;
  hasClaimedChecklistBonus: boolean;
  startTour: (tourId: TourId) => void;
  completeTour: (tourId: TourId) => void;
  closeTour: () => void;
  resetTours: () => void;
  hasCompletedTour: (tourId: TourId) => boolean;
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
  markAiToolUsed: () => void;
  markCalculatorUsed: () => void;
  dismissChecklist: () => void;
  resetChecklist: () => void;
  claimChecklistBonus: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedTours: [],
      currentTour: null,
      isOpen: false,
      isWelcomeModalOpen: false,
      hasUsedAiTool: false,
      hasUsedCalculator: false,
      isChecklistDismissed: false,
      hasClaimedChecklistBonus: false,

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

      openWelcomeModal: () => {
        set({ isWelcomeModalOpen: true });
      },

      closeWelcomeModal: () => {
        set({ isWelcomeModalOpen: false });
      },

      markAiToolUsed: () => {
        set({ hasUsedAiTool: true });
      },

      markCalculatorUsed: () => {
        set({ hasUsedCalculator: true });
      },

      dismissChecklist: () => {
        set({ isChecklistDismissed: true });
      },

      resetChecklist: () => {
        set({ isChecklistDismissed: false });
      },

      claimChecklistBonus: () => {
        set({ hasClaimedChecklistBonus: true });
      },
    }),
    {
      name: "onboarding-storage",
    },
  ),
);
