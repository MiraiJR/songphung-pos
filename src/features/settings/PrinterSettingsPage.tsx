import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Dialog, DialogHeader } from "@/components/AppDialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Stack";
import { useToast } from "@astryxdesign/core/Toast";

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
  onDataChanged?: () => Promise<void>;
};

type TestStatus = { type: "ok" | "error"; message: string } | null;
type CleanupMode = "paid_range" | "paid_all" | "active" | "all";

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const CLEANUP_OPTIONS: Array<{ value: CleanupMode; label: string; detail: string }> = [
  {
    value: "paid_range",
    label: "Hóa đơn đã thanh toán theo khoảng ngày",
    detail: "Xóa các hóa đơn đã thanh toán có ngày kết thúc nằm trong khoảng đã chọn.",
  },
  {
    value: "paid_all",
    label: "Toàn bộ hóa đơn đã thanh toán",
    detail: "Xóa hết lịch sử hóa đơn đã thanh toán. Phiên đang hát được giữ lại.",
  },
  {
    value: "active",
    label: "Phiên đang hát",
    detail: "Xóa phiên chưa thanh toán và đưa những phòng đó về trạng thái trống.",
  },
  {
    value: "all",
    label: "Toàn bộ dữ liệu phòng hát",
    detail: "Xóa hóa đơn đã thanh toán và phiên đang hát, rồi đưa mọi phòng về trống. Danh sách phòng, sản phẩm và QR không bị xóa.",
  },
];

type QrThanhToan = {
  qr_thanh_toan_id: number;
  qr_thanh_toan_ten: string;
  qr_code: string;
};

type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

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
  onDataChanged,
}: Props) {
  const showToast = useToast();
  const [settingsSection, setSettingsSection] = useState<"printer" | "qr" | "cleanup">("printer");
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>("paid_range");
  const [cleanupStart, setCleanupStart] = useState(todayLocalYmd);
  const [cleanupEnd, setCleanupEnd] = useState(todayLocalYmd);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
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
  const [deleteQrTarget, setDeleteQrTarget] = useState<QrThanhToan | null>(null);
  const loadingRef = useRef(false);

  const qrSettingsPayload = useMemo(() => {
    const fixedAmountVnd = Number(qrFixedAmountDisplay.replace(/\D/g, "") || "0");
    return {
      printQrOnReceipt: printBillQr,
      qrUseFixedAmount: qrUseFixedAmount,
      qrFixedAmountVnd: Number.isFinite(fixedAmountVnd) ? Math.max(0, Math.floor(fixedAmountVnd)) : 0,
      selectedQrThanhToanId: selectedQrThanhToanId,
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
      showToast({ body: `Không tải được danh sách QR: ${String(error)}`, type: "error" });
    } finally {
      loadingRef.current = false;
    }
  }, [onSelectedQrThanhToanIdChange, selectedQrThanhToanId, showToast]);

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
        qrSettings: qrSettingsPayload,
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

  const receiptPreviewDisplay = useMemo(() => {
    if (!printBillQr) {
      return receiptPreview
        .split("\n")
        .filter((line) => line.trim() !== "@@BILL_QR@@")
        .join("\n");
    }
    return receiptPreview.replace(/^\s*@@BILL_QR@@\s*$/m, "      [mã QR — ảnh bên dưới]");
  }, [receiptPreview, printBillQr]);

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
        qrSettings: qrSettingsPayload,
      });
      onChangePrinterTarget(target);
      setStatus({ type: "ok", message });
    } catch (error) {
      setStatus({ type: "error", message: `Kiểm tra máy in thất bại: ${String(error)}` });
    } finally {
      setTesting(false);
    }
  }

  const printerSourceOptions = [
    { value: "SYSTEM", label: "Máy in hệ thống" },
    { value: "CUSTOM", label: "Nhập địa chỉ máy in mạng" },
  ];

  const systemPrinterOptions = [
    { value: "", label: "Chọn máy in" },
    ...systemPrinters.map((name) => ({ value: name, label: name })),
  ];

  const qrSelectOptions = [
    { value: "", label: "-- Chọn QR --" },
    ...qrList.map((item) => ({
      value: String(item.qr_thanh_toan_id),
      label: item.qr_thanh_toan_ten,
    })),
  ];

  const cleanupChoice = CLEANUP_OPTIONS.find((item) => item.value === cleanupMode) ?? CLEANUP_OPTIONS[0];

  const runCleanup = async () => {
    setCleaning(true);
    try {
      const message = await invoke<string>("cleanup_room_data", {
        mode: cleanupMode,
        startDate: cleanupMode === "paid_range" ? cleanupStart : null,
        endDate: cleanupMode === "paid_range" ? cleanupEnd : null,
      });
      showToast({ body: message });
      setCleanupOpen(false);
      await onDataChanged?.();
    } catch (error) {
      showToast({ body: String(error), type: "error" });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <VStack gap={4} padding={4}>
      <VStack gap={0.5}>
        <Heading level={2}>Cài đặt in</Heading>
        <Text type="supporting">
          Ưu tiên chọn máy in hệ thống (USB/cục bộ). Chỉ nhập địa chỉ IP khi dùng máy in mạng.
        </Text>
      </VStack>

      <HStack gap={4} align="start">
        <VStack gap={2} width={220}>
          <Button
            label="Máy in"
            variant={settingsSection === "printer" ? "primary" : "secondary"}
            size="lg"
            width="100%"
            onClick={() => setSettingsSection("printer")}
          />
          <Button
            label="QR Code"
            variant={settingsSection === "qr" ? "primary" : "secondary"}
            size="lg"
            width="100%"
            onClick={() => setSettingsSection("qr")}
          />
          <Button
            label="Dọn dẹp"
            variant={settingsSection === "cleanup" ? "primary" : "secondary"}
            size="lg"
            width="100%"
            onClick={() => setSettingsSection("cleanup")}
          />
        </VStack>
        {settingsSection === "printer" ? (
        <VStack gap={4} width={440}>
          <Card elevation="low" padding={4}>
            <VStack gap={3}>
              <Text weight="semibold">Máy in</Text>
              <Selector
                label="Nguồn máy in"
                value={currentSource}
                onChange={(v) => {
                  if (v === "CUSTOM") {
                    setInputValue("");
                    return;
                  }
                  if (systemPrinters.length > 0) {
                    setInputValue(systemPrinters[0]);
                  }
                }}
                options={printerSourceOptions}
              />

              {currentSource === "SYSTEM" ? (
                <Selector
                  label="Danh sách máy in hệ thống"
                  value={inputValue}
                  onChange={(v) => setInputValue(v)}
                  options={systemPrinterOptions}
                />
              ) : (
                <TextInput
                  label="Địa chỉ máy in mạng (vd: 192.168.1.20:9100)"
                  value={inputValue}
                  onChange={(v) => setInputValue(v)}
                  placeholder="127.0.0.1:9100"
                />
              )}

              <Button
                label={testing ? "Đang kiểm tra..." : "In thử / Kiểm tra kết nối"}
                variant="secondary"
                isLoading={testing}
                onClick={() => void testAndSave()}
              />
              <Text type="supporting">
                Máy in đang dùng: <Text weight="bold">{printerTarget || "-- chưa chọn --"}</Text>
              </Text>

              {status && (
                <Card variant={status.type === "ok" ? "green" : "red"} padding={2}>
                  <Text type="body">
                    {status.type === "ok" ? "🟢" : "🔴"} {status.message}
                  </Text>
                </Card>
              )}
            </VStack>
          </Card>
        </VStack>
        ) : settingsSection === "qr" ? (
        <StackItem size="fill">
        <VStack gap={4}>
          <Card elevation="low" padding={4}>
            <VStack gap={3}>
              <Text weight="semibold">Mã QR</Text>
              <CheckboxInput
                label="Bật mã QR trên hóa đơn"
                value={printBillQr}
                onChange={(checked) => onPrintBillQrChange(checked)}
              />
              <Text type="supporting">
                Khi tắt, mọi phiếu in (thanh toán, tạm tính, in lại) sẽ không kèm mã QR.
              </Text>
              <CheckboxInput
                label="Dùng số tiền cố định trên QR (test)"
                value={qrUseFixedAmount}
                isDisabled={!printBillQr}
                onChange={(checked) => onQrUseFixedAmountChange(checked)}
              />
              <TextInput
                label="Số tiền cố định (VNĐ)"
                value={qrFixedAmountDisplay}
                onChange={(v) => onQrFixedAmountDisplayChange(v)}
                placeholder="VD: 150000"
                isDisabled={!printBillQr || !qrUseFixedAmount}
              />
              <Selector
                label="Chọn QR mặc định để in bill"
                value={selectedQrThanhToanId != null ? String(selectedQrThanhToanId) : ""}
                isDisabled={!printBillQr}
                onChange={(v) => {
                  const id = Number(v);
                  onSelectedQrThanhToanIdChange(Number.isFinite(id) && id > 0 ? id : null);
                }}
                options={qrSelectOptions}
              />
              {!printBillQr && (
                <Card variant="yellow" padding={2}>
                  <Text type="supporting">
                    Đã tắt sử dụng mã QR. Bật lại để in QR trên hóa đơn.
                  </Text>
                </Card>
              )}
            </VStack>
          </Card>

          <Card elevation="low" padding={4}>
            <VStack gap={3}>
              <VStack gap={3}>
                <Text weight="semibold">Quản lý QR thanh toán</Text>
                <VStack gap={2}>
                  <TextInput
                    label="Tên QR"
                    value={newQrName}
                    onChange={(v) => setNewQrName(v)}
                    placeholder="Tên QR (vd: LE THI MY NUONG)"
                  />
                  <TextArea
                    label="Chuỗi QR tĩnh"
                    value={newQrCode}
                    onChange={(v) => setNewQrCode(v)}
                    placeholder="Chuỗi QR tĩnh (000201010211...)"
                    rows={4}
                  />
                  <HStack justify="end">
                    <Button
                      label="Thêm QR"
                      variant="secondary"
                      size="sm"
                      clickAction={async () => {
                        try {
                          await invoke("create_qr_thanh_toan", {
                            payload: {
                              qr_thanh_toan_ten: newQrName,
                              qr_code: newQrCode,
                            },
                          });
                          setNewQrName("");
                          setNewQrCode("");
                          showToast({ body: "Đã thêm QR mới." });
                          await loadQrList();
                          await reloadQrPreview();
                        } catch (error) {
                          showToast({ body: String(error), type: "error" });
                        }
                      }}
                    />
                  </HStack>
                </VStack>

                <VStack gap={2}>
                  {qrList.map((item) => {
                    const isEditing = editingQrId === item.qr_thanh_toan_id;
                    return (
                      <Card key={item.qr_thanh_toan_id} padding={3} elevation="none">
                        {isEditing ? (
                          <VStack gap={3}>
                            <Card variant="muted" padding={3}>
                              <VStack gap={2} hAlign="center">
                                <Text type="supporting" weight="semibold" size="2xs">Preview QR</Text>
                                {qrPreviewMap[item.qr_thanh_toan_id] ? (
                                  <img
                                    src={qrPreviewMap[item.qr_thanh_toan_id]}
                                    alt={`QR ${item.qr_thanh_toan_ten}`}
                                    className="mx-auto max-h-44 w-auto object-contain"
                                  />
                                ) : (
                                  <Text type="supporting">Đang tải QR...</Text>
                                )}
                              </VStack>
                            </Card>
                            <TextInput
                              label="Tên QR"
                              value={editingQrName}
                              onChange={(v) => setEditingQrName(v)}
                            />
                            <TextArea
                              label="Chuỗi QR"
                              value={editingQrCode}
                              onChange={(v) => setEditingQrCode(v)}
                              rows={4}
                            />
                            <HStack gap={2} justify="end">
                                  <Button
                                    label="Hủy"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingQrId(null);
                                      setEditingQrName("");
                                      setEditingQrCode("");
                                    }}
                                  />
                                  <Button
                                    label="Lưu"
                                    variant="secondary"
                                    size="sm"
                                    clickAction={async () => {
                                      try {
                                        await invoke("update_qr_thanh_toan", {
                                          payload: {
                                            qr_thanh_toan_id: item.qr_thanh_toan_id,
                                            qr_thanh_toan_ten: editingQrName,
                                            qr_code: editingQrCode,
                                          },
                                        });
                                        showToast({ body: "Đã cập nhật QR." });
                                        setEditingQrId(null);
                                        await loadQrList();
                                        await reloadQrPreview();
                                      } catch (error) {
                                        showToast({ body: String(error), type: "error" });
                                      }
                                    }}
                                  />
                            </HStack>
                          </VStack>
                        ) : (
                          <VStack gap={2}>
                            <HStack justify="between" align="center">
                              <Text weight="semibold">{item.qr_thanh_toan_ten}</Text>
                              <HStack gap={2}>
                                <Button
                                  label="Sửa"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingQrId(item.qr_thanh_toan_id);
                                    setEditingQrName(item.qr_thanh_toan_ten);
                                    setEditingQrCode(item.qr_code);
                                  }}
                                />
                                <Button
                                  label="Xóa"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeleteQrTarget(item)}
                                />
                              </HStack>
                            </HStack>
                            <Card variant="muted" padding={3}>
                              {qrPreviewMap[item.qr_thanh_toan_id] ? (
                                <img
                                  src={qrPreviewMap[item.qr_thanh_toan_id]}
                                  alt={`QR ${item.qr_thanh_toan_ten}`}
                                  className="mx-auto max-h-44 w-auto object-contain"
                                />
                              ) : (
                                <Text type="supporting" justify="center" display="block">
                                  Đang tải QR...
                                </Text>
                              )}
                            </Card>
                          </VStack>
                        )}
                      </Card>
                    );
                  })}
                </VStack>
              </VStack>
            </VStack>
            </Card>
        </VStack>
        </StackItem>
        ) : (
        <StackItem size="fill">
          <Card elevation="low" padding={4}>
            <VStack gap={4}>
              <VStack gap={1}>
                <Text weight="semibold">Dọn dẹp dữ liệu phòng hát</Text>
                <Text color="secondary">
                  Chỉ xóa phiên hát và hóa đơn. Danh sách phòng, sản phẩm và mã QR được giữ nguyên.
                </Text>
              </VStack>
              <Selector
                label="Dữ liệu cần xóa"
                value={cleanupMode}
                onChange={(value) => setCleanupMode(value as CleanupMode)}
                options={CLEANUP_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              />
              <Text color="secondary">{cleanupChoice.detail}</Text>
              {cleanupMode === "paid_range" ? (
                <HStack gap={2} vAlign="end" wrap="wrap">
                  <DateInput
                    label="Từ ngày"
                    value={cleanupStart as ISODate}
                    onChange={(value) => {
                      if (value) setCleanupStart(value);
                    }}
                    format={(iso) => {
                      const [year, month, day] = iso.split("-");
                      return `${day}/${month}/${year}`;
                    }}
                    width={190}
                  />
                  <DateInput
                    label="Đến ngày"
                    value={cleanupEnd as ISODate}
                    onChange={(value) => {
                      if (value) setCleanupEnd(value);
                    }}
                    format={(iso) => {
                      const [year, month, day] = iso.split("-");
                      return `${day}/${month}/${year}`;
                    }}
                    width={190}
                  />
                </HStack>
              ) : null}
              <HStack>
                <Button
                  label="Xóa dữ liệu"
                  variant="destructive"
                  onClick={() => setCleanupOpen(true)}
                />
              </HStack>
            </VStack>
          </Card>
        </StackItem>
        )}

        {settingsSection === "printer" && (
        <StackItem size="fill">
          <Card elevation="low" padding={4}>
            <VStack gap={3} hAlign="center">
              <Heading level={3}>Xem trước hóa đơn giấy K80x45 (80mm)</Heading>
              <Text type="supporting">
                Cùng nội dung với lệnh &quot;In thử&quot; — mẫu minh họa K80 (không phải hóa đơn thật).
              </Text>
              <Card variant="muted" padding={3}>
                <VStack gap={3} hAlign="center">
                  <pre className="mx-auto block w-[80mm] overflow-x-auto rounded bg-white p-3 text-center font-mono text-[11px] font-bold leading-4 shadow">
                    {receiptPreviewDisplay || "Đang tải mẫu..."}
                  </pre>
                  {printBillQr && billQrDataUrl ? (
                    <Card padding={3}>
                      <VStack gap={2} hAlign="center">
                        <Text type="supporting" weight="semibold" size="2xs">
                          Mã QR trên hóa đơn (trước dòng cảm ơn)
                        </Text>
                        <img
                          src={billQrDataUrl}
                          alt="Mã QR thanh toán"
                          className="mx-auto max-h-48 w-auto max-w-[40%] object-contain"
                        />
                      </VStack>
                    </Card>
                  ) : (
                    <Text type="supporting">
                      {printBillQr ? "Đang tải ảnh QR..." : "Đã tắt in QR."}
                    </Text>
                  )}
                </VStack>
              </Card>
            </VStack>
          </Card>
        </StackItem>
        )}
      </HStack>

      {/* Delete QR Confirmation Dialog */}
      <Dialog
        isOpen={deleteQrTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteQrTarget(null); }}
        width={420}
        purpose="required"
      >
        <DialogHeader title="Xác nhận xóa QR" onOpenChange={() => setDeleteQrTarget(null)} />
        <VStack gap={3} padding={4}>
          <Text type="body">
            Bạn có chắc muốn xóa QR{" "}
            <Text weight="semibold">&quot;{deleteQrTarget?.qr_thanh_toan_ten}&quot;</Text>?
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Hủy" variant="ghost" onClick={() => setDeleteQrTarget(null)} />
            <Button
              label="Xóa"
              variant="destructive"
              clickAction={async () => {
                if (!deleteQrTarget) return;
                try {
                  await invoke("delete_qr_thanh_toan", {
                    qrThanhToanId: deleteQrTarget.qr_thanh_toan_id,
                  });
                  showToast({ body: "Đã xóa QR." });
                  setDeleteQrTarget(null);
                  await loadQrList();
                  await reloadQrPreview();
                } catch (error) {
                  showToast({ body: String(error), type: "error" });
                }
              }}
            />
          </HStack>
        </VStack>
      </Dialog>

      <Dialog isOpen={cleanupOpen} onOpenChange={setCleanupOpen} width={460} purpose="required">
        <DialogHeader title="Xác nhận dọn dẹp" onOpenChange={setCleanupOpen} />
        <VStack gap={3} padding={4}>
          <Text>{cleanupChoice.detail}</Text>
          {cleanupMode === "paid_range" ? (
            <Text weight="semibold">
              Từ {cleanupStart.split("-").reverse().join("/")} đến {cleanupEnd.split("-").reverse().join("/")}
            </Text>
          ) : null}
          <Text color="secondary">Thao tác này không hoàn tác được.</Text>
          <HStack gap={2} justify="end">
            <Button label="Hủy" variant="ghost" isDisabled={cleaning} onClick={() => setCleanupOpen(false)} />
            <Button
              label="Xóa"
              variant="destructive"
              isLoading={cleaning}
              onClick={() => void runCleanup()}
            />
          </HStack>
        </VStack>
      </Dialog>
    </VStack>
  );
}
