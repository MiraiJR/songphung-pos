import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";

type Props = {
  printerTarget: string;
  onChangePrinterTarget: (value: string) => void;
};

type TestStatus = { type: "ok" | "error"; message: string } | null;
const RECEIPT_PREVIEW_LINES = [
  "     KARAOKE SONG PHỤNG 2      ",
  "373 LÊ QUÝ ĐÔN, AN NHƠN, BÌNH ĐỊNH",
  "        ĐT: 0974 089 367        ",
  "",
  "        PHIẾU THANH TOÁN        ",
  "        Phòng P1 (P1)           ",
  " Thời gian: 29/04/2026 05:46 PM -",
  "            07:24 PM            ",
  "Nhân viên: Admin  Số HĐ: 00001  ",
  "---------------------------------",
  "Mặt hàng        SL  Đ.GIÁ T.TIỀN",
  "BIA QUY NHON    12  14,000 168,000",
  "Nước suối        2  10,000  20,000",
  "Khăn lạnh        6   3,000  18,000",
  "---------------------------------",
  "TỔNG CỘNG:            206,000",
  "TIỀN GIỜ:             245,000",
  "TIỀN MẶT (đ):         451,000",
  "---------------------------------",
  "HÂN HẠNH ĐƯỢC PHỤC VỤ QUÝ KHÁCH!",
].join("\n");

export function PrinterSettingsPage({ printerTarget, onChangePrinterTarget }: Props) {
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(printerTarget);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<TestStatus>(null);

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

  const currentSource = useMemo(() => {
    return systemPrinters.includes(inputValue) ? "SYSTEM" : "CUSTOM";
  }, [systemPrinters, inputValue]);

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

      <div className="app-card max-w-2xl p-4">
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

      <div className="app-card mx-auto mt-4 max-w-2xl p-4 text-center">
        <h3 className="text-base font-semibold text-slate-800">Xem trước hóa đơn giấy K80x45 (80mm)</h3>
        <p className="mt-1 text-sm text-slate-500">
          Mẫu minh họa để canh bố cục in nhiệt XPrinter (không phải dữ liệu hóa đơn thật).
        </p>
        <div className="mt-3 flex justify-center rounded-lg bg-slate-100 p-4">
          <pre className="mx-auto block w-[80mm] overflow-x-auto bg-white p-3 text-center font-mono text-[11px] leading-4 text-slate-800 shadow">
            {RECEIPT_PREVIEW_LINES}
          </pre>
        </div>
      </div>
    </section>
  );
}
