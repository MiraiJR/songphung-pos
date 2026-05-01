import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { CategoriesAdminPage } from "./features/categories/CategoriesAdminPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { PosPage } from "@/features/pos/PosPage";
import { ProductsAdminPage } from "@/features/products/ProductsAdminPage";
import { RoomsAdminPage } from "@/features/rooms/RoomsAdminPage";
import { PrinterSettingsPage } from "@/features/settings/PrinterSettingsPage";
import { Toaster } from "@/components/ui/sonner";
import { useKaraoke } from "@/hooks/useKaraoke";
import type { OrderItem, Product } from "@/types/karaoke";
import { formatInvokeError } from "@/utils/invokeError";

type PrinterConnectionStatus = {
  connected: boolean;
  address: string;
  message: string;
};
const PRINTER_STORAGE_KEY = "songphung_printer_target";

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Hiển thị số tiền trong ô nhập (dấu phẩy phân tách hàng nghìn). */
function formatAmountDigits(digits: string): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

function parseAmountInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (digits === "") return Number.NaN;
  return Number(digits);
}

function formatLocalDateTimeForBill(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function alertInvokeError(error: unknown, prefix?: string) {
  const msg = formatInvokeError(error);
  window.alert(prefix ? `${prefix} ${msg}` : msg);
}

function AppShell() {
  const [historyDate, setHistoryDate] = useState(() => todayLocalYmd());
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState("0");
  const [checkoutHourAmount, setCheckoutHourAmount] = useState("0");
  const [checkoutPrintReceipt, setCheckoutPrintReceipt] = useState(true);
  const [printerChecking, setPrinterChecking] = useState(false);
  const [printerConnected, setPrinterConnected] = useState<boolean | null>(null);
  const [printerMessage, setPrinterMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState("1");
  const [printerTarget, setPrinterTarget] = useState("");
  const [printTemporaryBillLoading, setPrintTemporaryBillLoading] = useState(false);
  const karaoke = useKaraoke();

  useEffect(() => {
    void (async () => {
      const saved = (localStorage.getItem(PRINTER_STORAGE_KEY) ?? "").trim();
      if (saved) {
        setPrinterTarget(saved);
        return;
      }
      try {
        const printers = await invoke<string[]>("get_system_printers");
        const firstPrinter = printers.find((name) => name.trim().length > 0) ?? "";
        if (firstPrinter) {
          setPrinterTarget(firstPrinter);
          localStorage.setItem(PRINTER_STORAGE_KEY, firstPrinter);
        }
      } catch {
        setPrinterTarget("");
      }
    })();
  }, []);

  useEffect(() => {
    if (!historyDate) return;
    void karaoke.loadHistory(historyDate);
  }, [historyDate, karaoke.loadHistory]);

  function updatePrinterTarget(value: string) {
    setPrinterTarget(value);
    localStorage.setItem(PRINTER_STORAGE_KEY, value);
  }

  async function handleStartRoom(roomId: number) {
    await invoke("start_room", { roomId });
    await karaoke.loadMasterData();
    karaoke.setSelectedRoomId(roomId);
    await karaoke.loadCurrentSession(roomId);
  }

  async function handleTransferRoom(targetRoomId: number) {
    if (!karaoke.currentSession || karaoke.selectedRoomId == null) return;
    await invoke("transfer_room", {
      payload: {
        history_id: karaoke.currentSession.lich_su_phong_id,
        source_room_id: karaoke.selectedRoomId,
        target_room_id: targetRoomId,
      },
    });
    await karaoke.loadMasterData();
    karaoke.setSelectedRoomId(targetRoomId);
    await karaoke.loadCurrentSession(targetRoomId);
  }

  async function handlePrintTemporaryBill() {
    if (karaoke.selectedRoom?.trang_thai !== "DANG_HOAT_DONG" || !karaoke.currentSession) {
      window.alert("Chỉ in phiếu tạm tính khi phòng đang hoạt động.");
      return;
    }
    const s = karaoke.currentSession;
    const gio_hien_tai = formatLocalDateTimeForBill(new Date());
    setPrintTemporaryBillLoading(true);
    try {
      await invoke("print_temporary_bill", {
        data: {
          room_name: s.ten_phong,
          gio_bat_dau: s.gio_bat_dau,
          gio_hien_tai,
          lich_su_phong_id: s.lich_su_phong_id,
          items: s.items.map((row) => ({
            ten_san_pham: row.ten_san_pham,
            so_luong: row.so_luong,
            don_gia: row.don_gia,
            thanh_tien: row.thanh_tien,
          })),
          tong_tien_san_pham: s.tong_tien_san_pham,
          tong_tien_gio: s.tong_tien_gio,
          tong_tam_tinh: s.tong_tien_thanh_toan,
        },
        printer_name_or_ip: printerTarget.trim() ? printerTarget.trim() : null,
      });
    } catch (error) {
      alertInvokeError(error, "Không in được phiếu tạm tính:");
    } finally {
      setPrintTemporaryBillLoading(false);
    }
  }

  function openOrderModal(product: Product, initialQty: number) {
    if (!karaoke.currentSession) return;
    setSelectedProduct(product);
    setQtyInput(String(initialQty));
    setOrderModalOpen(true);
  }

  async function saveOrderQty() {
    if (!karaoke.currentSession || !selectedProduct) return;
    const qty = Number(qtyInput);
    if (Number.isNaN(qty) || qty < 0) return;
    const historyId = karaoke.currentSession.lich_su_phong_id;
    if (qty === 0) {
      await invoke("remove_order_item", { historyId, productId: selectedProduct.san_pham_id });
    } else {
      await invoke("add_or_update_order_item", {
        historyId,
        productId: selectedProduct.san_pham_id,
        qty,
        price: selectedProduct.don_gia,
      });
    }
    setOrderModalOpen(false);
    setSelectedProduct(null);
    await karaoke.loadCurrentSession(karaoke.selectedRoomId);
  }

  async function handleEditItem(item: OrderItem) {
    if (!karaoke.currentSession) return;
    const product = karaoke.products.find((p) => p.san_pham_id === item.san_pham_id);
    if (!product) return;
    openOrderModal(product, item.so_luong);
  }

  async function handleRemoveItem(item: OrderItem) {
    if (!karaoke.currentSession) return;
    await invoke("remove_order_item", {
      historyId: karaoke.currentSession.lich_su_phong_id,
      productId: item.san_pham_id,
    });
    await karaoke.loadCurrentSession(karaoke.selectedRoomId);
  }

  async function handleAdjustItemQty(item: OrderItem, delta: number) {
    if (!karaoke.currentSession) return;
    const nextQty = item.so_luong + delta;
    const historyId = karaoke.currentSession.lich_su_phong_id;

    if (nextQty <= 0) {
      await invoke("remove_order_item", {
        historyId,
        productId: item.san_pham_id,
      });
    } else {
      await invoke("add_or_update_order_item", {
        historyId,
        productId: item.san_pham_id,
        qty: nextQty,
        price: item.don_gia,
      });
    }

    await karaoke.loadCurrentSession(karaoke.selectedRoomId);
  }

  function requestCancelRoom() {
    setCancelModalOpen(true);
  }

  async function handleCancelRoom() {
    setCancelModalOpen(false);

    let historyId = karaoke.currentSession?.lich_su_phong_id ?? 0;
    if (!historyId) {
      if (!karaoke.selectedRoomId) {
        window.alert("Vui lòng chọn phòng trước khi trả phòng.");
        return;
      }
      const active = await invoke<number | null>("get_active_history_id", {
        roomId: karaoke.selectedRoomId,
      });
      historyId = active ?? 0;
    }

    if (!historyId) {
      window.alert("Phòng hiện không có phiên phục vụ để trả.");
      return;
    }

    try {
      await invoke("cancel_room", { historyId, roomId: karaoke.selectedRoomId });
      await karaoke.loadMasterData();
      await karaoke.loadCurrentSession(karaoke.selectedRoomId);
    } catch (error) {
      window.alert(`Trả phòng thất bại: ${String(error)}`);
    }
  }

  function requestCheckout() {
    if (!karaoke.currentSession || !karaoke.selectedRoomId) {
      window.alert("Vui lòng chọn phòng đang phục vụ trước khi thanh toán.");
      return;
    }
    const defaultHourAmount = Math.max(0, Math.ceil(karaoke.currentSession.tong_tien_gio));
    const defaultAmount = Math.ceil(karaoke.currentSession.tong_tien_thanh_toan);
    setCheckoutHourAmount(formatAmountDigits(String(defaultHourAmount)));
    setCheckoutAmount(formatAmountDigits(String(defaultAmount)));
    setCheckoutPrintReceipt(true);
    setPrinterConnected(null);
    setPrinterMessage("");
    setCheckoutModalOpen(true);
    void checkPrinterConnection();
  }

  async function checkPrinterConnection() {
    if (!printerTarget.trim()) {
      setPrinterConnected(false);
      setPrinterMessage("Chưa cấu hình máy in. Vào Cài đặt để chọn máy in trước.");
      return null;
    }
    setPrinterChecking(true);
    try {
      const status = await invoke<PrinterConnectionStatus>("check_printer_connection", {
        printerAddr: printerTarget || null,
      });
      setPrinterConnected(status.connected);
      setPrinterMessage(status.message);
      return status;
    } catch (error) {
      setPrinterConnected(false);
      setPrinterMessage(`Không kiểm tra được máy in: ${String(error)}`);
      return null;
    } finally {
      setPrinterChecking(false);
    }
  }

  async function confirmCheckout() {
    if (!karaoke.currentSession || !karaoke.selectedRoomId) return;
    const hourAmount = parseAmountInput(checkoutHourAmount);
    if (Number.isNaN(hourAmount) || hourAmount < 0) {
      window.alert("Tiền giờ không hợp lệ.");
      return;
    }
    const finalAmount = parseAmountInput(checkoutAmount);
    if (Number.isNaN(finalAmount) || finalAmount < 0) {
      window.alert("Thành tiền không hợp lệ.");
      return;
    }
    if (checkoutPrintReceipt) {
      if (!printerTarget.trim()) {
        window.alert("Bạn chưa cấu hình máy in. Vào Cài đặt > Máy in để cấu hình hoặc bỏ chọn 'In hóa đơn'.");
        return;
      }
      const status = await checkPrinterConnection();
      if (!status?.connected) {
        window.alert("Không kết nối được máy in. Vui lòng bỏ chọn 'In hóa đơn' để tiếp tục thanh toán.");
        return;
      }
    }
    await invoke("checkout_room", {
      payload: {
        history_id: karaoke.currentSession.lich_su_phong_id,
        room_id: karaoke.selectedRoomId,
        hour_amount: hourAmount,
        final_amount: finalAmount,
        print_receipt: checkoutPrintReceipt,
        printer_name_or_ip: printerTarget || null,
      },
    });
    setCheckoutModalOpen(false);
    await karaoke.loadMasterData();
    await karaoke.loadCurrentSession(karaoke.selectedRoomId);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <PosPage
                rooms={karaoke.rooms}
                groups={karaoke.groups}
                products={karaoke.products}
                selectedRoomId={karaoke.selectedRoomId}
                selectedRoom={karaoke.selectedRoom}
                currentSession={karaoke.currentSession}
                onSelectRoom={karaoke.setSelectedRoomId}
                onStartRoom={handleStartRoom}
                onOpenOrderModal={openOrderModal}
                onAdjustItemQty={handleAdjustItemQty}
                onEditItem={handleEditItem}
                onRemoveItem={handleRemoveItem}
                onCancelRoom={requestCancelRoom}
                onCheckout={requestCheckout}
                onTransferRoom={handleTransferRoom}
                onPrintTemporaryBill={handlePrintTemporaryBill}
                printTemporaryBillLoading={printTemporaryBillLoading}
              />
              {orderModalOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
                  <div className="w-[340px] rounded-lg bg-white p-4 shadow-lg">
                    <div className="mb-2 text-sm text-slate-500">Nhập số lượng</div>
                    <div className="mb-2 text-lg font-semibold">{selectedProduct.ten_san_pham}</div>
                    <input
                      className="mb-3 w-full rounded border px-3 py-2 text-right text-2xl"
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "C", "OK"].map((key) => (
                        <button
                          key={key}
                          className={`rounded px-3 py-2 ${key === "OK" ? "bg-emerald-600 text-white" : "bg-slate-100"
                            }`}
                          onClick={() => {
                            if (key === "C") {
                              setQtyInput("0");
                              return;
                            }
                            if (key === "OK") {
                              void saveOrderQty();
                              return;
                            }
                            setQtyInput((prev) => `${prev === "0" ? "" : prev}${key}`);
                          }}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setOrderModalOpen(false);
                          setSelectedProduct(null);
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {cancelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
                  <div className="w-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                    <h3 className="mb-2 text-lg font-semibold">Xác nhận trả phòng</h3>
                    <p className="text-sm text-slate-600">
                      Bạn có chắc chắn muốn hủy phòng này? Dữ liệu gọi món sẽ bị xóa.
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="btn-ghost"
                        onClick={() => setCancelModalOpen(false)}
                      >
                        Không
                      </button>
                      <button
                        className="rounded bg-rose-600 px-3 py-2 text-white"
                        onClick={() => void handleCancelRoom()}
                      >
                        Đồng ý trả phòng
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {checkoutModalOpen && karaoke.currentSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
                  <div className="w-[460px] rounded-lg bg-white p-4 shadow-lg">
                    <h3 className="mb-2 text-lg font-semibold">Xác nhận thanh toán</h3>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-slate-500">Phòng:</span> {karaoke.currentSession.ten_phong}
                      </div>
                      <div>
                        <span className="text-slate-500">Tiền món:</span>{" "}
                        {Math.ceil(karaoke.currentSession.tong_tien_san_pham).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-sm text-slate-600">Tiền giờ</label>
                      <input
                        className="w-full rounded border px-3 py-2 text-right text-xl"
                        value={checkoutHourAmount}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          const nextHour = digits === "" ? "" : formatAmountDigits(digits);
                          setCheckoutHourAmount(nextHour);
                          const hour = digits === "" ? 0 : Number(digits);
                          const tienMon = Math.max(0, Math.ceil(karaoke.currentSession?.tong_tien_san_pham ?? 0));
                          setCheckoutAmount(formatAmountDigits(String(tienMon + hour)));
                        }}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-sm text-slate-600">Thành tiền</label>
                      <input
                        className="w-full rounded border px-3 py-2 text-right text-xl"
                        value={checkoutAmount}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setCheckoutAmount(digits === "" ? "" : formatAmountDigits(digits));
                        }}
                        inputMode="numeric"
                      />
                    </div>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checkoutPrintReceipt}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCheckoutPrintReceipt(checked);
                          if (checked) {
                            void checkPrinterConnection();
                          } else {
                            setPrinterConnected(null);
                            setPrinterMessage("");
                          }
                        }}
                      />
                      In hóa đơn
                    </label>
                    {checkoutPrintReceipt && (
                      <div
                        className={`mt-2 rounded px-2 py-1 text-sm ${printerConnected ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                      >
                        {printerChecking ? "Đang kiểm tra kết nối máy in..." : printerMessage || "Chưa kiểm tra máy in"}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="btn-ghost"
                        onClick={() => setCheckoutModalOpen(false)}
                      >
                        Hủy
                      </button>
                      <button className="btn-secondary" onClick={() => void confirmCheckout()}>
                        Xác nhận thanh toán
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <RoomsAdminPage
              rooms={karaoke.rooms}
              onCreate={async (data) => {
                await invoke("create_room", { payload: data });
                await karaoke.loadMasterData();
              }}
              onUpdate={async (data) => {
                await invoke("update_room", { payload: data });
                await karaoke.loadMasterData();
              }}
              onDelete={async (roomId) => {
                await invoke("delete_room", { roomId });
                await karaoke.loadMasterData();
              }}
            />
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProductsAdminPage
              products={karaoke.products}
              groups={karaoke.groups}
              onReloadMaster={() => karaoke.loadMasterData()}
              onCreate={async (data) => {
                const existed = karaoke.products.some((item) => item.san_pham_id === data.san_pham_id);
                if (existed) {
                  window.alert("Mã sản phẩm đã tồn tại");
                  return;
                }
                await invoke("create_product", {
                  payload: {
                    ...data,
                    nhom_san_pham_id: data.nhom_san_pham_id ? Number(data.nhom_san_pham_id) : null,
                  },
                });
                await karaoke.loadMasterData();
              }}
              onUpdate={async (data) => {
                await invoke("update_product", {
                  payload: {
                    ...data,
                    nhom_san_pham_id: data.nhom_san_pham_id ? Number(data.nhom_san_pham_id) : null,
                  },
                });
                await karaoke.loadMasterData();
              }}
              onDelete={async (id) => {
                await invoke("delete_product", { productId: id });
                await karaoke.loadMasterData();
              }}
            />
          }
        />
        <Route
          path="/admin/categories"
          element={
            <CategoriesAdminPage
              groups={karaoke.groups}
              onReloadMaster={() => karaoke.loadMasterData()}
              onCreate={async (payload: { ten_nhom: string; nhom_san_pham_cha_id: number | null }) => {
                await invoke("create_product_group", { payload });
                await karaoke.loadMasterData();
              }}
              onUpdate={async (payload: { nhom_san_pham_id: number; ten_nhom: string; nhom_san_pham_cha_id: number | null }) => {
                await invoke("update_product_group", { payload });
                await karaoke.loadMasterData();
              }}
              onDelete={async (groupId: number) => {
                try {
                  await invoke("delete_product_group", { nhomSanPhamId: groupId });
                  await karaoke.loadMasterData();
                } catch (error) {
                  window.alert(String(error));
                }
              }}
            />
          }
        />
        <Route
          path="/admin/history"
          element={
            <HistoryPage
              histories={karaoke.histories}
              historyItems={karaoke.historyItems}
              historyDate={historyDate}
              onDateChange={setHistoryDate}
              onFilter={() => void karaoke.loadHistory(historyDate)}
              onOpenDetail={(historyId) => karaoke.loadHistoryDetail(historyId)}
              onReprintBill={async (historyId) => {
                const printer = await invoke<{ connected: boolean; message: string }>(
                  "check_printer_connection",
                  { printerAddr: printerTarget || null },
                );
                if (!printer.connected) {
                  throw new Error(printer.message);
                }
                return invoke<string>("reprint_history_bill", { historyId, printerAddr: printerTarget || null });
              }}
              onDeleteByIds={async (ids) => {
                return invoke<number>("delete_history_by_ids", { ids });
              }}
              onDeleteByRange={async (startDate, endDate) => {
                return invoke<number>("delete_history_by_range", { startDate, endDate });
              }}
              onUpdateBill={async (historyId, tongTienGio, tongTienThanhToan, items) => {
                return invoke<string>("update_paid_history_bill", {
                  payload: {
                    history_id: historyId,
                    tong_tien_gio: tongTienGio,
                    tong_tien_thanh_toan: tongTienThanhToan,
                    items: items.map((item) => ({
                      san_pham_id: item.san_pham_id,
                      so_luong: item.so_luong,
                    })),
                  },
                });
              }}
              onReloadHistory={() => karaoke.loadHistory(historyDate)}
            />
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrinterSettingsPage
              printerTarget={printerTarget}
              onChangePrinterTarget={updatePrinterTarget}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
      <Toaster position="top-right" richColors closeButton />
    </HashRouter>
  );
}
