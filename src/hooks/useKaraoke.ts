import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CurrentSession,
  HistoryOrderItem,
  PaidHistory,
  Product,
  ProductGroup,
  Room,
} from "@/types/karaoke";

export function useKaraoke() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null);
  const [histories, setHistories] = useState<PaidHistory[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryOrderItem[]>([]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.phong_id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const loadMasterData = useCallback(async () => {
    await invoke("seed_demo_data");
    const [roomData, productData, groupData] = await Promise.all([
      invoke<Room[]>("list_rooms"),
      invoke<Product[]>("list_products"),
      invoke<ProductGroup[]>("list_product_groups"),
    ]);
    setRooms(roomData);
    setProducts(productData);
    setGroups(groupData);
    if (!selectedRoomId && roomData.length > 0) setSelectedRoomId(roomData[0].phong_id);
  }, [selectedRoomId]);

  const loadCurrentSession = useCallback(async (roomId: number | null) => {
    if (!roomId) {
      setCurrentSession(null);
      return;
    }
    const session = await invoke<CurrentSession | null>("get_current_session", { roomId });
    setCurrentSession(session);
  }, []);

  const loadHistory = useCallback(async (date?: string) => {
    const data = await invoke<PaidHistory[]>("list_paid_history", { date: date || null });
    setHistories(data);
  }, []);

  const loadHistoryDetail = useCallback(async (historyId: number) => {
    const data = await invoke<HistoryOrderItem[]>("get_history_order_items", { historyId });
    setHistoryItems(data);
  }, []);

  useEffect(() => {
    void loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    void loadCurrentSession(selectedRoomId);
  }, [selectedRoomId, loadCurrentSession]);

  const selectedRoomIsActive = selectedRoom?.trang_thai === "DANG_HOAT_DONG";

  useEffect(() => {
    if (selectedRoomId == null || !selectedRoomIsActive) return;

    const intervalId = window.setInterval(() => {
      void loadCurrentSession(selectedRoomId);
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [selectedRoomId, selectedRoomIsActive, loadCurrentSession]);

  return {
    rooms,
    products,
    groups,
    selectedRoomId,
    selectedRoom,
    currentSession,
    histories,
    historyItems,
    setSelectedRoomId,
    setHistoryItems,
    loadMasterData,
    loadCurrentSession,
    loadHistory,
    loadHistoryDetail,
  };
}
