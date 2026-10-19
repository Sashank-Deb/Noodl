import { create } from "zustand";

/** Small global UI flags for dialogs that can be opened from anywhere. */
export const useUI = create<{ conflictsOpen: boolean; setConflictsOpen: (o: boolean) => void }>((set) => ({
  conflictsOpen: false,
  setConflictsOpen: (conflictsOpen) => set({ conflictsOpen }),
}));
