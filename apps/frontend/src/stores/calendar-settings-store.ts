import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CalendarColorScheme = "default" | "minimal" | "colorful";

interface CalendarSettingsState {
  colorScheme: CalendarColorScheme;
  showWeekends: boolean;
  defaultView: "month" | "week" | "day" | "agenda";
  setColorScheme: (scheme: CalendarColorScheme) => void;
  setShowWeekends: (show: boolean) => void;
  setDefaultView: (view: "month" | "week" | "day" | "agenda") => void;
}

export const useCalendarSettingsStore = create<CalendarSettingsState>()(
  persist(
    (set) => ({
      colorScheme: "default",
      showWeekends: true,
      defaultView: "month",
      setColorScheme: (scheme) => set({ colorScheme: scheme }),
      setShowWeekends: (show) => set({ showWeekends: show }),
      setDefaultView: (view) => set({ defaultView: view }),
    }),
    {
      name: "calendar-settings",
    },
  ),
);
