import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";

type Props = {
  printerTarget: string;
  onChangePrinterTarget: (value: string) => void;
};

type TestStatus = { type: "ok" | "error"; message: string } | null;

export function PrinterSettingsPage({ printerTarget, onChangePrinterTarget }: Props) {
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(printerTarget);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<TestStatus>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [billQrDataUrl, setBillQrDataUrl] = useState<string>("");
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  const reloadQrPreview = useCallback(async () => {
    try {
      const url = await invoke<string>("get_bill_qr_preview_data_url");
      setBillQrDataUrl(url);
    } catch {
      setBillQrDataUrl("");
    }
  }, []);

  useEffect(() => {
    setInputValue(printerTarget);
  }, [printerTarget]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await invoke<string[]>("get_system_printers");
        setSystemPrinters(list);
      } catch (error) {
        setStatus({ type: "error", message: `Không tải được danh sách máy in: ${String(error)}` });
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const text = await invoke<string>("get_sample_receipt_preview");
        setReceiptPreview(text);
      } catch {
        setReceiptPreview("");
      }
    })();
  }, []);

  useEffect(() => {
    void reloadQrPreview();
  }, [reloadQrPreview]);

  const currentSource = useMemo(() => {
    return systemPrinters.includes(inputValue) ? "SYSTEM" : "CUSTOM";
  }, [systemPrinters, inputValue]);

  /** Receipt text includes a backend marker for ESC/POS; hide it here — QR is shown as image below. */
  const receiptPreviewDisplay = useMemo(
    () => receiptPreview.replace(/^\s*@@BILL_QR@@\s*$/m, "      [mã QR — ảnh bên dưới]"),
    [receiptPreview],
  );

  async function testAndSave() {
    const target = inputValue.trim();
    if (!target) {
      setStatus({ type: "error", message: "Vui lòng chọn hoặc nhập máy in." });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      const message = await invoke<string>("test_printer", { printerNameOrIp: target });
      onChangePrinterTarget(target);
      setStatus({ type: "ok", message });
    } catch (error) {
      setStatus({ type: "error", message: `Kiểm tra máy in thất bại: ${String(error)}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Cài đặt máy in</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ưu tiên chọn máy in hệ thống (USB/cục bộ). Chỉ nhập địa chỉ IP khi dùng máy in mạng.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="app-card w-full max-w-2xl shrink-0 p-4 lg:max-w-md xl:max-w-lg">
          <div className="mb-3">
            <label className="mb-1 block text-sm text-slate-600">Nguồn máy in</label>
            <Select
              value={currentSource}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "CUSTOM") {
                  setInputValue("");
                  return;
                }
                if (systemPrinters.length > 0) {
                  setInputValue(systemPrinters[0]);
                }
              }}
            >
              <option value="SYSTEM">Máy in hệ thống</option>
              <option value="CUSTOM">Nhập địa chỉ máy in mạng</option>
            </Select>
          </div>

          {currentSource === "SYSTEM" ? (
            <div className="mb-3">
              <label className="mb-1 block text-sm text-slate-600">Danh sách máy in hệ thống</label>
              <Select value={inputValue} onChange={(e) => setInputValue(e.target.value)}>
                <option value="">Chọn máy in</option>
                {systemPrinters.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="mb-3">
              <label className="mb-1 block text-sm text-slate-600">Địa chỉ máy in mạng (vd: 192.168.1.20:9100)</label>
              <input
                className="app-input w-full"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="127.0.0.1:9100"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => void testAndSave()} disabled={testing}>
              {testing ? "Đang kiểm tra..." : "In thử / Kiểm tra kết nối"}
            </button>
            <span className="text-sm text-slate-500">
              Máy in đang dùng: <b>{printerTarget || "-- chưa chọn --"}</b>
            </span>
          </div>

          {status && (
            <div
              className={`mt-3 rounded px-3 py-2 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
            >
              {status.type === "ok" ? "🟢" : "🔴"} {status.message}
            </div>
          )}
        </div>

        <div className="app-card mx-auto w-full max-w-2xl flex-1 min-w-0 p-4 text-center lg:mx-0 lg:max-w-none">
          <h3 className="text-base font-semibold text-slate-800">Xem trước hóa đơn giấy K80x45 (80mm)</h3>
          <p className="mt-1 text-sm text-slate-500">
            Cùng nội dung với lệnh &quot;In thử&quot; — mẫu minh họa K80 (không phải hóa đơn thật).
          </p>
          <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-100 p-4">
            <pre className="mx-auto block w-[80mm] overflow-x-auto bg-white p-3 text-center font-mono text-[11px] font-bold leading-4 text-slate-800 shadow">
              {receiptPreviewDisplay || "Đang tải mẫu..."}
            </pre>
            {billQrDataUrl ? (
              <div className="w-[80mm] rounded border border-slate-200 bg-white p-3 shadow">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Mã QR trên hóa đơn (trước dòng cảm ơn)
                </p>
                <img
                  src={billQrDataUrl}
                  alt="Mã QR thanh toán"
                  className="mx-auto max-h-48 w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Đang tải ảnh QR...</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const buf = await file.arrayBuffer();
                    await invoke("save_bill_qr_png", { bytes: Array.from(new Uint8Array(buf)) });
                    toast.success("Đã cập nhật ảnh QR trên hóa đơn.");
                    await reloadQrPreview();
                  } catch (error) {
                    toast.error(`Không lưu được ảnh: ${String(error)}`);
                  }
                }}
              />
              <button type="button" className="btn-secondary text-sm" onClick={() => qrFileInputRef.current?.click()}>
                Tải ảnh QR mới
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={async () => {
                  try {
                    await invoke("reset_bill_qr_png");
                    toast.success("Đã khôi phục ảnh QR mặc định của ứng dụng.");
                    await reloadQrPreview();
                  } catch (error) {
                    toast.error(`Không khôi phục được: ${String(error)}`);
                  }
                }}
              >
                Khôi phục QR gốc
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
