import { create } from "zustand";

type PosState = {
  selectedRoomId: number | null;
  setSelectedRoomId: (roomId: number | null) => void;
};

export const usePosStore = create<PosState>((set) => ({
  selectedRoomId: null,
  setSelectedRoomId: (roomId) => set({ selectedRoomId: roomId }),
}));
