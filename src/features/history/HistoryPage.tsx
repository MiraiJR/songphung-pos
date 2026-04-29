import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import type { HistoryOrderItem, PaidHistory } from "@/types/karaoke";

type Props = {
  histories: PaidHistory[];
  historyItems: HistoryOrderItem[];
  historyDate: string;
  onDateChange: (v: string) => void;
  onFilter: () => void;
  onOpenDetail: (historyId: number) => Promise<void>;
  onReprintBill: (historyId: number) => Promise<string>;
};

export function HistoryPage({
  histories,
  historyItems,
  historyDate,
  onDateChange,
  onFilter,
  onOpenDetail,
  onReprintBill,
}: Props) {
  const [menuHistoryId, setMenuHistoryId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<PaidHistory | null>(null);
  const [reprintStatus, setReprintStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [reprintingHistoryId, setReprintingHistoryId] = useState<number | null>(null);

  async function handleViewDetail(item: PaidHistory) {
    await onOpenDetail(item.lich_su_phong_id);
    setSelectedHistory(item);
    setDetailOpen(true);
    setMenuHistoryId(null);
  }

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
          <button className="btn-primary" onClick={onFilter}>
            Lọc
          </button>
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

      {reprintStatus && (
        <div
          className={`mb-3 rounded px-3 py-2 text-sm ${
            reprintStatus.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {reprintStatus.message}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div className="app-card col-span-2 overflow-hidden">
          <div className="grid grid-cols-[1.2fr,1.4fr,1fr,1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>Phòng</span>
            <span>Thời gian</span>
            <span className="text-right">Tổng tiền</span>
            <span className="text-right">Thao tác</span>
          </div>
          {histories.map((item) => (
            <div key={item.lich_su_phong_id} className="relative grid grid-cols-[1.2fr,1.4fr,1fr,1fr] items-center border-b border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">
              <div className="font-semibold text-slate-800">{item.ten_phong}</div>
              <div className="text-slate-600">
                {item.gio_bat_dau} - {item.gio_ket_thuc}
              </div>
              <div className="text-right text-base font-semibold text-slate-800">{item.tong_tien_thanh_toan.toLocaleString()}</div>
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
                <div className="absolute right-4 top-12 z-10 w-44 rounded border border-slate-200 bg-white p-1 shadow">
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
      {detailOpen && selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="w-[720px] max-w-[95vw] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Chi tiết hóa đơn #{selectedHistory.lich_su_phong_id}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Phòng: {selectedHistory.ten_phong}</div>
              <div>Giờ vào: {selectedHistory.gio_bat_dau}</div>
              <div>Giờ ra: {selectedHistory.gio_ket_thuc ?? "--"}</div>
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
    </section>
  );
}
