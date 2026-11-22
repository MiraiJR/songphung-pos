import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog, DialogHeader } from "@/components/AppDialog";
import { Grid } from "@astryxdesign/core/Grid";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useToast } from "@astryxdesign/core/Toast";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { AppHeader } from "@/components/AppHeader";
import { BillTemplatePreview } from "@/components/billing/BillTemplatePreview";
import { ConfirmBillActionModal } from "@/components/billing/ConfirmBillActionModal";
import { Toaster } from "@/components/ui/sonner";
import { CategoriesAdminPage } from "./features/categories/CategoriesAdminPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { PosPage } from "@/features/pos/PosPage";
import { ProductsAdminPage } from "@/features/products/ProductsAdminPage";
import { RoomsAdminPage } from "@/features/rooms/RoomsAdminPage";
import { PrinterSettingsPage } from "@/features/settings/PrinterSettingsPage";
import { useKaraoke } from "@/hooks/useKaraoke";
import type { OrderItem, Product } from "@/types/karaoke";
import { formatInvokeError } from "@/utils/invokeError";

type PrinterConnectionStatus = {
  connected: boolean;
  address: string;
  message: string;
};
const LS_PRINTER_LEGACY = "songphung_printer_target";
const LS_QR_PRINT_LEGACY = "songphung_qr_print";
const LS_QR_FIXED_LEGACY = "songphung_qr_fixed";
const LS_QR_FIXED_AMOUNT_LEGACY = "songphung_qr_fixed_amount";
const LS_QR_SELECTED_ID_LEGACY = "songphung_qr_selected_id";

type BillQrSettings = {
  printQrOnReceipt: boolean;
  qrUseFixedAmount: boolean;
  qrFixedAmountVnd: number;
  selectedQrThanhToanId: number | null;
};

type PrintSettings = {
  printerTarget: string;
  printQrOnReceipt: boolean;
  qrUseFixedAmount: boolean;
  qrFixedAmountVnd: number;
  selectedQrThanhToanId: number | null;
};

type QrThanhToan = {
  qr_thanh_toan_id: number;
  qr_thanh_toan_ten: string;
  qr_code: string;
};

function buildQrSettingsForRealBill(input: {
  printQrOnReceipt: boolean;
  selectedQrThanhToanId: number | null;
}): BillQrSettings {
  return {
    printQrOnReceipt: input.printQrOnReceipt,
    qrUseFixedAmount: false,
    qrFixedAmountVnd: 0,
    selectedQrThanhToanId: input.selectedQrThanhToanId,
  };
}

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

function SongPhungShell() {
  const showToast = useToast();
  const [historyStart, setHistoryStart] = useState(() => todayLocalYmd());
  const [historyEnd, setHistoryEnd] = useState(() => todayLocalYmd());
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [temporaryBillModalOpen, setTemporaryBillModalOpen] = useState(false);
  const [temporaryBillNow, setTemporaryBillNow] = useState("");
  const [temporaryBillSelectedQrId, setTemporaryBillSelectedQrId] = useState<number | null>(null);
  const [checkoutQrPreviewUrl, setCheckoutQrPreviewUrl] = useState("");
  const [temporaryBillQrPreviewUrl, setTemporaryBillQrPreviewUrl] = useState("");
  const [checkoutAmount, setCheckoutAmount] = useState("0");
  const [checkoutHourAmount, setCheckoutHourAmount] = useState("0");
  const [checkoutPrintReceipt, setCheckoutPrintReceipt] = useState(true);
  const [printerChecking, setPrinterChecking] = useState(false);
  const [printerConnected, setPrinterConnected] = useState<boolean | null>(null);
  const [printerMessage, setPrinterMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState("1");
  const qtyFieldRef = useRef<HTMLInputElement>(null);
  const addQueueRef = useRef(Promise.resolve());
  const pendingQtyRef = useRef(new Map<string, number>());
  const [printerTarget, setPrinterTarget] = useState("");
  const [printTemporaryBillLoading, setPrintTemporaryBillLoading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [printBillQr, setPrintBillQr] = useState(true);
  const [qrUseFixedAmount, setQrUseFixedAmount] = useState(false);
  const [qrFixedAmountDisplay, setQrFixedAmountDisplay] = useState("");
  const [selectedQrThanhToanId, setSelectedQrThanhToanId] = useState<number | null>(null);
  const [qrThanhToanList, setQrThanhToanList] = useState<QrThanhToan[]>([]);
  const [printSettingsReady, setPrintSettingsReady] = useState(false);
  const karaoke = useKaraoke();

  async function persistPrintSettings(next: {
    printerTarget?: string;
    printBillQr?: boolean;
    qrUseFixedAmount?: boolean;
    qrFixedAmountDisplay?: string;
    selectedQrThanhToanId?: number | null;
  }) {
    const printer = next.printerTarget ?? printerTarget;
    const printQr = next.printBillQr ?? printBillQr;
    const useFixed = printQr ? (next.qrUseFixedAmount ?? qrUseFixedAmount) : false;
    const amountDisplay = next.qrFixedAmountDisplay ?? qrFixedAmountDisplay;
    const selectedId =
      next.selectedQrThanhToanId !== undefined ? next.selectedQrThanhToanId : selectedQrThanhToanId;
    const fixedAmountVnd = Number(amountDisplay.replace(/\D/g, "") || "0");

    try {
      await invoke("save_print_settings", {
        payload: {
          printerTarget: printer.trim(),
          printQrOnReceipt: printQr,
          qrUseFixedAmount: useFixed,
          qrFixedAmountVnd: Number.isFinite(fixedAmountVnd) ? Math.max(0, Math.floor(fixedAmountVnd)) : 0,
          selectedQrThanhToanId: selectedId,
        } satisfies PrintSettings,
      });
    } catch (error) {
      console.error("Không lưu được cài đặt in vào SQLite:", error);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        let settings = await invoke<PrintSettings>("get_print_settings");
        const hasDbConfig =
          settings.printerTarget.trim().length > 0 ||
          settings.selectedQrThanhToanId != null ||
          settings.qrFixedAmountVnd > 0 ||
          !settings.printQrOnReceipt ||
          settings.qrUseFixedAmount;

        // Migrate one-time from legacy localStorage if DB still has defaults.
        if (!hasDbConfig) {
          const legacyPrinter = (localStorage.getItem(LS_PRINTER_LEGACY) ?? "").trim();
          const legacyPrintQr = localStorage.getItem(LS_QR_PRINT_LEGACY) !== "0";
          const legacyUseFixed = localStorage.getItem(LS_QR_FIXED_LEGACY) === "1";
          const legacyFixedDigits = (localStorage.getItem(LS_QR_FIXED_AMOUNT_LEGACY) ?? "").replace(/\D/g, "");
          const legacySelectedRaw = Number(localStorage.getItem(LS_QR_SELECTED_ID_LEGACY) ?? "");
          const legacySelected =
            Number.isFinite(legacySelectedRaw) && legacySelectedRaw > 0 ? legacySelectedRaw : null;
          const legacyFixedAmount = Number(legacyFixedDigits || "0");

          if (
            legacyPrinter ||
            legacySelected != null ||
            legacyFixedAmount > 0 ||
            !legacyPrintQr ||
            legacyUseFixed
          ) {
            await invoke("save_print_settings", {
              payload: {
                printerTarget: legacyPrinter,
                printQrOnReceipt: legacyPrintQr,
                qrUseFixedAmount: legacyUseFixed,
                qrFixedAmountVnd: Number.isFinite(legacyFixedAmount)
                  ? Math.max(0, Math.floor(legacyFixedAmount))
                  : 0,
                selectedQrThanhToanId: legacySelected,
              } satisfies PrintSettings,
            });
            settings = await invoke<PrintSettings>("get_print_settings");
            localStorage.removeItem(LS_PRINTER_LEGACY);
            localStorage.removeItem(LS_QR_PRINT_LEGACY);
            localStorage.removeItem(LS_QR_FIXED_LEGACY);
            localStorage.removeItem(LS_QR_FIXED_AMOUNT_LEGACY);
            localStorage.removeItem(LS_QR_SELECTED_ID_LEGACY);
          }
        }

        let nextPrinter = settings.printerTarget.trim();
        if (!nextPrinter) {
          try {
            const printers = await invoke<string[]>("get_system_printers");
            nextPrinter = printers.find((name) => name.trim().length > 0) ?? "";
            if (nextPrinter) {
              await invoke("save_print_settings", {
                payload: {
                  ...settings,
                  printerTarget: nextPrinter,
                } satisfies PrintSettings,
              });
            }
          } catch {
            nextPrinter = "";
          }
        }

        setPrinterTarget(nextPrinter);
        setPrintBillQr(settings.printQrOnReceipt);
        setQrUseFixedAmount(settings.qrUseFixedAmount);
        setQrFixedAmountDisplay(
          settings.qrFixedAmountVnd > 0 ? formatAmountDigits(String(settings.qrFixedAmountVnd)) : "",
        );
        setSelectedQrThanhToanId(settings.selectedQrThanhToanId);
      } catch (error) {
        console.error("Không tải được cài đặt in từ SQLite:", error);
      } finally {
        setPrintSettingsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!printSettingsReady) return;
    void (async () => {
      try {
        const list = await invoke<QrThanhToan[]>("list_qr_thanh_toan");
        setQrThanhToanList(list);
        if (list.length === 0) {
          if (selectedQrThanhToanId != null) {
            setSelectedQrThanhToanId(null);
            await persistPrintSettings({ selectedQrThanhToanId: null });
          }
          return;
        }
        if (selectedQrThanhToanId == null || !list.some((x) => x.qr_thanh_toan_id === selectedQrThanhToanId)) {
          const nextId = list[0].qr_thanh_toan_id;
          setSelectedQrThanhToanId(nextId);
          await persistPrintSettings({ selectedQrThanhToanId: nextId });
        }
      } catch {
        // ignore; settings page will show detailed errors
      }
    })();
    // Only re-run when settings finish loading; list sync uses current selected id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printSettingsReady]);

  useEffect(() => {
    if (!historyStart || !historyEnd) return;
    void karaoke.loadHistory(historyStart, historyEnd);
  }, [historyStart, historyEnd, karaoke.loadHistory]);

  useEffect(() => {
    if (!orderModalOpen) return;
    const timer = window.setTimeout(() => {
      qtyFieldRef.current?.focus();
      qtyFieldRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [orderModalOpen, selectedProduct]);

  function updatePrinterTarget(value: string) {
    setPrinterTarget(value);
    void persistPrintSettings({ printerTarget: value });
  }

  function persistQrPrint(value: boolean) {
    setPrintBillQr(value);
    if (!value) {
      setQrUseFixedAmount(false);
      void persistPrintSettings({ printBillQr: false, qrUseFixedAmount: false });
      return;
    }
    void persistPrintSettings({ printBillQr: value });
  }

  function persistQrUseFixed(value: boolean) {
    setQrUseFixedAmount(value);
    void persistPrintSettings({ qrUseFixedAmount: value });
  }

  function persistQrFixedAmountDisplay(value: string) {
    const digits = value.replace(/\D/g, "");
    const display = digits ? formatAmountDigits(digits) : "";
    setQrFixedAmountDisplay(display);
    void persistPrintSettings({ qrFixedAmountDisplay: display });
  }

  function persistSelectedQrId(value: number | null) {
    setSelectedQrThanhToanId(value);
    void persistPrintSettings({ selectedQrThanhToanId: value });
  }

  async function loadQrPreviewDataUrlById(qrId: number | null): Promise<string> {
    if (qrId == null) return "";
    try {
      return await invoke<string>("get_qr_thanh_toan_preview_data_url", { qrThanhToanId: qrId });
    } catch {
      return "";
    }
  }

  useEffect(() => {
    if (!checkoutModalOpen || !printBillQr) {
      setCheckoutQrPreviewUrl("");
      return;
    }
    void (async () => {
      const url = await loadQrPreviewDataUrlById(selectedQrThanhToanId);
      setCheckoutQrPreviewUrl(url);
    })();
  }, [checkoutModalOpen, printBillQr, selectedQrThanhToanId]);

  useEffect(() => {
    if (!temporaryBillModalOpen || !printBillQr) {
      setTemporaryBillQrPreviewUrl("");
      return;
    }
    void (async () => {
      const url = await loadQrPreviewDataUrlById(temporaryBillSelectedQrId);
      setTemporaryBillQrPreviewUrl(url);
    })();
  }, [temporaryBillModalOpen, printBillQr, temporaryBillSelectedQrId]);

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

  async function requestTemporaryBill() {
    if (karaoke.selectedRoom?.trang_thai !== "DANG_HOAT_DONG" || !karaoke.currentSession) {
      window.alert("Chỉ in phiếu tạm tính khi phòng đang hoạt động.");
      return;
    }
    setTemporaryBillNow(formatLocalDateTimeForBill(new Date()));
    setTemporaryBillSelectedQrId(selectedQrThanhToanId);
    setTemporaryBillModalOpen(true);
  }

  async function handlePrintTemporaryBill() {
    if (karaoke.selectedRoom?.trang_thai !== "DANG_HOAT_DONG" || !karaoke.currentSession) {
      window.alert("Chỉ in phiếu tạm tính khi phòng đang hoạt động.");
      return;
    }
    const s = karaoke.currentSession;
    const gio_hien_tai = temporaryBillNow || formatLocalDateTimeForBill(new Date());
    setPrintTemporaryBillLoading(true);
    try {
      await invoke("print_temporary_bill", {
        data: {
          roomName: s.ten_phong,
          gioBatDau: s.gio_bat_dau,
          gioHienTai: gio_hien_tai,
          lichSuPhongId: s.lich_su_phong_id,
          items: s.items.map((row) => ({
            tenSanPham: row.ten_san_pham,
            soLuong: row.so_luong,
            donGia: row.don_gia,
            thanhTien: row.thanh_tien,
          })),
          tongTienSanPham: s.tong_tien_san_pham,
          tongTienGio: s.tong_tien_gio,
          tongTamTinh: s.tong_tien_thanh_toan,
        },
        printerNameOrIp: printerTarget.trim() ? printerTarget.trim() : null,
        qrSettings: buildQrSettingsForRealBill({
          printQrOnReceipt: printBillQr,
          selectedQrThanhToanId: temporaryBillSelectedQrId,
        }),
      });
      setTemporaryBillModalOpen(false);
    } catch (error) {
      alertInvokeError(error, "Không in được phiếu tạm tính:");
    } finally {
      setPrintTemporaryBillLoading(false);
    }
  }

  async function refreshRoomBill() {
    await karaoke.loadCurrentSession(karaoke.selectedRoomId);
    await karaoke.loadRooms();
  }

  async function restoreRemovedItem(historyId: number, roomId: number, item: OrderItem) {
    try {
      await invoke("add_or_update_order_item", {
        historyId,
        productId: item.san_pham_id,
        qty: item.so_luong,
        price: item.don_gia,
      });
      if (karaoke.selectedRoomId === roomId) {
        await karaoke.loadCurrentSession(roomId);
      }
      await karaoke.loadRooms();
    } catch (error) {
      showToast({ body: `Hoàn tác thất bại: ${String(error)}`, type: "error" });
    }
  }

  function offerUndoRemove(historyId: number, roomId: number, item: OrderItem) {
    showToast({
      body: `Đã xóa ${item.ten_san_pham}`,
      autoHideDuration: 6000,
      endContent: (
        <Button
          label="Hoàn tác"
          size="sm"
          variant="secondary"
          onClick={() => void restoreRemovedItem(historyId, roomId, item)}
        />
      ),
    });
  }

  function handleAddProduct(product: Product) {
    if (!karaoke.currentSession || karaoke.selectedRoom?.trang_thai !== "DANG_HOAT_DONG") {
      showToast({ body: "Mở phòng trước khi gọi món.", type: "error" });
      return;
    }
    const historyId = karaoke.currentSession.lich_su_phong_id;
    const existing = karaoke.currentSession.items.find((item) => item.san_pham_id === product.san_pham_id);
    const base = pendingQtyRef.current.get(product.san_pham_id) ?? existing?.so_luong ?? 0;
    const nextQty = base + 1;
    pendingQtyRef.current.set(product.san_pham_id, nextQty);

    addQueueRef.current = addQueueRef.current.then(async () => {
      try {
        await invoke("add_or_update_order_item", {
          historyId,
          productId: product.san_pham_id,
          qty: nextQty,
          price: product.don_gia,
        });
        await refreshRoomBill();
        if (pendingQtyRef.current.get(product.san_pham_id) === nextQty) {
          pendingQtyRef.current.delete(product.san_pham_id);
        }
      } catch (error) {
        pendingQtyRef.current.delete(product.san_pham_id);
        showToast({ body: `Thêm món thất bại: ${String(error)}`, type: "error" });
      }
    });
  }

  function openOrderModal(product: Product, initialQty: number) {
    if (!karaoke.currentSession) return;
    setSelectedProduct(product);
    setQtyInput(String(initialQty));
    setOrderModalOpen(true);
  }

  async function saveOrderQty() {
    if (!karaoke.currentSession || !selectedProduct || orderSubmitting) return;
    const qty = Number(qtyInput);
    if (Number.isNaN(qty) || qty < 0) return;
    const historyId = karaoke.currentSession.lich_su_phong_id;
    setOrderSubmitting(true);
    try {
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
      await refreshRoomBill();
      if (qty === 0) {
        const removed = karaoke.currentSession.items.find((item) => item.san_pham_id === selectedProduct.san_pham_id);
        if (removed && karaoke.selectedRoomId != null) {
          offerUndoRemove(historyId, karaoke.selectedRoomId, removed);
        }
      }
    } catch (error) {
      window.alert(`Lưu món thất bại: ${String(error)}`);
    } finally {
      setOrderSubmitting(false);
    }
  }

  async function handleEditItem(item: OrderItem) {
    if (!karaoke.currentSession) return;
    const product = karaoke.products.find((p) => p.san_pham_id === item.san_pham_id);
    if (!product) return;
    openOrderModal(product, item.so_luong);
  }

  async function handleAdjustItemQty(item: OrderItem, delta: number) {
    if (!karaoke.currentSession || karaoke.selectedRoomId == null) return;
    const nextQty = item.so_luong + delta;
    const historyId = karaoke.currentSession.lich_su_phong_id;
    const roomId = karaoke.selectedRoomId;

    try {
      if (nextQty <= 0) {
        await invoke("remove_order_item", {
          historyId,
          productId: item.san_pham_id,
        });
        await refreshRoomBill();
        offerUndoRemove(historyId, roomId, item);
        return;
      }

      await invoke("add_or_update_order_item", {
        historyId,
        productId: item.san_pham_id,
        qty: nextQty,
        price: item.don_gia,
      });
      await refreshRoomBill();
    } catch (error) {
      showToast({ body: `Cập nhật món thất bại: ${String(error)}`, type: "error" });
    }
  }

  function requestCancelRoom() {
    setCancelModalOpen(true);
  }

  async function handleCancelRoom() {
    setCancelSubmitting(true);
    setCancelModalOpen(false);

    let historyId = karaoke.currentSession?.lich_su_phong_id ?? 0;
    if (!historyId) {
      if (!karaoke.selectedRoomId) {
        setCancelSubmitting(false);
        window.alert("Vui lòng chọn phòng trước khi trả phòng.");
        return;
      }
      const active = await invoke<number | null>("get_active_history_id", {
        roomId: karaoke.selectedRoomId,
      });
      historyId = active ?? 0;
    }

    if (!historyId) {
      setCancelSubmitting(false);
      window.alert("Phòng hiện không có phiên phục vụ để trả.");
      return;
    }

    try {
      await invoke("cancel_room", { historyId, roomId: karaoke.selectedRoomId });
      await karaoke.loadMasterData();
      await karaoke.loadCurrentSession(karaoke.selectedRoomId);
    } catch (error) {
      window.alert(`Trả phòng thất bại: ${String(error)}`);
    } finally {
      setCancelSubmitting(false);
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
    const canPrint = printerTarget.trim().length > 0;
    setCheckoutPrintReceipt(canPrint);
    setPrinterConnected(null);
    setPrinterMessage(canPrint ? "" : "Chưa cấu hình máy in. Vẫn có thể thanh toán mà không in hóa đơn.");
    setCheckoutModalOpen(true);
    if (canPrint) {
      void (async () => {
        const status = await checkPrinterConnection();
        if (!status?.connected) {
          setCheckoutPrintReceipt(false);
        }
      })();
    }
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
    if (!karaoke.currentSession || !karaoke.selectedRoomId || checkoutSubmitting) return;
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
    setCheckoutSubmitting(true);
    let shouldPrint = checkoutPrintReceipt;
    try {
      if (shouldPrint) {
        if (!printerTarget.trim()) {
          shouldPrint = false;
          setCheckoutPrintReceipt(false);
        } else {
          const status = await checkPrinterConnection();
          if (!status?.connected) {
            shouldPrint = false;
            setCheckoutPrintReceipt(false);
            setPrinterMessage("Không kết nối được máy in. Vẫn tiếp tục thanh toán mà không in hóa đơn.");
          }
        }
      }
      await invoke("checkout_room", {
        payload: {
          history_id: karaoke.currentSession.lich_su_phong_id,
          room_id: karaoke.selectedRoomId,
          hour_amount: hourAmount,
          final_amount: finalAmount,
          print_receipt: shouldPrint,
          printer_name_or_ip: printerTarget || null,
          qr_settings: buildQrSettingsForRealBill({
            printQrOnReceipt: printBillQr,
            selectedQrThanhToanId,
          }),
        },
      });
      setCheckoutModalOpen(false);
      await karaoke.loadMasterData();
      await karaoke.loadCurrentSession(karaoke.selectedRoomId);
    } catch (error) {
      window.alert(`Thanh toán thất bại: ${String(error)}`);
    } finally {
      setCheckoutSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7f9] text-slate-800">
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
                onAddProduct={handleAddProduct}
                onAdjustItemQty={handleAdjustItemQty}
                onEditItem={handleEditItem}
                onRefreshRooms={karaoke.loadRooms}
                onCancelRoom={requestCancelRoom}
                onCheckout={requestCheckout}
                onTransferRoom={handleTransferRoom}
                onPrintTemporaryBill={requestTemporaryBill}
                printTemporaryBillLoading={printTemporaryBillLoading}
                checkoutLoading={checkoutSubmitting}
                cancelLoading={cancelSubmitting}
              />
              <Dialog
                isOpen={orderModalOpen && selectedProduct != null}
                onOpenChange={(next) => {
                  if (!next && !orderSubmitting) {
                    setOrderModalOpen(false);
                    setSelectedProduct(null);
                  }
                }}
                width={360}
                purpose="form"
                padding={0}
              >
                <VStack>
                  <DialogHeader
                    title={selectedProduct?.ten_san_pham ?? "Nhập số lượng"}
                    subtitle="Nhập số lượng"
                    onOpenChange={(next) => {
                      if (!next && !orderSubmitting) {
                        setOrderModalOpen(false);
                        setSelectedProduct(null);
                      }
                    }}
                  />
                  <VStack padding={4} gap={3}>
                    <TextInput
                      label="Số lượng"
                      isLabelHidden
                      value={qtyInput}
                      onChange={(v) => setQtyInput(v.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      hasAutoFocus
                      ref={qtyFieldRef}
                      onEnter={() => void saveOrderQty()}
                      isDisabled={orderSubmitting}
                      width="100%"
                      size="lg"
                      controlStyle={{ textAlign: "right" }}
                    />
                    <Grid columns={3} gap={2}>
                      {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "C", "OK"].map((key) => (
                        <Button
                          key={key}
                          label={key}
                          width="100%"
                          size="lg"
                          variant={key === "OK" ? "primary" : "secondary"}
                          isDisabled={orderSubmitting}
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
                        />
                      ))}
                    </Grid>
                    <HStack hAlign="end">
                      <Button
                        label="Hủy"
                        variant="ghost"
                        isDisabled={orderSubmitting}
                        onClick={() => {
                          setOrderModalOpen(false);
                          setSelectedProduct(null);
                        }}
                      />
                    </HStack>
                  </VStack>
                </VStack>
              </Dialog>
              <Dialog
                isOpen={cancelModalOpen}
                onOpenChange={(next) => {
                  if (!next && !cancelSubmitting) setCancelModalOpen(false);
                }}
                width={440}
                purpose="required"
                padding={0}
              >
                <VStack>
                  <DialogHeader
                    title="Xác nhận trả phòng"
                    onOpenChange={(next) => {
                      if (!next && !cancelSubmitting) setCancelModalOpen(false);
                    }}
                  />
                  <VStack padding={4} gap={4}>
                    <Text>
                      Bạn có chắc chắn muốn hủy phòng này? Dữ liệu gọi món sẽ bị xóa.
                    </Text>
                    <HStack gap={2} hAlign="end">
                      <Button
                        label="Không"
                        variant="ghost"
                        isDisabled={cancelSubmitting}
                        onClick={() => setCancelModalOpen(false)}
                      />
                      <Button
                        label={cancelSubmitting ? "Đang trả phòng..." : "Đồng ý trả phòng"}
                        variant="destructive"
                        isLoading={cancelSubmitting}
                        isDisabled={cancelSubmitting}
                        onClick={() => void handleCancelRoom()}
                      />
                    </HStack>
                  </VStack>
                </VStack>
              </Dialog>
              {checkoutModalOpen && karaoke.currentSession && (
                <ConfirmBillActionModal
                  open={checkoutModalOpen}
                  title="Xác nhận thanh toán"
                  confirmText="Xác nhận thanh toán"
                  busy={checkoutSubmitting}
                  onClose={() => {
                    if (!checkoutSubmitting) setCheckoutModalOpen(false);
                  }}
                  onConfirm={() => void confirmCheckout()}
                  leftContent={
                    <VStack gap={3} width="100%">
                      <VStack gap={0.5}>
                        <Text color="secondary">
                          Phòng:{" "}
                          <Text weight="semibold">{karaoke.currentSession.ten_phong}</Text>
                        </Text>
                        <Text color="secondary">
                          Tiền món:{" "}
                          <Text weight="semibold" hasTabularNumbers>
                            {Math.max(
                              0,
                              Math.ceil(karaoke.currentSession.tong_tien_san_pham),
                            ).toLocaleString()}
                          </Text>
                        </Text>
                      </VStack>
                      <TextInput
                        label="Tiền giờ"
                        value={checkoutHourAmount}
                        onChange={(v) => {
                          const digits = v.replace(/\D/g, "");
                          const nextHour = digits === "" ? "" : formatAmountDigits(digits);
                          setCheckoutHourAmount(nextHour);
                          const hour = digits === "" ? 0 : Number(digits);
                          const tienMon = Math.max(
                            0,
                            Math.ceil(karaoke.currentSession?.tong_tien_san_pham ?? 0),
                          );
                          setCheckoutAmount(formatAmountDigits(String(tienMon + hour)));
                        }}
                        inputMode="numeric"
                        isDisabled={checkoutSubmitting}
                        width="100%"
                        size="lg"
                        controlStyle={{ textAlign: "right" }}
                      />
                      <TextInput
                        label="Thành tiền"
                        value={checkoutAmount}
                        onChange={(v) => {
                          const digits = v.replace(/\D/g, "");
                          setCheckoutAmount(digits === "" ? "" : formatAmountDigits(digits));
                        }}
                        inputMode="numeric"
                        isDisabled={checkoutSubmitting}
                        width="100%"
                        size="lg"
                        controlStyle={{ textAlign: "right" }}
                      />
                      <CheckboxInput
                        label="In hóa đơn"
                        value={checkoutPrintReceipt}
                        isDisabled={checkoutSubmitting}
                        onChange={(next) => {
                          setCheckoutPrintReceipt(next);
                          if (next) {
                            void checkPrinterConnection();
                          } else {
                            setPrinterConnected(null);
                            setPrinterMessage("");
                          }
                        }}
                      />
                      {checkoutPrintReceipt && printBillQr && (
                        <Selector
                          label="QR thanh toán"
                          hasClear
                          placeholder="-- Chọn QR --"
                          options={qrThanhToanList.map((item) => ({
                            value: String(item.qr_thanh_toan_id),
                            label: item.qr_thanh_toan_ten,
                          }))}
                          value={
                            selectedQrThanhToanId != null
                              ? String(selectedQrThanhToanId)
                              : null
                          }
                          onChange={(v) => {
                            if (v == null) {
                              persistSelectedQrId(null);
                              return;
                            }
                            const id = Number(v);
                            persistSelectedQrId(Number.isFinite(id) && id > 0 ? id : null);
                          }}
                          isDisabled={checkoutSubmitting}
                          width="100%"
                        />
                      )}
                      {checkoutPrintReceipt && !printBillQr && (
                        <Text type="supporting" color="secondary">
                          Đã tắt mã QR trong Cài đặt. Hóa đơn sẽ in không kèm QR.
                        </Text>
                      )}
                      {!checkoutPrintReceipt && (
                        <Text type="supporting" color="secondary">
                          Thanh toán không bắt buộc máy in. Bỏ chọn in hóa đơn để hoàn tất ngay.
                        </Text>
                      )}
                      {(checkoutPrintReceipt || printerMessage) && (
                        <Banner
                          status={
                            checkoutPrintReceipt
                              ? printerConnected
                                ? "success"
                                : "error"
                              : "warning"
                          }
                          title={
                            printerChecking
                              ? "Đang kiểm tra kết nối máy in..."
                              : printerMessage || "Chưa kiểm tra máy in"
                          }
                          collapsible={false}
                        />
                      )}
                    </VStack>
                  }
                  rightContent={
                    <BillTemplatePreview
                      title="PHIẾU THANH TOÁN"
                      roomName={karaoke.currentSession.ten_phong}
                      startedAt={karaoke.currentSession.gio_bat_dau}
                      endedAt={formatLocalDateTimeForBill(new Date())}
                      billNumber={karaoke.currentSession.lich_su_phong_id}
                      items={karaoke.currentSession.items.map((item) => ({
                        id: `checkout-pv-${item.san_pham_id}`,
                        name: item.ten_san_pham,
                        qty: item.so_luong,
                        unitPrice: item.don_gia,
                        amount: item.thanh_tien,
                      }))}
                      productTotal={karaoke.currentSession.tong_tien_san_pham}
                      hourTotal={Math.max(0, parseAmountInput(checkoutHourAmount) || 0)}
                      grandTotal={Math.max(0, parseAmountInput(checkoutAmount) || 0)}
                      qrDataUrl={printBillQr ? checkoutQrPreviewUrl : ""}
                    />
                  }
                />
              )}
              {temporaryBillModalOpen && karaoke.currentSession && (
                <ConfirmBillActionModal
                  open={temporaryBillModalOpen}
                  title="Xác nhận in phiếu tạm tính"
                  confirmText={printTemporaryBillLoading ? "Đang in..." : "Xác nhận in phiếu"}
                  busy={printTemporaryBillLoading}
                  onClose={() => setTemporaryBillModalOpen(false)}
                  onConfirm={() => void handlePrintTemporaryBill()}
                  leftContent={
                    <VStack gap={3} width="100%">
                      <VStack gap={0.5}>
                        <Text color="secondary">
                          Phòng:{" "}
                          <Text weight="semibold">{karaoke.currentSession.ten_phong}</Text>
                        </Text>
                        <Text color="secondary">
                          Giờ vào: {karaoke.currentSession.gio_bat_dau}
                        </Text>
                        <Text color="secondary">Giờ hiện tại: {temporaryBillNow}</Text>
                      </VStack>
                      {printBillQr ? (
                        <Selector
                          label="QR thanh toán"
                          hasClear
                          placeholder="-- Chọn QR --"
                          options={qrThanhToanList.map((item) => ({
                            value: String(item.qr_thanh_toan_id),
                            label: item.qr_thanh_toan_ten,
                          }))}
                          value={
                            temporaryBillSelectedQrId != null
                              ? String(temporaryBillSelectedQrId)
                              : null
                          }
                          onChange={(v) => {
                            if (v == null) {
                              setTemporaryBillSelectedQrId(null);
                              persistSelectedQrId(null);
                              return;
                            }
                            const id = Number(v);
                            const nextId = Number.isFinite(id) && id > 0 ? id : null;
                            setTemporaryBillSelectedQrId(nextId);
                            persistSelectedQrId(nextId);
                          }}
                          width="100%"
                        />
                      ) : (
                        <Text type="supporting" color="secondary">
                          Đã tắt mã QR trong Cài đặt. Phiếu tạm tính sẽ in không kèm QR.
                        </Text>
                      )}
                    </VStack>
                  }
                  rightContent={
                    <BillTemplatePreview
                      title="PHIẾU TẠM TÍNH"
                      roomName={karaoke.currentSession.ten_phong}
                      startedAt={karaoke.currentSession.gio_bat_dau}
                      endedAt={temporaryBillNow}
                      billNumber={karaoke.currentSession.lich_su_phong_id}
                      items={karaoke.currentSession.items.map((item) => ({
                        id: `temp-pv-${item.san_pham_id}`,
                        name: item.ten_san_pham,
                        qty: item.so_luong,
                        unitPrice: item.don_gia,
                        amount: item.thanh_tien,
                      }))}
                      productTotal={karaoke.currentSession.tong_tien_san_pham}
                      hourTotal={karaoke.currentSession.tong_tien_gio}
                      grandTotal={karaoke.currentSession.tong_tien_thanh_toan}
                      qrDataUrl={printBillQr ? temporaryBillQrPreviewUrl : ""}
                    />
                  }
                />
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
              products={karaoke.products}
              historyStart={historyStart}
              historyEnd={historyEnd}
              onStartChange={setHistoryStart}
              onEndChange={setHistoryEnd}
              onFilter={() => karaoke.loadHistory(historyStart, historyEnd)}
              onOpenDetail={(historyId) => karaoke.loadHistoryDetail(historyId)}
              onReprintBill={async (historyId, selectedQrId) => {
                const printer = await invoke<{ connected: boolean; message: string }>(
                  "check_printer_connection",
                  { printerAddr: printerTarget || null },
                );
                if (!printer.connected) {
                  throw new Error(printer.message);
                }
                return invoke<string>("reprint_history_bill", {
                  historyId,
                  printerAddr: printerTarget || null,
                  qrSettings: buildQrSettingsForRealBill({
                    printQrOnReceipt: printBillQr,
                    selectedQrThanhToanId: selectedQrId,
                  }),
                });
              }}
              qrThanhToanOptions={qrThanhToanList.map((item) => ({
                qr_thanh_toan_id: item.qr_thanh_toan_id,
                qr_thanh_toan_ten: item.qr_thanh_toan_ten,
              }))}
              defaultSelectedQrThanhToanId={selectedQrThanhToanId}
              printBillQr={printBillQr}
              onDeleteByIds={async (ids) => {
                return invoke<number>("delete_history_by_ids", { ids });
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
              onReloadHistory={() => karaoke.loadHistory(historyStart, historyEnd)}
            />
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrinterSettingsPage
              printerTarget={printerTarget}
              onChangePrinterTarget={updatePrinterTarget}
              printBillQr={printBillQr}
              onPrintBillQrChange={persistQrPrint}
              qrUseFixedAmount={qrUseFixedAmount}
              onQrUseFixedAmountChange={persistQrUseFixed}
              qrFixedAmountDisplay={qrFixedAmountDisplay}
              onQrFixedAmountDisplayChange={persistQrFixedAmountDisplay}
              selectedQrThanhToanId={selectedQrThanhToanId}
              onSelectedQrThanhToanIdChange={persistSelectedQrId}
              onDataChanged={async () => {
                await karaoke.loadMasterData();
                await karaoke.loadCurrentSession(karaoke.selectedRoomId);
                await karaoke.loadHistory(historyStart, historyEnd);
              }}
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
      <SongPhungShell />
      <Toaster position="top-right" richColors closeButton />
    </HashRouter>
  );
}
