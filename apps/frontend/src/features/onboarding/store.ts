import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TourId } from "./types";
import { API_URL, fetchWithCredentials } from "@/lib/fetch";

function persistOnboardingFlag(flags: Record<string, boolean>) {
  fetchWithCredentials(`${API_URL}/profiles/me/onboarding`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(flags),
  }).catch(() => {
    // Fire-and-forget: localStorage is the primary source, server is backup
  });
}

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
  /** Sync flags from server profile without triggering API calls back */
  syncFromServer: (flags: { hasUsedAiTool?: boolean; hasUsedCalculator?: boolean; isChecklistDismissed?: boolean; hasClaimedChecklistBonus?: boolean }) => void;
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
        if (!get().hasUsedAiTool) {
          set({ hasUsedAiTool: true });
          persistOnboardingFlag({ has_used_ai_tool: true });
        }
      },

      markCalculatorUsed: () => {
        if (!get().hasUsedCalculator) {
          set({ hasUsedCalculator: true });
          persistOnboardingFlag({ has_used_calculator: true });
        }
      },

      dismissChecklist: () => {
        set({ isChecklistDismissed: true });
        persistOnboardingFlag({ checklist_dismissed: true });
      },

      resetChecklist: () => {
        set({ isChecklistDismissed: false });
      },

      claimChecklistBonus: () => {
        set({ hasClaimedChecklistBonus: true });
      },

      syncFromServer: (flags) => {
        const update: Partial<OnboardingState> = {};
        if (flags.hasUsedAiTool) update.hasUsedAiTool = true;
        if (flags.hasUsedCalculator) update.hasUsedCalculator = true;
        if (flags.isChecklistDismissed) update.isChecklistDismissed = true;
        if (flags.hasClaimedChecklistBonus) update.hasClaimedChecklistBonus = true;
        if (Object.keys(update).length > 0) set(update);
      },
    }),
    {
      name: "onboarding-storage",
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = (persistedState as Partial<OnboardingState>) || {};
        return {
          ...state,
          currentTour: null,
          isOpen: false,
          isWelcomeModalOpen: false,
        } as OnboardingState;
      },
      partialize: (state) => ({
        completedTours: state.completedTours,
        hasUsedAiTool: state.hasUsedAiTool,
        hasUsedCalculator: state.hasUsedCalculator,
        isChecklistDismissed: state.isChecklistDismissed,
        hasClaimedChecklistBonus: state.hasClaimedChecklistBonus,
      }),
    },
  ),
);
