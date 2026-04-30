import { useMemo, useState } from "react";
import { Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { ROOM_STATUS_LABEL } from "@/types/karaoke";
import type { CurrentSession, OrderItem, Product, ProductGroup, Room } from "@/types/karaoke";

type Props = {
  rooms: Room[];
  groups: ProductGroup[];
  products: Product[];
  selectedRoomId: number | null;
  selectedRoom: Room | null;
  currentSession: CurrentSession | null;
  onSelectRoom: (roomId: number) => void;
  onStartRoom: (roomId: number) => void;
  onOpenOrderModal: (product: Product, initialQty: number) => void;
  onAdjustItemQty: (item: OrderItem, delta: number) => void;
  onEditItem: (item: OrderItem) => void;
  onRemoveItem: (item: OrderItem) => void;
  onCancelRoom: () => void;
  onCheckout: () => void;
  onTransferRoom: (targetRoomId: number) => Promise<void>;
  onPrintTemporaryBill: () => Promise<void>;
  printTemporaryBillLoading?: boolean;
};

export function PosPage(props: Props) {
  const {
    rooms,
    groups,
    products,
    selectedRoomId,
    selectedRoom,
    currentSession,
    onSelectRoom,
    onStartRoom,
    onOpenOrderModal,
    onAdjustItemQty,
    onEditItem,
    onRemoveItem,
    onCancelRoom,
    onCheckout,
    onTransferRoom,
    onPrintTemporaryBill,
    printTemporaryBillLoading = false,
  } = props;
  const [keyword, setKeyword] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string>("ALL");
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const groupTabs = useMemo(() => {
    const base = groups
      .map((group) => ({
        id: String(group.nhom_san_pham_id),
        name: group.ten_nhom,
      }))
      .filter((group) => products.some((product) => String(product.nhom_san_pham_id) === group.id));

    if (products.some((product) => product.nhom_san_pham_id === null)) {
      base.push({ id: "NULL", name: "Khác" });
    }
    return [{ id: "ALL", name: "Tất cả" }, ...base];
  }, [groups, products]);

  const filteredProducts = useMemo(() => {
    const byKeyword = products.filter((product) =>
      product.ten_san_pham.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (activeGroupId === "ALL") return byKeyword;
    if (activeGroupId === "NULL") return byKeyword.filter((product) => product.nhom_san_pham_id === null);
    return byKeyword.filter((product) => String(product.nhom_san_pham_id) === activeGroupId);
  }, [products, keyword, activeGroupId]);

  const totalMinutes = useMemo(() => {
    if (!selectedRoom || !currentSession || selectedRoom.tien_gio <= 0) return 0;
    const hours = (currentSession.tong_tien_gio ?? 0) / selectedRoom.tien_gio;
    return Math.max(0, Math.round(hours * 60));
  }, [selectedRoom, currentSession]);
  const totalHoursPart = Math.floor(totalMinutes / 60);
  const totalMinutesPart = totalMinutes % 60;
  const totalDurationLabel =
    totalHoursPart <= 0 ? `${totalMinutesPart} phút` : `${totalHoursPart} giờ ${totalMinutesPart} phút`;

  const emptyRoomsForTransfer = useMemo(
    () => rooms.filter((r) => r.trang_thai === "TRONG" && r.phong_id !== selectedRoomId),
    [rooms, selectedRoomId],
  );

  return (
    <section className="grid h-[calc(100vh-61px)] grid-cols-10 gap-3 overflow-hidden bg-slate-100 p-3">
      <aside className="app-card col-span-3 flex min-h-0 flex-col overflow-hidden p-0">
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold text-slate-800">{selectedRoom ? selectedRoom.ten_phong : "--"}</h2>
            <div className="text-right">
              <div className="text-3xl font-semibold text-primary">{currentSession ? "02:15" : "--:--"}</div>
              <div className="text-xs text-slate-500">Bắt đầu: {currentSession?.gio_bat_dau ?? "--"}</div>
            </div>
          </div>
          {selectedRoom && (
            <div className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
              {ROOM_STATUS_LABEL[selectedRoom.trang_thai]}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          {currentSession?.items.map((item) => (
            <div key={item.lich_su_phong_san_pham_id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-[auto,1fr,100px] gap-2 text-sm">
                <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-slate-600">
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200 hover:bg-slate-300"
                    onClick={() => onAdjustItemQty(item, -1)}
                  >
                    -
                  </button>
                  <span className="min-w-[1ch] tabular-nums font-semibold">{item.so_luong}</span>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200 hover:bg-slate-300"
                    onClick={() => onAdjustItemQty(item, 1)}
                  >
                    +
                  </button>
                </div>
                <div>
                  <div className="font-medium">{item.ten_san_pham}</div>
                  <div className="text-xs text-slate-500">{item.don_gia.toLocaleString()}</div>
                </div>
                <div className="text-right font-semibold">{item.thanh_tien.toLocaleString()}</div>
              </div>
              <div className="mt-1 flex justify-end gap-1">
                <div className="flex gap-1">
                  <button
                    className="rounded p-1 hover:bg-slate-200"
                    onClick={() => onEditItem(item)}
                    title="Sửa số lượng"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="rounded p-1 text-rose-700 hover:bg-rose-100"
                    onClick={() => onRemoveItem(item)}
                    title="Xóa món"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedRoom?.trang_thai === "DANG_HOAT_DONG" && (
          <div className="border-t border-slate-200 p-3">
            <div className="mb-2 space-y-1 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Tổng giờ</span>
                <span className="font-semibold text-slate-800">
                  {totalDurationLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tiền món</span>
                <span className="font-semibold text-slate-800">
                  {Math.ceil(currentSession?.tong_tien_san_pham ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tiền giờ</span>
                <span className="font-semibold text-slate-800">
                  {Math.ceil(currentSession?.tong_tien_gio ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-xl font-bold text-slate-800">
              Tổng cộng{" "}
              <span className="float-right text-4xl text-primary">
                {Math.ceil(currentSession?.tong_tien_thanh_toan ?? 0).toLocaleString()}
              </span>
            </div>
            {currentSession ? (
              <>
                <div className="mt-3 grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-primary inline-flex min-w-0 w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={printTemporaryBillLoading}
                    aria-busy={printTemporaryBillLoading}
                    onClick={() => void onPrintTemporaryBill()}
                  >
                    {printTemporaryBillLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        <span>Đang in phiếu…</span>
                      </>
                    ) : (
                      "In phiếu"
                    )}
                  </button>
                  <button type="button" className="btn-danger min-w-0 w-full" onClick={onCancelRoom}>
                    Trả phòng
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-2 w-full"
                  onClick={onCheckout}
                >
                  Thanh toán
                </button>
              </>
            ) : (
              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <button type="button" className="btn-danger min-w-0 w-full" onClick={onCancelRoom}>
                  Trả phòng
                </button>
                <button type="button" className="btn-secondary min-w-0 w-full" onClick={onCheckout}>
                  Thanh toán
                </button>
              </div>
            )}
            {currentSession && (
              <button
                type="button"
                className="btn-ghost mt-2 w-full border border-slate-200 text-sm"
                onClick={() => setTransferModalOpen(true)}
              >
                Chuyển phòng
              </button>
            )}
          </div>
        )}
      </aside>

      <section className="col-span-5 flex min-h-0 flex-col gap-3">
        <div className="app-card p-3">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="app-input w-full pl-9"
              placeholder="Tìm kiếm món..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {groupTabs.map((tab) => (
              <button
                key={tab.id}
                className={
                  activeGroupId === tab.id
                    ? "rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                    : "rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                }
                onClick={() => setActiveGroupId(tab.id)}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        <div className="app-card min-h-0 flex-1 overflow-auto p-3">
          <div className="grid grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.san_pham_id}
                className="rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:bg-slate-50"
                onClick={() => onOpenOrderModal(product, 1)}
              >
                <div className="line-clamp-2 min-h-[40px] font-semibold text-slate-800">{product.ten_san_pham}</div>
                <div className="mt-3 text-xl font-bold text-slate-700">{product.don_gia.toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="app-card col-span-2 overflow-hidden p-0">
        <div className="border-b border-slate-200 p-3">
          <h3 className="font-semibold text-slate-800">Phòng ({rooms.length})</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 p-3">
          {rooms.map((room) => (
            <button
              key={room.phong_id}
              className={`rounded-md border p-2 text-left transition ${room.trang_thai === "TRONG"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                } ${selectedRoomId === room.phong_id ? "ring-2 ring-primary" : ""}`}
              onClick={() => onSelectRoom(room.phong_id)}
              onDoubleClick={() => room.trang_thai === "TRONG" && onStartRoom(room.phong_id)}
            >
              <div className="font-semibold">{room.ten_phong}</div>
              <div className="text-xs">{ROOM_STATUS_LABEL[room.trang_thai]}</div>
            </button>
          ))}
        </div>
      </aside>

      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="w-[420px] max-w-[95vw] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">Chuyển phòng</h3>
            <p className="mb-3 text-sm text-slate-600">
              Chọn phòng trống để chuyển toàn bộ phiên và món đang gọi sang phòng đích.
            </p>
            {emptyRoomsForTransfer.length === 0 ? (
              <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-800">
                Hiện không còn phòng trống. Vui lòng thử lại sau.
              </div>
            ) : (
              <div className="max-h-[280px] space-y-2 overflow-auto">
                {emptyRoomsForTransfer.map((room) => (
                  <button
                    key={room.phong_id}
                    type="button"
                    disabled={transferSubmitting}
                    className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-white disabled:opacity-50"
                    onClick={() => {
                      void (async () => {
                        setTransferSubmitting(true);
                        try {
                          await onTransferRoom(room.phong_id);
                          setTransferModalOpen(false);
                        } catch (err) {
                          window.alert(String(err));
                        } finally {
                          setTransferSubmitting(false);
                        }
                      })();
                    }}
                  >
                    <span className="font-semibold text-slate-800">{room.ten_phong}</span>
                    <span className="text-xs text-slate-500">
                      {Math.ceil(room.tien_gio).toLocaleString()} đ/giờ
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                disabled={transferSubmitting}
                onClick={() => setTransferModalOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
