import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  printerTarget: string;
  onChangePrinterTarget: (value: string) => void;
  printBillQr: boolean;
  onPrintBillQrChange: (value: boolean) => void;
  qrUseFixedAmount: boolean;
  onQrUseFixedAmountChange: (value: boolean) => void;
  qrFixedAmountDisplay: string;
  onQrFixedAmountDisplayChange: (value: string) => void;
  selectedQrThanhToanId: number | null;
  onSelectedQrThanhToanIdChange: (value: number | null) => void;
};

type TestStatus = { type: "ok" | "error"; message: string } | null;
type QrThanhToan = {
  qr_thanh_toan_id: number;
  qr_thanh_toan_ten: string;
  qr_code: string;
};

export function PrinterSettingsPage({
  printerTarget,
  onChangePrinterTarget,
  printBillQr,
  onPrintBillQrChange,
  qrUseFixedAmount,
  onQrUseFixedAmountChange,
  qrFixedAmountDisplay,
  onQrFixedAmountDisplayChange,
  selectedQrThanhToanId,
  onSelectedQrThanhToanIdChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<"printer" | "qr">("printer");
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(printerTarget);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<TestStatus>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [billQrDataUrl, setBillQrDataUrl] = useState<string>("");

  const [qrList, setQrList] = useState<QrThanhToan[]>([]);
  const [qrPreviewMap, setQrPreviewMap] = useState<Record<number, string>>({});
  const [newQrName, setNewQrName] = useState("");
  const [newQrCode, setNewQrCode] = useState("");
  const [editingQrId, setEditingQrId] = useState<number | null>(null);
  const [editingQrName, setEditingQrName] = useState("");
  const [editingQrCode, setEditingQrCode] = useState("");
  const loadingRef = useRef(false);

  const qrSettingsPayload = useMemo(() => {
    const fixedAmountVnd = Number(qrFixedAmountDisplay.replace(/\D/g, "") || "0");
    return {
      print_qr_on_receipt: printBillQr,
      qr_use_fixed_amount: qrUseFixedAmount,
      qr_fixed_amount_vnd: Number.isFinite(fixedAmountVnd) ? Math.max(0, Math.floor(fixedAmountVnd)) : 0,
      selected_qr_thanh_toan_id: selectedQrThanhToanId,
    };
  }, [printBillQr, qrUseFixedAmount, qrFixedAmountDisplay, selectedQrThanhToanId]);

  const loadQrList = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const list = await invoke<QrThanhToan[]>("list_qr_thanh_toan");
      setQrList(list);

      const previews = await Promise.all(
        list.map(async (item) => {
          try {
            const url = await invoke<string>("get_qr_thanh_toan_preview_data_url", {
              qrThanhToanId: item.qr_thanh_toan_id,
            });
            return [item.qr_thanh_toan_id, url] as const;
          } catch {
            return [item.qr_thanh_toan_id, ""] as const;
          }
        }),
      );
      setQrPreviewMap(Object.fromEntries(previews));

      if (!selectedQrThanhToanId && list.length > 0) {
        onSelectedQrThanhToanIdChange(list[0].qr_thanh_toan_id);
      }
      if (
        selectedQrThanhToanId != null &&
        !list.some((item) => item.qr_thanh_toan_id === selectedQrThanhToanId) &&
        list.length > 0
      ) {
        onSelectedQrThanhToanIdChange(list[0].qr_thanh_toan_id);
      }
    } catch (error) {
      toast.error(`Không tải được danh sách QR: ${String(error)}`);
    } finally {
      loadingRef.current = false;
    }
  }, [onSelectedQrThanhToanIdChange, selectedQrThanhToanId]);

  const reloadQrPreview = useCallback(async () => {
    try {
      if (selectedQrThanhToanId != null) {
        const directUrl = await invoke<string>("get_qr_thanh_toan_preview_data_url", {
          qrThanhToanId: selectedQrThanhToanId,
        });
        setBillQrDataUrl(directUrl);
        return;
      }
      const url = await invoke<string | null>("get_bill_qr_preview_data_url", {
        qr_settings: qrSettingsPayload,
      });
      setBillQrDataUrl(url ?? "");
    } catch {
      setBillQrDataUrl("");
    }
  }, [qrSettingsPayload, selectedQrThanhToanId]);

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

  useEffect(() => {
    void loadQrList();
  }, [loadQrList]);

  const currentSource = useMemo(() => {
    return systemPrinters.includes(inputValue) ? "SYSTEM" : "CUSTOM";
  }, [systemPrinters, inputValue]);

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
      const message = await invoke<string>("test_printer", {
        printerNameOrIp: target,
        qr_settings: qrSettingsPayload,
      });
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
        <h2 className="text-2xl font-bold text-slate-800">Cài đặt in</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ưu tiên chọn máy in hệ thống (USB/cục bộ). Chỉ nhập địa chỉ IP khi dùng máy in mạng.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={activeTab === "printer" ? "btn-secondary" : "btn-ghost border border-slate-200"}
          onClick={() => setActiveTab("printer")}
        >
          Máy In
        </button>
        <button
          type="button"
          className={activeTab === "qr" ? "btn-secondary" : "btn-ghost border border-slate-200"}
          onClick={() => setActiveTab("qr")}
        >
          QR Code
        </button>
      </div>

      {activeTab === "printer" && (
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
              {printBillQr && billQrDataUrl ? (
                <div className="w-[80mm] rounded border border-slate-200 bg-white p-3 shadow">
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Mã QR trên hóa đơn (trước dòng cảm ơn)
                  </p>
                  <img
                    src={billQrDataUrl}
                    alt="Mã QR thanh toán"
                    className="mx-auto max-h-48 w-auto max-w-[40%] object-contain"
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">{printBillQr ? "Đang tải ảnh QR..." : "Đã tắt in QR."}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "qr" && (
        <div className="app-card w-full p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Tùy chọn in QR</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={printBillQr}
                  onCheckedChange={(checked) => onPrintBillQrChange(checked === true)}
                />
                In QR trên bill
              </label>
              <label className={`mb-2 flex items-center gap-2 text-sm ${printBillQr ? "" : "text-slate-400"}`}>
                <Checkbox
                  checked={qrUseFixedAmount}
                  disabled={!printBillQr}
                  onCheckedChange={(checked) => onQrUseFixedAmountChange(checked === true)}
                />
                Dùng số tiền cố định trên QR (test)
              </label>
              <div className={`${printBillQr && qrUseFixedAmount ? "" : "opacity-50"}`}>
                <label className="mb-1 block text-xs text-slate-500">Số tiền cố định (VNĐ)</label>
                <input
                  className="app-input w-full text-right"
                  value={qrFixedAmountDisplay}
                  onChange={(e) => onQrFixedAmountDisplayChange(e.target.value)}
                  placeholder="VD: 150000"
                  disabled={!printBillQr || !qrUseFixedAmount}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">Chọn QR mặc định để in bill</label>
              <Select
                value={selectedQrThanhToanId != null ? String(selectedQrThanhToanId) : ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  onSelectedQrThanhToanIdChange(Number.isFinite(id) && id > 0 ? id : null);
                }}
              >
                <option value="">-- Chọn QR --</option>
                {qrList.map((item) => (
                  <option key={item.qr_thanh_toan_id} value={item.qr_thanh_toan_id}>
                    {item.qr_thanh_toan_ten}
                  </option>
                ))}
              </Select>
              {printBillQr && billQrDataUrl && (
                <div className="mt-3 rounded border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Preview QR đang chọn
                  </p>
                  <img src={billQrDataUrl} alt="Preview QR đang chọn" className="mx-auto max-h-40 w-auto object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="w-full rounded border border-slate-200 bg-white p-3 text-left">
            <p className="mb-2 text-sm font-semibold text-slate-700">Quản lý QR thanh toán</p>
            <div className="mb-3 grid grid-cols-1 gap-2">
              <input
                className="app-input"
                placeholder="Tên QR (vd: LE THI MY NUONG)"
                value={newQrName}
                onChange={(e) => setNewQrName(e.target.value)}
              />
              <textarea
                className="app-input min-h-24 font-mono text-xs"
                placeholder="Chuỗi QR tĩnh (000201010211...)"
                value={newQrCode}
                onChange={(e) => setNewQrCode(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={async () => {
                    try {
                      await invoke("create_qr_thanh_toan", {
                        payload: {
                          qr_thanh_toan_ten: newQrName,
                          qr_code: newQrCode,
                        },
                      });
                      setNewQrName("");
                      setNewQrCode("");
                      toast.success("Đã thêm QR mới.");
                      await loadQrList();
                      await reloadQrPreview();
                    } catch (error) {
                      toast.error(String(error));
                    }
                  }}
                >
                  Thêm QR
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {qrList.map((item) => {
                const isEditing = editingQrId === item.qr_thanh_toan_id;
                return (
                  <div key={item.qr_thanh_toan_id} className="rounded border border-slate-200 bg-white p-3">
                    {isEditing ? (
                      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                        <div className="rounded border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Preview QR
                          </p>
                          {qrPreviewMap[item.qr_thanh_toan_id] ? (
                            <img
                              src={qrPreviewMap[item.qr_thanh_toan_id]}
                              alt={`QR ${item.qr_thanh_toan_ten}`}
                              className="mx-auto max-h-44 w-auto object-contain"
                            />
                          ) : (
                            <p className="py-10 text-center text-xs text-slate-400">Đang tải QR...</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <input
                            className="app-input w-full"
                            value={editingQrName}
                            onChange={(e) => setEditingQrName(e.target.value)}
                          />
                          <textarea
                            className="app-input min-h-24 w-full font-mono text-xs"
                            value={editingQrCode}
                            onChange={(e) => setEditingQrCode(e.target.value)}
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              className="btn-ghost text-sm"
                              onClick={() => {
                                setEditingQrId(null);
                                setEditingQrName("");
                                setEditingQrCode("");
                              }}
                            >
                              Hủy
                            </button>
                            <button
                              className="btn-secondary text-sm"
                              onClick={async () => {
                                try {
                                  await invoke("update_qr_thanh_toan", {
                                    payload: {
                                      qr_thanh_toan_id: item.qr_thanh_toan_id,
                                      qr_thanh_toan_ten: editingQrName,
                                      qr_code: editingQrCode,
                                    },
                                  });
                                  toast.success("Đã cập nhật QR.");
                                  setEditingQrId(null);
                                  await loadQrList();
                                  await reloadQrPreview();
                                } catch (error) {
                                  toast.error(String(error));
                                }
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-800">{item.qr_thanh_toan_ten}</div>
                          <div className="flex gap-2">
                          <button
                            className="btn-ghost text-sm"
                            onClick={() => {
                                setEditingQrId(item.qr_thanh_toan_id);
                                setEditingQrName(item.qr_thanh_toan_ten);
                                setEditingQrCode(item.qr_code);
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              className="btn-ghost text-xs text-rose-600"
                              onClick={async () => {
                                if (!window.confirm(`Xóa QR "${item.qr_thanh_toan_ten}"?`)) return;
                                try {
                                  await invoke("delete_qr_thanh_toan", {
                                    qrThanhToanId: item.qr_thanh_toan_id,
                                  });
                                  toast.success("Đã xóa QR.");
                                  await loadQrList();
                                  await reloadQrPreview();
                                } catch (error) {
                                  toast.error(String(error));
                                }
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 rounded border border-slate-100 bg-slate-50 p-3">
                          {qrPreviewMap[item.qr_thanh_toan_id] ? (
                            <img
                              src={qrPreviewMap[item.qr_thanh_toan_id]}
                              alt={`QR ${item.qr_thanh_toan_ten}`}
                              className="mx-auto max-h-44 w-auto object-contain"
                            />
                          ) : (
                            <p className="py-10 text-center text-xs text-slate-400">Đang tải QR...</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
