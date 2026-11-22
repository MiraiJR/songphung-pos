import { invoke } from "@tauri-apps/api/core";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/AppDialog";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import {
  Table,
  TableSelectionToolbar,
  useTableSelection,
  useTableSelectionState,
  proportional,
  pixel,
} from "@astryxdesign/core/Table";
import type { TableColumn, TablePlugin } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useToast } from "@astryxdesign/core/Toast";

import { BillTemplatePreview } from "@/components/billing/BillTemplatePreview";
import { ConfirmBillActionModal } from "@/components/billing/ConfirmBillActionModal";
import type { HistoryOrderItem, PaidHistory, Product } from "@/types/karaoke";
import { formatDateTime } from "@/utils/formatDateTime";
import { roundUpMoney } from "@/utils/roundMoney";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

interface HistoryRow extends Record<string, unknown> {
  id: string;
  lich_su_phong_id: number;
  phong_id: number;
  ten_phong: string;
  gio_bat_dau: string;
  gio_ket_thuc: string | null;
  tong_tien_san_pham: number;
  tong_tien_gio: number;
  phu_thu: number;
  tong_tien_thanh_toan: number;
}

type Props = {
  histories: PaidHistory[];
  historyItems: HistoryOrderItem[];
  products: Product[];
  historyStart: string;
  historyEnd: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onFilter: () => void | Promise<void>;
  onOpenDetail: (historyId: number) => Promise<void>;
  onReprintBill: (historyId: number, selectedQrThanhToanId: number | null) => Promise<string>;
  qrThanhToanOptions: Array<{ qr_thanh_toan_id: number; qr_thanh_toan_ten: string }>;
  defaultSelectedQrThanhToanId: number | null;
  printBillQr: boolean;
  onDeleteByIds: (ids: number[]) => Promise<number>;
  onUpdateBill: (
    historyId: number,
    tongTienGio: number,
    phuThu: number,
    tongTienThanhToan: number,
    items: Array<{ san_pham_id: string; so_luong: number }>,
  ) => Promise<string>;
  onReloadHistory: () => Promise<void>;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function parseBillDateTime(value: string | null): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeOnly(raw: string | null | undefined): string {
  if (!raw) return "--";
  const timePart = raw.trim().split(/[\sT]/)[1];
  if (!timePart) return "--";
  const [hStr, min] = timePart.split(":");
  const hour = parseInt(hStr, 10);
  if (isNaN(hour)) return "--";
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(h12).padStart(2, "0")}:${min} ${ampm}`;
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HistoryPage({
  histories,
  historyItems,
  products,
  historyStart,
  historyEnd,
  onStartChange,
  onEndChange,
  onFilter,
  onOpenDetail,
  onReprintBill,
  qrThanhToanOptions,
  defaultSelectedQrThanhToanId,
  printBillQr,
  onDeleteByIds,
  onUpdateBill,
  onReloadHistory,
}: Props) {
  const showToast = useToast();

  /* ---- State: detail / view ---- */
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<PaidHistory | null>(null);

  /* ---- State: reprint ---- */
  const [reprintStatus, setReprintStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [reprintingHistoryId, setReprintingHistoryId] = useState<number | null>(null);
  const [reprintConfirmOpen, setReprintConfirmOpen] = useState(false);
  const [reprintTarget, setReprintTarget] = useState<PaidHistory | null>(null);
  const [reprintSelectedQrId, setReprintSelectedQrId] = useState<number | null>(null);
  const [reprintQrPreviewUrl, setReprintQrPreviewUrl] = useState("");

  /* ---- State: selection & delete ---- */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteIdsDialogOpen, setDeleteIdsDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ---- State: edit ---- */
  const [editOpen, setEditOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<PaidHistory | null>(null);
  const [editTienGio, setEditTienGio] = useState("0");
  const [editPhuThu, setEditPhuThu] = useState("0");
  const [editTongTien, setEditTongTien] = useState("0");
  const [editQtyByProductId, setEditQtyByProductId] = useState<Record<string, string>>({});
  const [editLines, setEditLines] = useState<Array<{ san_pham_id: string; ten_san_pham: string; don_gia: number }>>([]);
  const [editProductKeyword, setEditProductKeyword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editInitializedForHistoryId, setEditInitializedForHistoryId] = useState<number | null>(null);
  const [removedProductIds, setRemovedProductIds] = useState<string[]>([]);
  const [editPrintAfterSave, setEditPrintAfterSave] = useState(false);

  /* ---- State: toolbar ---- */
  const [filtering, setFiltering] = useState(false);
  const [openingActionId, setOpeningActionId] = useState<number | null>(null);
  const [roomSearch, setRoomSearch] = useState("");

  useEffect(() => {
    void handleFilter();
    // Tải lại mỗi lần mở trang Lịch sử.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Derived: filtered data for table ---- */
  const filteredHistories = useMemo(() => {
    if (!roomSearch.trim()) return histories;
    const kw = roomSearch.trim().toLowerCase();
    return histories.filter((h) => h.ten_phong.toLowerCase().includes(kw));
  }, [histories, roomSearch]);

  const tableData: HistoryRow[] = useMemo(
    () =>
      filteredHistories.map((h) => ({
        id: String(h.lich_su_phong_id),
        lich_su_phong_id: h.lich_su_phong_id,
        phong_id: h.phong_id,
        ten_phong: h.ten_phong,
        gio_bat_dau: h.gio_bat_dau,
        gio_ket_thuc: h.gio_ket_thuc,
        tong_tien_san_pham: h.tong_tien_san_pham,
        tong_tien_gio: h.tong_tien_gio,
        phu_thu: h.phu_thu ?? 0,
        tong_tien_thanh_toan: h.tong_tien_thanh_toan,
      })),
    [filteredHistories],
  );

  /* ---- Table selection ---- */
  const { selectionConfig, selectionState } = useTableSelectionState<HistoryRow>({
    data: tableData,
    idKey: "id",
    selectedKeys,
    setSelectedKeys,
  });
  const selectionPlugin = useTableSelection<HistoryRow>(selectionConfig);

  /* ---- Computed ---- */
  const totalRevenue = filteredHistories.reduce((sum, h) => sum + h.tong_tien_thanh_toan, 0);
  const totalHourFee = filteredHistories.reduce((sum, h) => sum + h.tong_tien_gio, 0);

  const editTongTienMon = editLines.reduce((sum, item) => {
    const qty = Number(editQtyByProductId[item.san_pham_id] ?? 0);
    return sum + item.don_gia * (Number.isFinite(qty) && qty >= 0 ? qty : 0);
  }, 0);

  const addableProducts = products.filter((product) => {
    if (editLines.some((line) => line.san_pham_id === product.san_pham_id)) return false;
    if (!editProductKeyword.trim()) return true;
    return product.ten_san_pham.toLowerCase().includes(editProductKeyword.trim().toLowerCase());
  });

  /* ---- Effects ---- */

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [histories]);

  useEffect(() => {
    if (!reprintConfirmOpen || !printBillQr || reprintSelectedQrId == null) {
      setReprintQrPreviewUrl("");
      return;
    }
    void (async () => {
      try {
        const url = await invoke<string>("get_qr_thanh_toan_preview_data_url", {
          qrThanhToanId: reprintSelectedQrId,
        });
        setReprintQrPreviewUrl(url);
      } catch {
        setReprintQrPreviewUrl("");
      }
    })();
  }, [reprintConfirmOpen, printBillQr, reprintSelectedQrId]);

  useEffect(() => {
    if (!editOpen || !editingHistory) return;
    if (editInitializedForHistoryId === editingHistory.lich_su_phong_id) return;
    setEditLines(
      historyItems.map((row) => ({
        san_pham_id: row.san_pham_id,
        ten_san_pham: row.ten_san_pham,
        don_gia: row.don_gia,
      })),
    );
    setEditQtyByProductId(
      Object.fromEntries(historyItems.map((row) => [row.san_pham_id, String(row.so_luong)])),
    );
    setRemovedProductIds([]);
    setEditInitializedForHistoryId(editingHistory.lich_su_phong_id);
  }, [editOpen, editingHistory, editInitializedForHistoryId, historyItems]);

  /* ---- Handlers ---- */

  async function handleFilter() {
    setFiltering(true);
    try {
      await Promise.resolve(onFilter());
    } finally {
      setFiltering(false);
    }
  }

  async function handleViewDetail(item: PaidHistory) {
    setOpeningActionId(item.lich_su_phong_id);
    try {
      await onOpenDetail(item.lich_su_phong_id);
      setSelectedHistory(item);
      setDetailOpen(true);
    } finally {
      setOpeningActionId(null);
    }
  }

  const viewDetailRef = useRef(handleViewDetail);
  viewDetailRef.current = handleViewDetail;

  const rowOpenPlugin = useMemo<TablePlugin<HistoryRow>>(
    () => ({
      rowModel: "flat",
      transformBodyRow: (props, item) => ({
        ...props,
        htmlProps: {
          ...props.htmlProps,
          style: {...props.htmlProps.style, cursor: "pointer"},
          onClick: (event) => {
            props.htmlProps.onClick?.(event);
            if (event.defaultPrevented) return;
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest("button, a, input, label, [role='checkbox'], [role='menuitem']")
            ) {
              return;
            }
            const history = histories.find((h) => h.lich_su_phong_id === item.lich_su_phong_id);
            if (history) void viewDetailRef.current(history);
          },
        },
      }),
    }),
    [histories],
  );

  async function handleOpenEdit(item: PaidHistory) {
    setOpeningActionId(item.lich_su_phong_id);
    try {
      await onOpenDetail(item.lich_su_phong_id);
      setEditingHistory(item);
      setEditTienGio(formatMoneyInput(String(Math.round(item.tong_tien_gio))));
      setEditPhuThu(formatMoneyInput(String(Math.round(item.phu_thu ?? 0))));
      setEditTongTien(formatMoneyInput(String(Math.round(item.tong_tien_thanh_toan))));
      setEditQtyByProductId({});
      setEditLines([]);
      setEditProductKeyword("");
      setEditInitializedForHistoryId(null);
      setEditPrintAfterSave(false);
      setEditOpen(true);
    } finally {
      setOpeningActionId(null);
    }
  }

  async function requestReprint(item: PaidHistory) {
    setOpeningActionId(item.lich_su_phong_id);
    try {
      await onOpenDetail(item.lich_su_phong_id);
    } catch {
      /* keep flow */
    } finally {
      setOpeningActionId(null);
    }
    setReprintTarget(item);
    setReprintSelectedQrId(defaultSelectedQrThanhToanId);
    setReprintConfirmOpen(true);
  }

  async function handleConfirmReprint() {
    if (!reprintTarget) return;
    setReprintingHistoryId(reprintTarget.lich_su_phong_id);
    setReprintStatus(null);
    try {
      const message = await onReprintBill(reprintTarget.lich_su_phong_id, reprintSelectedQrId);
      setReprintStatus({ type: "ok", message });
      setReprintConfirmOpen(false);
      setReprintTarget(null);
    } catch (error) {
      setReprintStatus({ type: "error", message: `In lại hóa đơn thất bại: ${String(error)}` });
    } finally {
      setReprintingHistoryId(null);
    }
  }

  function recalcEditTotal(
    nextLines: Array<{ san_pham_id: string; ten_san_pham: string; don_gia: number }>,
    nextQty: Record<string, string>,
    nextHourRaw: string,
    nextSurchargeRaw: string,
  ) {
    const productsTotal = nextLines.reduce((sum, item) => {
      const qty = Number(nextQty[item.san_pham_id] ?? 0);
      return sum + item.don_gia * (Number.isFinite(qty) && qty >= 0 ? qty : 0);
    }, 0);
    const hour = parseMoneyInput(nextHourRaw);
    const hourSafe = Number.isFinite(hour) && hour >= 0 ? hour : 0;
    const surcharge = parseMoneyInput(nextSurchargeRaw);
    const surchargeSafe = Number.isFinite(surcharge) && surcharge >= 0 ? surcharge : 0;
    setEditTongTien(formatMoneyInput(String(Math.round(productsTotal + hourSafe + surchargeSafe))));
  }

  async function handleSaveEdit() {
    if (!editingHistory) return;
    const tongTienGio = parseMoneyInput(editTienGio);
    if (!Number.isFinite(tongTienGio) || tongTienGio < 0) {
      showToast({ body: "Tiền giờ không hợp lệ.", type: "error" });
      return;
    }
    const phuThu = parseMoneyInput(editPhuThu || "0");
    if (!Number.isFinite(phuThu) || phuThu < 0) {
      showToast({ body: "Phụ thu không hợp lệ.", type: "error" });
      return;
    }
    const tongTienThanhToan = parseMoneyInput(editTongTien);
    if (!Number.isFinite(tongTienThanhToan) || tongTienThanhToan < 0) {
      showToast({ body: "Tổng tiền không hợp lệ.", type: "error" });
      return;
    }

    const payloadItems: Array<{ san_pham_id: string; so_luong: number }> = [];
    const donGiaBySanPhamId: Record<string, number> = {};
    for (const row of editLines) {
      const raw = editQtyByProductId[row.san_pham_id] ?? "0";
      const qty = Number(raw);
      if (!Number.isInteger(qty) || qty < 0) {
        showToast({ body: `Số lượng không hợp lệ cho món ${row.ten_san_pham}.`, type: "error" });
        return;
      }
      donGiaBySanPhamId[row.san_pham_id] = row.don_gia;
      payloadItems.push({ san_pham_id: row.san_pham_id, so_luong: qty });
    }
    for (const productId of removedProductIds) {
      if (payloadItems.some((item) => item.san_pham_id === productId)) continue;
      payloadItems.push({ san_pham_id: productId, so_luong: 0 });
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
        phuThu,
        tongTienThanhToan,
        payloadItems,
      );
      showToast({ body: message });
      await onReloadHistory();
      await onOpenDetail(editingHistory.lich_su_phong_id);
      if (editPrintAfterSave) {
        try {
          const printMessage = await onReprintBill(
            editingHistory.lich_su_phong_id,
            defaultSelectedQrThanhToanId,
          );
          showToast({ body: printMessage });
        } catch (error) {
          showToast({ body: `Đã lưu nhưng in hóa đơn thất bại: ${String(error)}`, type: "error" });
        }
      }
      setSelectedHistory((prev) =>
        prev && prev.lich_su_phong_id === editingHistory.lich_su_phong_id
          ? {
              ...prev,
              tong_tien_gio: tongTienGio,
              phu_thu: phuThu,
              tong_tien_san_pham: tongTienSanPhamMoi,
              tong_tien_thanh_toan: tongTienThanhToan,
            }
          : prev,
      );
      setEditOpen(false);
    } catch (error) {
      showToast({ body: `Cập nhật hóa đơn thất bại: ${String(error)}`, type: "error" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDeleteByIds() {
    setDeleting(true);
    try {
      const ids = Array.from(selectionState.selectedKeys).map(Number);
      const count = await onDeleteByIds(ids);
      showToast({ body: `Đã xóa ${count} hóa đơn thành công.` });
      selectionState.clearSelection();
      await onReloadHistory();
    } catch (error) {
      showToast({ body: `Xóa thất bại: ${String(error)}`, type: "error" });
    } finally {
      setDeleting(false);
      setDeleteIdsDialogOpen(false);
    }
  }

  /* ---- Table columns ---- */

  const columns: TableColumn<HistoryRow>[] = [
    {
      key: "ten_phong",
      header: "Phòng",
      width: proportional(1.4),
      renderCell: (row) => (
        <VStack gap={0}>
          <Text weight="semibold">{row.ten_phong}</Text>
          <Text type="supporting" color="secondary">
            #{String(row.lich_su_phong_id).padStart(5, "0")}
          </Text>
        </VStack>
      ),
    },
    {
      key: "thoi_gian",
      header: "Thời gian",
      width: proportional(1.6),
      renderCell: (row) => (
        <VStack gap={0}>
          <Text>
            {formatTimeOnly(row.gio_bat_dau)} → {formatTimeOnly(row.gio_ket_thuc)}
          </Text>
          <Text type="supporting" color="secondary">
            {formatBillDuration(row.gio_bat_dau, row.gio_ket_thuc)}
          </Text>
        </VStack>
      ),
    },
    {
      key: "tong_tien_san_pham",
      header: "Tiền món",
      width: proportional(1),
      align: "end",
      renderCell: (row) => (
        <Text hasTabularNumbers>{Math.round(row.tong_tien_san_pham).toLocaleString("vi-VN")}</Text>
      ),
    },
    {
      key: "tong_tien_gio",
      header: "Tiền giờ",
      width: proportional(1),
      align: "end",
      renderCell: (row) => (
        <Text hasTabularNumbers>{Math.round(row.tong_tien_gio).toLocaleString("vi-VN")}</Text>
      ),
    },
    {
      key: "phu_thu",
      header: "Phụ thu",
      width: proportional(1),
      align: "end",
      renderCell: (row) => (
        <Text hasTabularNumbers>{Math.round(row.phu_thu ?? 0).toLocaleString("vi-VN")}</Text>
      ),
    },
    {
      key: "tong_tien_thanh_toan",
      header: "Tổng tiền",
      width: proportional(1.1),
      align: "end",
      renderCell: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {Math.round(row.tong_tien_thanh_toan).toLocaleString("vi-VN")}
        </Text>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      width: pixel(148),
      align: "end",
      renderCell: (row) => {
        const isRowBusy = openingActionId === row.lich_su_phong_id;
        const isRowPrinting = reprintingHistoryId === row.lich_su_phong_id;
        return (
          <HStack gap={0.5} hAlign="end" vAlign="center">
            <IconButton
              label="Chỉnh sửa"
              icon={<Icon icon={Pencil} />}
              variant="ghost"
              size="sm"
              isDisabled={isRowBusy}
              onClick={() => {
                const item = histories.find((h) => h.lich_su_phong_id === row.lich_su_phong_id);
                if (item) void handleOpenEdit(item);
              }}
            />
            <IconButton
              label="In lại hóa đơn"
              icon={<Icon icon={Printer} />}
              variant="ghost"
              size="sm"
              isLoading={isRowPrinting}
              isDisabled={isRowBusy}
              onClick={() => {
                const item = histories.find((h) => h.lich_su_phong_id === row.lich_su_phong_id);
                if (item) void requestReprint(item);
              }}
            />
          </HStack>
        );
      },
    },
  ];

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <VStack gap={4} padding={4}>
      <HStack gap={4} vAlign="end" wrap="wrap" hAlign="between">
        <VStack gap={3}>
          <VStack gap={0.5}>
            <Heading level={2}>Lịch sử phòng</Heading>
            <Text color="secondary">Theo dõi hóa đơn đã thanh toán và in lại khi cần.</Text>
          </VStack>
          <HStack gap={2} vAlign="end" wrap="wrap">
            <DateInput
              label="Từ ngày"
              value={historyStart as ISODate}
              onChange={(v) => {
                if (v) onStartChange(v);
              }}
              format={(iso) => {
                const [year, month, day] = iso.split("-");
                return `${day}/${month}/${year}`;
              }}
              width={190}
            />
            <DateInput
              label="Đến ngày"
              value={historyEnd as ISODate}
              onChange={(v) => {
                if (v) onEndChange(v);
              }}
              format={(iso) => {
                const [year, month, day] = iso.split("-");
                return `${day}/${month}/${year}`;
              }}
              width={190}
            />
            <TextInput
              label="Phòng"
              type="search"
              value={roomSearch}
              onChange={setRoomSearch}
              placeholder="Tên phòng"
              startIcon="search"
              hasClear
              width={220}
            />
            <Button
              label="Làm mới"
              icon={<Icon icon={RefreshCw} />}
              variant="secondary"
              isLoading={filtering}
              onClick={() => void handleFilter()}
            />
          </HStack>
        </VStack>
        <HStack gap={2} vAlign="stretch">
          <Card padding={3} elevation="low">
            <VStack gap={0.5} width={140}>
              <Text type="supporting" color="secondary">Hóa đơn</Text>
              <Text weight="bold" size="xl" hasTabularNumbers>
                {filteredHistories.length.toLocaleString("vi-VN")}
              </Text>
            </VStack>
          </Card>
          <Card padding={3} elevation="low">
            <VStack gap={0.5} width={180}>
              <Text type="supporting" color="secondary">Tiền giờ</Text>
              <Text weight="bold" size="xl" hasTabularNumbers>
                {Math.round(totalHourFee).toLocaleString("vi-VN")}
              </Text>
            </VStack>
          </Card>
          <Card padding={3} elevation="low">
            <VStack gap={0.5} width={180}>
              <Text type="supporting" color="secondary">Doanh thu</Text>
              <Text weight="bold" size="xl" hasTabularNumbers>
                {Math.round(totalRevenue).toLocaleString("vi-VN")}
              </Text>
            </VStack>
          </Card>
        </HStack>
      </HStack>

      {/* ---- Reprint status banner ---- */}
      {reprintStatus && (
        <Banner
          status={reprintStatus.type === "ok" ? "success" : "error"}
          title={reprintStatus.message}
          isDismissable
          onDismiss={() => setReprintStatus(null)}
          collapsible={false}
        />
      )}

      {/* ---- Bulk-action toolbar ---- */}
      {selectionState.hasSelection && (
        <TableSelectionToolbar
          selection={selectionState}
          renderSelectionLabel={(count) => `Đã chọn ${count} hóa đơn`}
          clearLabel="Bỏ chọn tất cả"
          startContent={
            <Button
              label="Xóa mục đã chọn"
              variant="destructive"
              size="sm"
              icon={<Icon icon={Trash2} />}
              onClick={() => setDeleteIdsDialogOpen(true)}
            />
          }
        />
      )}

      {/* ---- Data table ---- */}
      <Card padding={0} elevation="low">
        <Table<HistoryRow>
          data={tableData}
          columns={columns}
          idKey="id"
          density="balanced"
          hasHover
          isStriped
          textOverflow="truncate"
          plugins={{ selection: selectionPlugin, rowOpen: rowOpenPlugin }}
          emptyState={
            <EmptyState
              title="Không có hóa đơn"
              description="Không có hóa đơn nào trong khoảng ngày đã chọn."
              isCompact
            />
          }
        />
      </Card>

      {/* ============================================================ */}
      {/*  Dialogs                                                      */}
      {/* ============================================================ */}

      {/* ---- Reprint confirm (ConfirmBillActionModal — already Astryx) ---- */}
      {reprintConfirmOpen && reprintTarget && (
        <ConfirmBillActionModal
          open={reprintConfirmOpen}
          title="Xác nhận in lại hóa đơn"
          confirmText={reprintingHistoryId === reprintTarget.lich_su_phong_id ? "Đang in..." : "Xác nhận in lại"}
          busy={reprintingHistoryId === reprintTarget.lich_su_phong_id}
          onClose={() => {
            setReprintConfirmOpen(false);
            setReprintTarget(null);
          }}
          onConfirm={() => void handleConfirmReprint()}
          leftContent={
            <VStack gap={3}>
              <Text>
                Bạn có muốn in lại hóa đơn{" "}
                <Text weight="semibold">#{reprintTarget.lich_su_phong_id}</Text> của phòng{" "}
                <Text weight="semibold">{reprintTarget.ten_phong}</Text> không?
              </Text>
              {printBillQr ? (
                <Selector
                  label="Chọn QR in lại"
                  hasClear
                  placeholder="-- Chọn QR --"
                  options={qrThanhToanOptions.map((opt) => ({
                    value: String(opt.qr_thanh_toan_id),
                    label: opt.qr_thanh_toan_ten,
                  }))}
                  value={reprintSelectedQrId != null ? String(reprintSelectedQrId) : null}
                  onChange={(v) => {
                    if (v == null) {
                      setReprintSelectedQrId(null);
                    } else {
                      const id = Number(v);
                      setReprintSelectedQrId(Number.isFinite(id) && id > 0 ? id : null);
                    }
                  }}
                />
              ) : (
                <Text type="supporting" color="secondary">
                  Đã tắt mã QR trong Cài đặt. Hóa đơn in lại sẽ không kèm QR.
                </Text>
              )}
              <Card variant="muted" padding={3}>
                <HStack hAlign="between" vAlign="center">
                  <Text color="secondary">Tổng tiền</Text>
                  <Text weight="semibold" hasTabularNumbers>
                    {Math.round(reprintTarget.tong_tien_thanh_toan).toLocaleString()}
                  </Text>
                </HStack>
              </Card>
            </VStack>
          }
          rightContent={
            <BillTemplatePreview
              title="PHIẾU THANH TOÁN"
              roomName={reprintTarget.ten_phong}
              startedAt={formatDateTime(reprintTarget.gio_bat_dau)}
              endedAt={formatDateTime(reprintTarget.gio_ket_thuc)}
              items={historyItems.map((item) => ({
                id: `reprint-pv-${item.san_pham_id}`,
                name: item.ten_san_pham,
                qty: item.so_luong,
                unitPrice: item.don_gia,
                amount: item.thanh_tien,
              }))}
              productTotal={reprintTarget.tong_tien_san_pham}
              hourTotal={reprintTarget.tong_tien_gio}
              surchargeTotal={reprintTarget.phu_thu ?? 0}
              grandTotal={reprintTarget.tong_tien_thanh_toan}
              qrDataUrl={printBillQr ? reprintQrPreviewUrl : ""}
            />
          }
        />
      )}

      {/* ---- Detail dialog ---- */}
      {detailOpen && selectedHistory && (
        <Dialog
          isOpen={detailOpen}
          onOpenChange={(next) => {
            if (!next) setDetailOpen(false);
          }}
          width={860}
          purpose="info"
          padding={0}
        >
          <DialogHeader
            title={`Chi tiết hóa đơn #${selectedHistory.lich_su_phong_id}`}
            onOpenChange={(next) => {
              if (!next) setDetailOpen(false);
            }}
          />
          <DialogBody>
            <VStack padding={5} hAlign="center">
              <BillTemplatePreview
                title="PHIẾU THANH TOÁN"
                roomName={selectedHistory.ten_phong}
                startedAt={formatDateTime(selectedHistory.gio_bat_dau)}
                endedAt={formatDateTime(selectedHistory.gio_ket_thuc)}
                items={historyItems.map((item) => ({
                  id: `detail-pv-${item.san_pham_id}`,
                  name: item.ten_san_pham,
                  qty: item.so_luong,
                  unitPrice: item.don_gia,
                  amount: item.thanh_tien,
                }))}
                productTotal={selectedHistory.tong_tien_san_pham}
                hourTotal={selectedHistory.tong_tien_gio}
                surchargeTotal={selectedHistory.phu_thu ?? 0}
                grandTotal={selectedHistory.tong_tien_thanh_toan}
                qrDataUrl=""
                size="large"
              />
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button label="Đóng" variant="ghost" onClick={() => setDetailOpen(false)} />
            <Button
              label="Chỉnh sửa"
              variant="secondary"
              onClick={() => {
                setDetailOpen(false);
                void handleOpenEdit(selectedHistory);
              }}
            />
          </DialogFooter>
        </Dialog>
      )}

      {/* ---- Edit dialog ---- */}
      {editOpen && editingHistory && (
        <Dialog
          isOpen={editOpen}
          onOpenChange={(next) => {
            if (!next && !savingEdit) setEditOpen(false);
          }}
          width={1180}
          maxHeight="92dvh"
          purpose="form"
          padding={0}
        >
          <DialogHeader
            title={`Chỉnh sửa hóa đơn #${editingHistory.lich_su_phong_id}`}
            subtitle="Sửa tiền giờ, phụ thu, số lượng, thêm món hoặc gỡ món khỏi hóa đơn đã thanh toán."
            onOpenChange={(next) => {
              if (!next && !savingEdit) setEditOpen(false);
            }}
          />
          <DialogBody>
            <HStack gap={4} padding={5} wrap="wrap" vAlign="start">
              {/* ---- Left: edit form ---- */}
              <VStack gap={3} width="100%" style={{ flex: 1, minWidth: "24rem" }}>
                {/* Money inputs */}
                <Card variant="muted" padding={3}>
                  <HStack gap={3} wrap="wrap" vAlign="end">
                    <TextInput
                      label="Tiền giờ"
                      value={editTienGio}
                      onChange={(v) => {
                        const nextHour = formatMoneyInput(v);
                        setEditTienGio(nextHour);
                        recalcEditTotal(editLines, editQtyByProductId, nextHour, editPhuThu);
                      }}
                      inputMode="numeric"
                      isDisabled={savingEdit}
                      width={180}
                    />
                    <TextInput
                      label="Phụ thu"
                      value={editPhuThu}
                      onChange={(v) => {
                        const nextSurcharge = formatMoneyInput(v);
                        setEditPhuThu(nextSurcharge);
                        recalcEditTotal(editLines, editQtyByProductId, editTienGio, nextSurcharge);
                      }}
                      inputMode="numeric"
                      isDisabled={savingEdit}
                      width={180}
                    />
                    <TextInput
                      label="Tổng tiền"
                      value={editTongTien}
                      onChange={() => {}}
                      inputMode="numeric"
                      isDisabled
                      width={180}
                    />
                    <Button
                      label="Làm tròn"
                      variant="secondary"
                      isDisabled={savingEdit}
                      onClick={() => {
                        const hour = parseMoneyInput(editTienGio || "0");
                        const surcharge = parseMoneyInput(editPhuThu || "0");
                        const hourSafe = Number.isFinite(hour) && hour >= 0 ? hour : 0;
                        const surchargeSafe = Number.isFinite(surcharge) && surcharge >= 0 ? surcharge : 0;
                        const total = editTongTienMon + hourSafe + surchargeSafe;
                        const rounded = roundUpMoney(total);
                        const delta = rounded - total;
                        if (delta <= 0) return;
                        const nextHour = formatMoneyInput(String(Math.round(hourSafe + delta)));
                        setEditTienGio(nextHour);
                        setEditTongTien(formatMoneyInput(String(rounded)));
                      }}
                    />
                  </HStack>
                </Card>

                {/* Editable items */}
                <Card padding={0}>
                  <VStack gap={0}>
                    <HStack gap={2} padding={3} vAlign="center">
                      <VStack style={{ flex: 1 }}>
                        <Text type="label" weight="semibold">Tên món</Text>
                      </VStack>
                      <VStack width={90} hAlign="center">
                        <Text type="label" weight="semibold">SL</Text>
                      </VStack>
                      <VStack width={100} hAlign="end">
                        <Text type="label" weight="semibold">Đơn giá</Text>
                      </VStack>
                      <VStack width={120} hAlign="end">
                        <Text type="label" weight="semibold">Thành tiền mới</Text>
                      </VStack>
                      <VStack width={36} />
                    </HStack>
                    <Divider />
                    {editLines.map((item, index) => {
                      const qty = Number(editQtyByProductId[item.san_pham_id] ?? 0);
                      const qtySafe = Number.isFinite(qty) && qty >= 0 ? qty : 0;
                      const thanhTienMoi = qtySafe * item.don_gia;
                      return (
                        <Fragment key={item.san_pham_id}>
                          <HStack gap={2} padding={3} vAlign="center">
                            <VStack style={{ flex: 1, minWidth: 0 }}>
                              <Text weight="medium" maxLines={1}>{item.ten_san_pham}</Text>
                            </VStack>
                            <TextInput
                              label={`Số lượng ${item.ten_san_pham}`}
                              isLabelHidden
                              value={editQtyByProductId[item.san_pham_id] ?? "0"}
                              onChange={(v) => {
                                const nextQty = { ...editQtyByProductId, [item.san_pham_id]: v };
                                setEditQtyByProductId(nextQty);
                                recalcEditTotal(editLines, nextQty, editTienGio, editPhuThu);
                              }}
                              inputMode="numeric"
                              isDisabled={savingEdit}
                              width={90}
                              size="sm"
                            />
                            <VStack width={100} hAlign="end">
                              <Text color="secondary" hasTabularNumbers>
                                {item.don_gia.toLocaleString()}
                              </Text>
                            </VStack>
                            <VStack width={120} hAlign="end">
                              <Text weight="semibold" hasTabularNumbers>
                                {thanhTienMoi.toLocaleString()}
                              </Text>
                            </VStack>
                            <IconButton
                              label={`Xóa ${item.ten_san_pham}`}
                              icon={<Icon icon={Trash2} />}
                              variant="ghost"
                              size="sm"
                              isDisabled={savingEdit}
                              onClick={() => {
                                const nextLines = editLines.filter(
                                  (line) => line.san_pham_id !== item.san_pham_id,
                                );
                                const nextQty = { ...editQtyByProductId };
                                delete nextQty[item.san_pham_id];
                                const wasOnBill = historyItems.some(
                                  (row) => row.san_pham_id === item.san_pham_id,
                                );
                                if (wasOnBill) {
                                  setRemovedProductIds((current) =>
                                    current.includes(item.san_pham_id)
                                      ? current
                                      : [...current, item.san_pham_id],
                                  );
                                }
                                setEditLines(nextLines);
                                setEditQtyByProductId(nextQty);
                                recalcEditTotal(nextLines, nextQty, editTienGio, editPhuThu);
                              }}
                            />
                          </HStack>
                          {index < editLines.length - 1 && <Divider />}
                        </Fragment>
                      );
                    })}
                    {editLines.length === 0 && (
                      <VStack padding={4} hAlign="center">
                        <Text color="secondary" type="supporting">
                          Chưa có món. Thêm món từ danh sách bên dưới.
                        </Text>
                      </VStack>
                    )}
                  </VStack>
                </Card>

                {/* Add product search */}
                <Card padding={3}>
                  <VStack gap={2}>
                    <Text weight="semibold" type="label">Thêm món vào hóa đơn</Text>
                    <TextInput
                      label="Tìm món"
                      isLabelHidden
                      value={editProductKeyword}
                      onChange={setEditProductKeyword}
                      placeholder="Tìm món để thêm..."
                      isDisabled={savingEdit}
                      hasClear
                      startIcon="search"
                      size="sm"
                    />
                    <VStack gap={0.5} isScrollable style={{ maxHeight: "10rem" }}>
                      {addableProducts.slice(0, 20).map((product) => (
                        <HStack key={product.san_pham_id} gap={2} vAlign="center" padding={1}>
                          <VStack style={{ flex: 1, minWidth: 0 }}>
                            <Text weight="medium" maxLines={1}>{product.ten_san_pham}</Text>
                          </VStack>
                          <Text color="secondary" hasTabularNumbers type="supporting">
                            {product.don_gia.toLocaleString()}
                          </Text>
                          <IconButton
                            label={`Thêm ${product.ten_san_pham}`}
                            icon={<Icon icon={Plus} />}
                            variant="ghost"
                            size="sm"
                            isDisabled={savingEdit}
                            onClick={() => {
                              const nextLines = [
                                ...editLines,
                                {
                                  san_pham_id: product.san_pham_id,
                                  ten_san_pham: product.ten_san_pham,
                                  don_gia: product.don_gia,
                                },
                              ];
                              const nextQty = { ...editQtyByProductId, [product.san_pham_id]: "1" };
                              setEditLines(nextLines);
                              setEditQtyByProductId(nextQty);
                              setRemovedProductIds((current) =>
                                current.filter((id) => id !== product.san_pham_id),
                              );
                              setEditProductKeyword("");
                              recalcEditTotal(nextLines, nextQty, editTienGio, editPhuThu);
                            }}
                          />
                        </HStack>
                      ))}
                      {addableProducts.length === 0 && (
                        <Text color="secondary" type="supporting">
                          Không còn món phù hợp để thêm.
                        </Text>
                      )}
                    </VStack>
                  </VStack>
                </Card>

                <Banner
                  status="warning"
                  title="Bấm thùng rác để gỡ món khỏi hóa đơn. In sau khi lưu là tùy chọn, không bắt buộc máy in để lưu."
                  collapsible={false}
                />

                <CheckboxInput
                  label="In hóa đơn sau khi lưu chỉnh sửa"
                  value={editPrintAfterSave}
                  isDisabled={savingEdit}
                  onChange={(checked) => setEditPrintAfterSave(checked)}
                />
              </VStack>

              {/* ---- Right: bill preview ---- */}
              <VStack gap={2} width={480}>
                <Heading level={4}>Xem Trước Hóa Đơn</Heading>
                <BillTemplatePreview
                  title="PHIẾU THANH TOÁN"
                  roomName={editingHistory.ten_phong}
                  startedAt={formatDateTime(editingHistory.gio_bat_dau)}
                  endedAt={formatDateTime(editingHistory.gio_ket_thuc)}
                  items={editLines.map((item) => {
                    const qty = Number(editQtyByProductId[item.san_pham_id] ?? 0);
                    const qtySafe = Number.isFinite(qty) && qty >= 0 ? qty : 0;
                    return {
                      id: `edit-pv-${item.san_pham_id}`,
                      name: item.ten_san_pham,
                      qty: qtySafe,
                      unitPrice: item.don_gia,
                      amount: Math.round(qtySafe * item.don_gia),
                    };
                  })}
                  productTotal={editTongTienMon}
                  hourTotal={parseMoneyInput(editTienGio || "0")}
                  surchargeTotal={parseMoneyInput(editPhuThu || "0") || 0}
                  grandTotal={parseMoneyInput(editTongTien || "0")}
                  qrDataUrl=""
                />
              </VStack>
            </HStack>
          </DialogBody>
          <DialogFooter>
            <Button
              label="Hủy"
              variant="ghost"
              isDisabled={savingEdit}
              onClick={() => setEditOpen(false)}
            />
            <Button
              label={savingEdit ? "Đang lưu..." : "Lưu chỉnh sửa"}
              variant="primary"
              isLoading={savingEdit}
              onClick={() => void handleSaveEdit()}
            />
          </DialogFooter>
        </Dialog>
      )}

      {/* ---- Delete by IDs confirm ---- */}
      <Dialog
        isOpen={deleteIdsDialogOpen}
        onOpenChange={setDeleteIdsDialogOpen}
        width={420}
        purpose="form"
      >
        <DialogHeader title="Xác nhận xóa hóa đơn" onOpenChange={setDeleteIdsDialogOpen} />
        <DialogBody>
          <VStack gap={3} padding={5}>
            <Text>
              Bạn sắp xóa <Text weight="bold">{selectionState.selectedCount}</Text> hóa đơn đã thanh toán.
              Hành động này không thể hoàn tác. Dữ liệu sau khi xóa sẽ mất vĩnh viễn.
            </Text>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button
            label="Hủy"
            variant="ghost"
            isDisabled={deleting}
            onClick={() => setDeleteIdsDialogOpen(false)}
          />
          <Button
            label={deleting ? "Đang xóa..." : "Xóa"}
            variant="destructive"
            isLoading={deleting}
            onClick={() => void confirmDeleteByIds()}
          />
        </DialogFooter>
      </Dialog>
    </VStack>
  );
}
