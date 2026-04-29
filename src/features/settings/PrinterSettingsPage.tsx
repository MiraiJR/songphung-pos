import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
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
          Chọn máy in hệ thống hoặc nhập IP máy in mạng. Cấu hình được lưu local.
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
            <option value="CUSTOM">Nhập IP máy in mạng</option>
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
            <label className="mb-1 block text-sm text-slate-600">IP máy in mạng (vd: 192.168.1.20:9100)</label>
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
            className={`mt-3 rounded px-3 py-2 text-sm ${
              status.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {status.type === "ok" ? "🟢" : "🔴"} {status.message}
          </div>
        )}
      </div>
    </section>
  );
}
