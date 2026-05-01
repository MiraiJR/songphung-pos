import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { HistoryOrderItem, PaidHistory } from "@/types/karaoke";
import { formatDateTime } from "@/utils/formatDateTime";

type Props = {
  histories: PaidHistory[];
  historyItems: HistoryOrderItem[];
  historyDate: string;
  onDateChange: (v: string) => void;
  onFilter: () => void;
  onOpenDetail: (historyId: number) => Promise<void>;
  onReprintBill: (historyId: number) => Promise<string>;
  onDeleteByIds: (ids: number[]) => Promise<number>;
  onDeleteByRange: (startDate: string, endDate: string) => Promise<number>;
  onUpdateBill: (
    historyId: number,
    tongTienGio: number,
    tongTienThanhToan: number,
    items: Array<{ san_pham_id: string; so_luong: number }>,
  ) => Promise<string>;
  onReloadHistory: () => Promise<void>;
};

function formatMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function parseMoneyInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return Number.NaN;
  return Number(digits);
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseBillDateTime(value: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatBillDuration(startRaw: string, endRaw: string | null): string {
  const start = parseBillDateTime(startRaw);
  const end = parseBillDateTime(endRaw);
  if (!start || !end || end <= start) return "--";
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours <= 0 ? `${minutes} phút` : `${hours} giờ ${minutes} phút`;
}

export function HistoryPage({
  histories,
  historyItems,
  historyDate,
  onDateChange,
  onFilter,
  onOpenDetail,
  onReprintBill,
  onDeleteByIds,
  onDeleteByRange,
  onUpdateBill,
  onReloadHistory,
}: Props) {
  const [menuHistoryId, setMenuHistoryId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<PaidHistory | null>(null);
  const [reprintStatus, setReprintStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [reprintingHistoryId, setReprintingHistoryId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteIdsDialogOpen, setDeleteIdsDialogOpen] = useState(false);
  const [deleteRangeDialogOpen, setDeleteRangeDialogOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(() => todayLocalYmd());
  const [rangeEnd, setRangeEnd] = useState(() => todayLocalYmd());
  const [rangeConfirmText, setRangeConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<PaidHistory | null>(null);
  const [editTienGio, setEditTienGio] = useState("0");
  const [editTongTien, setEditTongTien] = useState("0");
  const [editQtyByProductId, setEditQtyByProductId] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editInitializedForHistoryId, setEditInitializedForHistoryId] = useState<number | null>(null);
  const [editPrintAfterSave, setEditPrintAfterSave] = useState(false);
  const optionButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  async function handleViewDetail(item: PaidHistory) {
    await onOpenDetail(item.lich_su_phong_id);
    setSelectedHistory(item);
    setDetailOpen(true);
    setMenuHistoryId(null);
  }

  async function handleOpenEdit(item: PaidHistory) {
    await onOpenDetail(item.lich_su_phong_id);
    setEditingHistory(item);
    setEditTienGio(formatMoneyInput(String(Math.round(item.tong_tien_gio))));
    setEditTongTien(formatMoneyInput(String(Math.round(item.tong_tien_thanh_toan))));
    setEditQtyByProductId({});
    setEditInitializedForHistoryId(null);
    setEditPrintAfterSave(false);
    setEditOpen(true);
    setMenuHistoryId(null);
  }

  useEffect(() => {
    if (!editOpen || !editingHistory) return;
    if (editInitializedForHistoryId === editingHistory.lich_su_phong_id) return;
    if (historyItems.length === 0) return;
    setEditQtyByProductId(
      Object.fromEntries(historyItems.map((row) => [row.san_pham_id, String(row.so_luong)])),
    );
    setEditInitializedForHistoryId(editingHistory.lich_su_phong_id);
  }, [editOpen, editingHistory, editInitializedForHistoryId, historyItems]);

  async function handleSaveEdit() {
    if (!editingHistory) return;
    const tongTienGio = parseMoneyInput(editTienGio);
    if (!Number.isFinite(tongTienGio) || tongTienGio < 0) {
      toast.error("Tiền giờ không hợp lệ.");
      return;
    }
    const tongTienThanhToan = parseMoneyInput(editTongTien);
    if (!Number.isFinite(tongTienThanhToan) || tongTienThanhToan < 0) {
      toast.error("Tổng tiền không hợp lệ.");
      return;
    }

    const payloadItems: Array<{ san_pham_id: string; so_luong: number }> = [];
    const donGiaBySanPhamId: Record<string, number> = {};
    for (const row of historyItems) {
      const raw = editQtyByProductId[row.san_pham_id] ?? String(row.so_luong);
      const qty = Number(raw);
      if (!Number.isInteger(qty) || qty < 0) {
        toast.error(`Số lượng không hợp lệ cho món ${row.ten_san_pham}.`);
        return;
      }
      donGiaBySanPhamId[row.san_pham_id] = row.don_gia;
      payloadItems.push({ san_pham_id: row.san_pham_id, so_luong: qty });
    }
    const tongTienSanPhamMoi = payloadItems.reduce(
      (sum, item) => sum + (donGiaBySanPhamId[item.san_pham_id] ?? 0) * item.so_luong,
      0,
    );

    setSavingEdit(true);
    try {
      const message = await onUpdateBill(
        editingHistory.lich_su_phong_id,
        tongTienGio,
        tongTienThanhToan,
        payloadItems,
      );
      toast.success(message);
      await onReloadHistory();
      await onOpenDetail(editingHistory.lich_su_phong_id);
      if (editPrintAfterSave) {
        try {
          const printMessage = await onReprintBill(editingHistory.lich_su_phong_id);
          toast.success(printMessage);
        } catch (error) {
          toast.error(`Đã lưu nhưng in hóa đơn thất bại: ${String(error)}`);
        }
      }
      setSelectedHistory((prev) =>
        prev && prev.lich_su_phong_id === editingHistory.lich_su_phong_id
          ? {
            ...prev,
            tong_tien_gio: tongTienGio,
            tong_tien_san_pham: tongTienSanPhamMoi,
            tong_tien_thanh_toan: tongTienThanhToan,
          }
          : prev,
      );
      setEditOpen(false);
    } catch (error) {
      toast.error(`Cập nhật hóa đơn thất bại: ${String(error)}`);
    } finally {
      setSavingEdit(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === histories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(histories.map((h) => h.lich_su_phong_id)));
    }
  }

  async function confirmDeleteByIds() {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const count = await onDeleteByIds(ids);
      toast.success(`Đã xóa ${count} hóa đơn thành công.`);
      setSelectedIds(new Set());
      await onReloadHistory();
    } catch (error) {
      toast.error(`Xóa thất bại: ${String(error)}`);
    } finally {
      setDeleting(false);
      setDeleteIdsDialogOpen(false);
    }
  }

  async function confirmDeleteByRange() {
    setDeleting(true);
    try {
      const count = await onDeleteByRange(rangeStart, rangeEnd);
      toast.success(`Đã xóa ${count} hóa đơn trong khoảng ngày đã chọn.`);
      setSelectedIds(new Set());
      setRangeConfirmText("");
      await onReloadHistory();
    } catch (error) {
      toast.error(`Xóa thất bại: ${String(error)}`);
    } finally {
      setDeleting(false);
      setDeleteRangeDialogOpen(false);
    }
  }

  const allSelected = histories.length > 0 && selectedIds.size === histories.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < histories.length;
  const totalRevenue = histories.reduce((sum, item) => sum + item.tong_tien_thanh_toan, 0);
  const editTongTienMon = historyItems.reduce((sum, item) => {
    const qty = Number(editQtyByProductId[item.san_pham_id] ?? item.so_luong);
    return sum + item.don_gia * (Number.isFinite(qty) && qty >= 0 ? qty : 0);
  }, 0);

  useEffect(() => {
    if (menuHistoryId == null) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const btn = optionButtonRefs.current[menuHistoryId];
      if (dropdownRef.current?.contains(target)) return;
      if (btn?.contains(target)) return;
      setMenuHistoryId(null);
      setMenuPosition(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuHistoryId(null);
        setMenuPosition(null);
      }
    };
    const onViewportChanged = () => {
      setMenuHistoryId(null);
      setMenuPosition(null);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChanged);
    window.addEventListener("scroll", onViewportChanged, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChanged);
      window.removeEventListener("scroll", onViewportChanged, true);
    };
  }, [menuHistoryId]);

  return (
    <section className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Lịch sử phòng</h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi hóa đơn đã thanh toán và in lại khi cần.</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={historyDate} onChange={onDateChange} />
          <Button className="h-[48px]" variant="default" onClick={onFilter}>
            Lọc
          </Button>
        </div>
      </div>

      <div className="app-card mb-4 grid grid-cols-2 gap-3 p-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          Tổng hóa đơn: <span className="font-bold text-slate-800">{histories.length}</span>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          Tổng doanh thu: <span className="font-bold text-primary">{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="app-card mb-4 flex items-center gap-3 border-rose-200 bg-rose-50 px-4 py-3">
          <span className="text-sm font-medium text-rose-800">
            Đã chọn {selectedIds.size} hóa đơn
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteIdsDialogOpen(true)}
          >
            <Trash2 className="mr-1.5 size-4" />
            Xóa mục đã chọn
          </Button>
        </div>
      )}

      {/* Delete by date range */}
      <div className="app-card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Từ ngày</label>
          <DatePicker value={rangeStart} onChange={setRangeStart} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Đến ngày</label>
          <DatePicker value={rangeEnd} onChange={setRangeEnd} />
        </div>
        <Button
          variant="destructive"
          className="h-[48px]"
          onClick={() => {
            if (rangeStart > rangeEnd) {
              toast.error("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
              return;
            }
            setRangeConfirmText("");
            setDeleteRangeDialogOpen(true);
          }}
        >
          <Trash2 className="mr-1.5 size-4" />
          Xóa theo khoảng ngày
        </Button>
      </div>

      {reprintStatus && (
        <div
          className={`mb-3 rounded px-3 py-2 text-sm ${reprintStatus.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
        >
          {reprintStatus.message}
        </div>
      )}

      <div>
        <div className="app-card overflow-visible">
          <div className="relative z-10 overflow-x-auto">
            <div className="min-w-[1180px]">
              <div className="grid grid-cols-[40px,90px,150px,150px,130px,120px,120px,120px,120px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <span className="flex items-center justify-center">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </span>
                <span>Phòng</span>
                <span>Bắt đầu</span>
                <span>Kết thúc</span>
                <span>Tổng giờ hát</span>
                <span className="text-right">Tiền món</span>
                <span className="text-right">Tiền giờ</span>
                <span className="text-right">Tổng tiền</span>
                <span className="text-right">Thao tác</span>
              </div>
              {histories.map((item) => (
                <div
                  key={item.lich_su_phong_id}
                  className={`relative grid grid-cols-[40px,90px,150px,150px,130px,120px,120px,120px,120px] items-center border-b border-slate-200 px-4 py-3 text-sm hover:bg-slate-50 ${selectedIds.has(item.lich_su_phong_id) ? "bg-rose-50/50" : ""
                    } ${menuHistoryId === item.lich_su_phong_id ? "z-30" : "z-0"
                    }`}
                >
                  <span className="flex items-center justify-center">
                    <Checkbox
                      checked={selectedIds.has(item.lich_su_phong_id)}
                      onCheckedChange={() => toggleSelect(item.lich_su_phong_id)}
                    />
                  </span>
                  <div className="font-semibold text-slate-800">{item.ten_phong}</div>
                  <div className="text-slate-600">{formatDateTime(item.gio_bat_dau)}</div>
                  <div className="text-slate-600">{formatDateTime(item.gio_ket_thuc)}</div>
                  <div className="text-slate-700">{formatBillDuration(item.gio_bat_dau, item.gio_ket_thuc)}</div>
                  <div className="text-right font-semibold text-slate-800">
                    {Math.round(item.tong_tien_san_pham).toLocaleString()}
                  </div>
                  <div className="text-right font-semibold text-slate-800">
                    {Math.round(item.tong_tien_gio).toLocaleString()}
                  </div>
                  <div className="text-right text-base font-semibold text-slate-800">
                    {Math.round(item.tong_tien_thanh_toan).toLocaleString()}
                  </div>
                  <div className="relative z-20 flex flex-col items-end">
                    <button
                      ref={(el) => {
                        optionButtonRefs.current[item.lich_su_phong_id] = el;
                      }}
                      type="button"
                      className="relative z-20 rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setMenuHistoryId((prev) => {
                          const next = prev === item.lich_su_phong_id ? null : item.lich_su_phong_id;
                          if (next == null) {
                            setMenuPosition(null);
                          } else {
                            setMenuPosition({
                              top: rect.bottom + 6,
                              right: window.innerWidth - rect.right,
                            });
                          }
                          return next;
                        });
                      }}
                    >
                      Tùy chọn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {histories.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Không có hóa đơn nào trong ngày đã chọn.
            </div>
          )}
        </div>
      </div>
      {menuHistoryId != null &&
        menuPosition &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: menuPosition.top, right: menuPosition.right }}
            className="fixed z-[120] w-44 rounded border border-slate-200 bg-white p-1 text-left shadow-lg"
          >
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
              onClick={() => {
                const item = histories.find((h) => h.lich_su_phong_id === menuHistoryId);
                if (item) void handleViewDetail(item);
              }}
            >
              Xem chi tiết
            </button>
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
              onClick={() => {
                const item = histories.find((h) => h.lich_su_phong_id === menuHistoryId);
                if (item) void handleOpenEdit(item);
              }}
            >
              Chỉnh sửa
            </button>
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
              onClick={async () => {
                setReprintingHistoryId(menuHistoryId);
                setReprintStatus(null);
                try {
                  const message = await onReprintBill(menuHistoryId);
                  setReprintStatus({ type: "ok", message });
                } catch (error) {
                  setReprintStatus({
                    type: "error",
                    message: `In lại hóa đơn thất bại: ${String(error)}`,
                  });
                }
                setReprintingHistoryId(null);
                setMenuHistoryId(null);
                setMenuPosition(null);
              }}
            >
              {reprintingHistoryId === menuHistoryId ? "Đang in..." : "In lại hóa đơn"}
            </button>
          </div>,
          document.body,
        )}

      {/* Detail modal */}
      {detailOpen && selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]">
          <div className="w-[760px] max-w-[96vw] rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">Chi tiết hóa đơn #{selectedHistory.lich_su_phong_id}</h3>
            <div className="mx-auto w-full max-w-[82mm] rounded-md border border-slate-200 bg-white p-3 text-[12px] font-mono shadow-sm">
              <div className="text-center text-sm font-bold">PHIẾU THANH TOÁN</div>
              <div className="mt-1 border-t border-dashed border-slate-300 pt-1 text-[11px]">
                <div>Phòng: {selectedHistory.ten_phong}</div>
                <div>Giờ vào: {formatDateTime(selectedHistory.gio_bat_dau)}</div>
                <div>Giờ ra: {formatDateTime(selectedHistory.gio_ket_thuc)}</div>
              </div>
              <div className="mt-2 border-y border-dashed border-slate-300 py-1">
                <div className="grid grid-cols-[1fr,40px,70px] font-semibold">
                  <span>Tên món</span>
                  <span className="text-right">SL</span>
                  <span className="text-right">T.Tiền</span>
                </div>
                {historyItems.map((item) => (
                  <div key={item.san_pham_id} className="grid grid-cols-[1fr,40px,70px]">
                    <span className="truncate">{item.ten_san_pham}</span>
                    <span className="text-right">{item.so_luong}</span>
                    <span className="text-right">{Math.round(item.thanh_tien).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>TIỀN MÓN</span>
                  <span>{Math.round(selectedHistory.tong_tien_san_pham).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIỀN GIỜ</span>
                  <span>{Math.round(selectedHistory.tong_tien_gio).toLocaleString()}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-dashed border-slate-300 pt-1 text-sm font-bold">
                  <span>TỔNG CỘNG</span>
                  <span>{Math.round(selectedHistory.tong_tien_thanh_toan).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button className="btn-ghost" onClick={() => setDetailOpen(false)}>
                Đóng
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setDetailOpen(false);
                  void handleOpenEdit(selectedHistory);
                }}
              >
                Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit paid bill modal */}
      {editOpen && editingHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]">
          <div className="flex max-h-[92vh] w-[1180px] max-w-[97vw] flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold">Chỉnh sửa hóa đơn #{editingHistory.lich_su_phong_id}</h3>
              <p className="mt-1 text-sm text-slate-500">Cập nhật tiền giờ, tổng tiền và số lượng sản phẩm.</p>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 lg:grid-cols-[1fr_320px]">
              <div className="min-h-0 overflow-y-auto pr-1">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tiền giờ</label>
                      <input
                        className="app-input w-full"
                        value={editTienGio}
                        inputMode="numeric"
                        onChange={(e) => setEditTienGio(formatMoneyInput(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tổng tiền</label>
                      <input
                        className="app-input w-full"
                        value={editTongTien}
                        inputMode="numeric"
                        onChange={(e) => setEditTongTien(formatMoneyInput(e.target.value))}
                      />
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      <p>Phòng: <span className="font-semibold text-slate-800">{editingHistory.ten_phong}</span></p>
                      <p>Giờ vào: {formatDateTime(editingHistory.gio_bat_dau)}</p>
                      <p>Giờ ra: {formatDateTime(editingHistory.gio_ket_thuc)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[1fr,110px,120px,140px] border-b bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <span>Tên món</span>
                    <span className="text-center">SL</span>
                    <span className="text-right">Đơn giá</span>
                    <span className="text-right">Thành tiền mới</span>
                  </div>
                  {historyItems.map((item) => {
                    const qty = Number(editQtyByProductId[item.san_pham_id] ?? item.so_luong);
                    const qtySafe = Number.isFinite(qty) && qty >= 0 ? qty : 0;
                    const thanhTienMoi = qtySafe * item.don_gia;
                    return (
                      <div key={item.san_pham_id} className="grid grid-cols-[1fr,110px,120px,140px] items-center border-b px-3 py-2 text-sm last:border-b-0">
                        <span className="font-medium text-slate-800">{item.ten_san_pham}</span>
                        <input
                          type="number"
                          min={0}
                          className="app-input h-8"
                          value={editQtyByProductId[item.san_pham_id] ?? String(item.so_luong)}
                          onChange={(e) =>
                            setEditQtyByProductId((prev) => ({
                              ...prev,
                              [item.san_pham_id]: e.target.value,
                            }))
                          }
                        />
                        <span className="text-right text-slate-700">{item.don_gia.toLocaleString()}</span>
                        <span className="text-right font-semibold text-slate-800">{thanhTienMoi.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {historyItems.length === 0 && (
                    <div className="px-3 py-4 text-sm text-slate-500">Không có món nào trong hóa đơn này.</div>
                  )}
                </div>

                <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Đặt số lượng = 0 để xóa món khỏi hóa đơn đã thanh toán.
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <Checkbox
                    checked={editPrintAfterSave}
                    onCheckedChange={(checked) => setEditPrintAfterSave(checked === true)}
                  />
                  <span className="text-slate-700">In hóa đơn sau khi lưu chỉnh sửa</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Xem Trước Hóa Đơn</h4>
                <div className="mx-auto w-full max-w-[80mm] rounded border border-slate-200 bg-white p-3 text-[12px] font-mono shadow-sm">
                  <div className="text-center text-sm font-bold">PHIẾU THANH TOÁN</div>
                  <div className="mt-1 border-y border-dashed border-slate-300 py-1">
                    {historyItems.map((item) => {
                      const qty = Number(editQtyByProductId[item.san_pham_id] ?? item.so_luong);
                      const qtySafe = Number.isFinite(qty) && qty >= 0 ? qty : 0;
                      return (
                        <div key={`pv-${item.san_pham_id}`} className="grid grid-cols-[1fr,40px,70px] text-[11px]">
                          <span className="truncate">{item.ten_san_pham}</span>
                          <span className="text-right">{qtySafe}</span>
                          <span className="text-right">{Math.round(qtySafe * item.don_gia).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                      <span>TIỀN MÓN</span>
                      <span>{Math.round(editTongTienMon).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TIỀN GIỜ</span>
                      <span>{parseMoneyInput(editTienGio || "0").toLocaleString()}</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t border-dashed border-slate-300 pt-1 text-sm font-bold">
                      <span>TỔNG CỘNG</span>
                      <span>{parseMoneyInput(editTongTien || "0").toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button className="btn-ghost" disabled={savingEdit} onClick={() => setEditOpen(false)}>
                Hủy
              </button>
              <button className="btn-secondary" disabled={savingEdit} onClick={() => void handleSaveEdit()}>
                {savingEdit ? "Đang lưu..." : "Lưu chỉnh sửa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AlertDialog: Confirm delete by IDs */}
      <AlertDialog open={deleteIdsDialogOpen} onOpenChange={setDeleteIdsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Xác nhận xóa hóa đơn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sắp xóa <strong>{selectedIds.size}</strong> hóa đơn đã thanh toán.
              Hành động này không thể hoàn tác. Dữ liệu sau khi xóa sẽ mất vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteByIds();
              }}
            >
              {deleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Confirm delete by date range */}
      <AlertDialog open={deleteRangeDialogOpen} onOpenChange={setDeleteRangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Xóa hóa đơn theo khoảng ngày</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Bạn sắp xóa <strong>tất cả</strong> hóa đơn đã thanh toán từ{" "}
                  <strong>{rangeStart}</strong> đến <strong>{rangeEnd}</strong>.
                </p>
                <p className="font-semibold text-rose-600">
                  Hành động này không thể hoàn tác!
                </p>
                <p>
                  Nhập <strong className="font-mono">XOA</strong> để xác nhận:
                </p>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono tracking-widest"
                  placeholder="Nhập XOA"
                  value={rangeConfirmText}
                  onChange={(e) => setRangeConfirmText(e.target.value.toUpperCase())}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setRangeConfirmText("")}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting || rangeConfirmText !== "XOA"}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteByRange();
              }}
            >
              {deleting ? "Đang xóa..." : "Xóa theo khoảng ngày"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
