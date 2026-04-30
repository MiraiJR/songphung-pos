import { useState } from "react";
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
  onReloadHistory: () => Promise<void>;
};

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  onReloadHistory,
}: Props) {
  const [menuHistoryId, setMenuHistoryId] = useState<number | null>(null);
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

  async function handleViewDetail(item: PaidHistory) {
    await onOpenDetail(item.lich_su_phong_id);
    setSelectedHistory(item);
    setDetailOpen(true);
    setMenuHistoryId(null);
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

      <div className="grid grid-cols-3 gap-3">
        <div className="app-card col-span-2 overflow-visible">
          <div className="grid grid-cols-[40px,1.2fr,1.4fr,1fr,1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <span className="flex items-center justify-center">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
              />
            </span>
            <span>Phòng</span>
            <span>Thời gian</span>
            <span className="text-right">Tổng tiền</span>
            <span className="text-right">Thao tác</span>
          </div>
          {histories.map((item) => (
            <div
              key={item.lich_su_phong_id}
              className={`relative grid grid-cols-[40px,1.2fr,1.4fr,1fr,1fr] items-center border-b border-slate-200 px-4 py-3 text-sm hover:bg-slate-50 ${selectedIds.has(item.lich_su_phong_id) ? "bg-rose-50/50" : ""
                }`}
            >
              <span className="flex items-center justify-center">
                <Checkbox
                  checked={selectedIds.has(item.lich_su_phong_id)}
                  onCheckedChange={() => toggleSelect(item.lich_su_phong_id)}
                />
              </span>
              <div className="font-semibold text-slate-800">{item.ten_phong}</div>
              <div className="text-slate-600">
                {formatDateTime(item.gio_bat_dau)} - {formatDateTime(item.gio_ket_thuc)}
              </div>
              <div className="text-right text-base font-semibold text-slate-800">
                {item.tong_tien_thanh_toan.toLocaleString()}
              </div>
              <div className="text-right">
                <button
                  type="button"
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                  onClick={() =>
                    setMenuHistoryId((prev) => (prev === item.lich_su_phong_id ? null : item.lich_su_phong_id))
                  }
                >
                  Tùy chọn
                </button>
              </div>
              {menuHistoryId === item.lich_su_phong_id && (
                <div className="absolute right-4 top-full z-50 mt-1 w-44 rounded border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleViewDetail(item);
                    }}
                  >
                    Xem chi tiết
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setReprintingHistoryId(item.lich_su_phong_id);
                      setReprintStatus(null);
                      try {
                        const message = await onReprintBill(item.lich_su_phong_id);
                        setReprintStatus({ type: "ok", message });
                      } catch (error) {
                        setReprintStatus({
                          type: "error",
                          message: `In lại hóa đơn thất bại: ${String(error)}`,
                        });
                      }
                      setReprintingHistoryId(null);
                      setMenuHistoryId(null);
                    }}
                  >
                    {reprintingHistoryId === item.lich_su_phong_id ? "Đang in..." : "In lại hóa đơn"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {histories.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Không có hóa đơn nào trong ngày đã chọn.
            </div>
          )}
        </div>

        <div className="app-card p-3">
          <h3 className="mb-2 text-base font-semibold text-slate-800">Chi tiết hóa đơn</h3>
          {historyItems.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              Chọn một hóa đơn để xem chi tiết món đã gọi.
            </div>
          )}
          {historyItems.map((item) => (
            <div key={item.san_pham_id} className="border-b border-slate-200 py-2 text-sm">
              <div className="font-medium text-slate-800">{item.ten_san_pham}</div>
              <div className="text-slate-600">
                {item.so_luong} x {item.don_gia.toLocaleString()} = {item.thanh_tien.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail modal */}
      {detailOpen && selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="w-[720px] max-w-[95vw] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Chi tiết hóa đơn #{selectedHistory.lich_su_phong_id}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Phòng: {selectedHistory.ten_phong}</div>
              <div>Giờ vào: {formatDateTime(selectedHistory.gio_bat_dau)}</div>
              <div>Giờ ra: {formatDateTime(selectedHistory.gio_ket_thuc)}</div>
              <div>Tiền món: {selectedHistory.tong_tien_san_pham.toLocaleString()}</div>
              <div>Tiền giờ: {selectedHistory.tong_tien_gio.toLocaleString()}</div>
              <div className="font-semibold">Tổng thanh toán: {selectedHistory.tong_tien_thanh_toan.toLocaleString()}</div>
            </div>
            <div className="mt-3 rounded border">
              <div className="grid grid-cols-4 border-b bg-slate-50 px-3 py-2 text-sm font-medium">
                <span>Tên món</span>
                <span>SL</span>
                <span>Đơn giá</span>
                <span>Thành tiền</span>
              </div>
              {historyItems.map((item) => (
                <div key={item.san_pham_id} className="grid grid-cols-4 border-b px-3 py-2 text-sm">
                  <span>{item.ten_san_pham}</span>
                  <span>{item.so_luong}</span>
                  <span>{item.don_gia.toLocaleString()}</span>
                  <span>{item.thanh_tien.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn-ghost" onClick={() => setDetailOpen(false)}>
                Đóng
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
