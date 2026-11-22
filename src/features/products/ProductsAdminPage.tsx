import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import type { Product, ProductGroup } from "@/types/karaoke";
import { formatInvokeError } from "@/utils/invokeError";

import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Dialog, DialogHeader } from "@/components/AppDialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Stack";
import { Badge } from "@astryxdesign/core/Badge";
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import { useToast } from "@astryxdesign/core/Toast";

type FormData = {
  san_pham_id: string;
  ten_san_pham: string;
  don_vi_tinh: string;
  don_gia: number;
  nhom_san_pham_id?: string;
};

type CsvImportStats = {
  message: string;
  total_rows: number;
  inserted: number;
  updated: number;
};

type Props = {
  products: Product[];
  groups: ProductGroup[];
  onCreate: (data: FormData) => Promise<void>;
  onUpdate: (data: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReloadMaster?: () => Promise<void>;
};

function dialogPath(selected: string | string[] | null): string | null {
  if (selected === null) return null;
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

interface ProductRow extends Record<string, unknown> {
  san_pham_id: string;
  ten_san_pham: string;
  nhom_san_pham_id: number | null;
  don_vi_tinh: string;
  don_gia: number;
  groupName: string;
}

export function ProductsAdminPage({ products, groups, onCreate, onUpdate, onDelete, onReloadMaster }: Props) {
  const showToast = useToast();
  const form = useForm<FormData>({
    defaultValues: { don_vi_tinh: "", don_gia: 0 },
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterGroupId, setFilterGroupId] = useState<string>("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editTenSanPham, setEditTenSanPham] = useState("");
  const [editDonViTinh, setEditDonViTinh] = useState("");
  const [editDonGia, setEditDonGia] = useState("0");
  const [editNhomId, setEditNhomId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [createDonGiaInput, setCreateDonGiaInput] = useState("");

  const filteredProducts = products.filter((product) => {
    const byName = product.ten_san_pham.toLowerCase().includes(searchKeyword.toLowerCase());
    const byGroup =
      !filterGroupId ||
      (product.nhom_san_pham_id !== null && String(product.nhom_san_pham_id) === filterGroupId);
    return byName && byGroup;
  });

  const tableData: ProductRow[] = filteredProducts.map((product) => ({
    san_pham_id: product.san_pham_id,
    ten_san_pham: product.ten_san_pham,
    nhom_san_pham_id: product.nhom_san_pham_id,
    don_vi_tinh: product.don_vi_tinh,
    don_gia: product.don_gia,
    groupName:
      groups.find((g) => g.nhom_san_pham_id === product.nhom_san_pham_id)?.ten_nhom ?? "--",
  }));

  const groupOptions = [
    { value: "", label: "Tất cả nhóm" },
    ...groups.map((g) => ({ value: String(g.nhom_san_pham_id), label: g.ten_nhom })),
  ];

  const groupSelectorOptions = [
    { value: "", label: "Không nhóm" },
    ...groups.map((g) => ({ value: String(g.nhom_san_pham_id), label: g.ten_nhom })),
  ];

  async function handleExportSanPhamTemplate() {
    setCsvBusy(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      const dir = dialogPath(selected);
      if (!dir) return;
      await invoke("export_san_pham_template", { dirPath: dir });
      showToast({ body: `Đã tạo san_pham.csv trong thư mục:\n${dir}` });
    } catch (e) {
      showToast({ body: formatInvokeError(e), type: "error" });
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleImportProductsCsv() {
    setCsvBusy(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      const path = dialogPath(selected);
      if (!path) return;
      const stats = await invoke<CsvImportStats>("import_products_csv", { filePath: path });
      showToast({ body: stats.message });
      await onReloadMaster?.();
    } catch (e) {
      showToast({ body: formatInvokeError(e), type: "error" });
    } finally {
      setCsvBusy(false);
    }
  }

  async function confirmDeleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.san_pham_id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <VStack gap={4} padding={4}>
      <HStack justify="between" align="start" wrap="wrap" gap={3}>
        <VStack gap={0.5}>
          <Heading level={2}>Danh sách sản phẩm</Heading>
          <Text type="supporting">Quản lý món bán, đơn giá và nhóm sản phẩm.</Text>
        </VStack>
        <HStack gap={2} wrap="wrap">
          <Button
            label="Tải mẫu CSV sản phẩm"
            variant="secondary"
            icon={<Icon icon={Download} />}
            isDisabled={csvBusy}
            onClick={() => void handleExportSanPhamTemplate()}
          />
          <Button
            label="Import sản phẩm CSV"
            variant="secondary"
            icon={<Icon icon={Upload} />}
            isDisabled={csvBusy}
            onClick={() => void handleImportProductsCsv()}
          />
          <Button
            label="Thêm sản phẩm mới"
            variant="primary"
            icon={<Icon icon={Plus} />}
            onClick={() => setCreateModalOpen(true)}
          />
        </HStack>
      </HStack>

      <Card elevation="low" padding={3}>
        <HStack gap={3} align="center" wrap="wrap">
          <StackItem size="fill">
            <TextInput
              label="Tìm kiếm"
              isLabelHidden
              value={searchKeyword}
              onChange={(v) => setSearchKeyword(v)}
              placeholder="Tìm theo tên sản phẩm..."
              startIcon="search"
              hasClear
            />
          </StackItem>
          <Selector
            label="Nhóm sản phẩm"
            isLabelHidden
            value={filterGroupId}
            onChange={(v) => setFilterGroupId(v)}
            options={groupOptions}
            width={220}
          />
          <Text type="body" weight="semibold">
            Tổng cộng: {filteredProducts.length} sản phẩm
          </Text>
        </HStack>
      </Card>

      <Card elevation="low" padding={0}>
        <Table<ProductRow>
          data={tableData}
          idKey="san_pham_id"
          density="balanced"
          hasHover
          columns={[
            {
              key: "san_pham_id",
              header: "Mã",
              width: pixel(100),
              renderCell: (row) => <Text weight="semibold">{row.san_pham_id}</Text>,
            },
            {
              key: "ten_san_pham",
              header: "Tên sản phẩm",
              width: proportional(2),
              renderCell: (row) => <Text weight="medium">{row.ten_san_pham}</Text>,
            },
            {
              key: "groupName",
              header: "Nhóm",
              width: proportional(1),
              renderCell: (row) => <Badge label={row.groupName} variant="neutral" />,
            },
            {
              key: "don_vi_tinh",
              header: "Đơn vị",
              width: pixel(100),
            },
            {
              key: "don_gia",
              header: "Đơn giá",
              width: pixel(140),
              align: "end",
              renderCell: (row) => (
                <Text weight="semibold" size="lg">{row.don_gia.toLocaleString()}</Text>
              ),
            },
            {
              key: "actions",
              header: "Thao tác",
              width: pixel(160),
              align: "end",
              renderCell: (row) => {
                const product = products.find((p) => p.san_pham_id === row.san_pham_id)!;
                return (
                  <HStack gap={1}>
                    <Button
                      label="Sửa"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingProduct(product);
                        setEditTenSanPham(product.ten_san_pham);
                        setEditDonViTinh(product.don_vi_tinh);
                        setEditDonGia(String(product.don_gia));
                        setEditNhomId(
                          product.nhom_san_pham_id ? String(product.nhom_san_pham_id) : "",
                        );
                      }}
                    />
                    <Button
                      label="Xóa"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(product)}
                    />
                  </HStack>
                );
              },
            },
          ]}
          emptyState={
            <Text type="supporting" display="block" justify="center">
              Không có sản phẩm nào.
            </Text>
          }
        />
        <HStack padding={3} justify="between" align="center">
          <Text type="supporting">
            Hiển thị 1 đến {filteredProducts.length} của {filteredProducts.length} sản phẩm
          </Text>
        </HStack>
      </Card>

      {/* Create Product Dialog */}
      <Dialog isOpen={createModalOpen} onOpenChange={setCreateModalOpen} width={560} purpose="form">
        <DialogHeader title="Thêm sản phẩm" onOpenChange={setCreateModalOpen} />
        <VStack gap={2} padding={4}>
          <HStack gap={2}>
            <StackItem size="fill">
              <TextInput
                label="Mã"
                value={form.watch("san_pham_id") ?? ""}
                onChange={(v) => form.setValue("san_pham_id", v)}
                placeholder="VD: BIA01"
              />
            </StackItem>
            <StackItem size="fill">
              <TextInput
                label="Tên"
                value={form.watch("ten_san_pham") ?? ""}
                onChange={(v) => form.setValue("ten_san_pham", v)}
                placeholder="Tên sản phẩm"
              />
            </StackItem>
          </HStack>
          <HStack gap={2}>
            <StackItem size="fill">
              <TextInput
                label="Đơn vị"
                value={form.watch("don_vi_tinh") ?? ""}
                onChange={(v) => form.setValue("don_vi_tinh", v)}
                placeholder="VD: lon, chai, phần"
              />
            </StackItem>
            <StackItem size="fill">
              <TextInput
                label="Đơn giá"
                value={createDonGiaInput}
                onChange={(v) => {
                  const digits = v.replace(/\D/g, "");
                  setCreateDonGiaInput(digits ? Number(digits).toLocaleString("en-US") : "");
                  form.setValue("don_gia", digits ? Number(digits) : 0, { shouldValidate: true });
                }}
                placeholder="VD: 10,000"
                inputMode="numeric"
              />
            </StackItem>
          </HStack>
          <Selector
            label="Nhóm"
            value={form.watch("nhom_san_pham_id") ?? ""}
            onChange={(v) => form.setValue("nhom_san_pham_id", v)}
            options={groupSelectorOptions}
          />
          <HStack gap={2} justify="end" padding={1}>
            <Button label="Hủy" variant="ghost" onClick={() => setCreateModalOpen(false)} />
            <Button
              label="Tạo sản phẩm"
              variant="primary"
              clickAction={async () => {
                const data = form.getValues();
                if (!data.san_pham_id || !data.ten_san_pham || !data.don_vi_tinh || data.don_gia <= 0) return;
                await onCreate(data);
                form.reset({ san_pham_id: "", ten_san_pham: "", don_vi_tinh: "", don_gia: 0, nhom_san_pham_id: "" });
                setCreateDonGiaInput("");
                setCreateModalOpen(false);
              }}
            />
          </HStack>
        </VStack>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog
        isOpen={editingProduct !== null}
        onOpenChange={(open) => { if (!open) setEditingProduct(null); }}
        width={520}
        purpose="form"
      >
        <DialogHeader title="Sửa sản phẩm" onOpenChange={() => setEditingProduct(null)} />
        <VStack gap={2} padding={4}>
          <HStack gap={2}>
            <StackItem size="fill">
              <TextInput
                label="Mã sản phẩm"
                value={editingProduct?.san_pham_id ?? ""}
                isDisabled
                onChange={() => {}}
              />
            </StackItem>
            <StackItem size="fill">
              <TextInput
                label="Tên sản phẩm"
                value={editTenSanPham}
                onChange={(v) => setEditTenSanPham(v)}
              />
            </StackItem>
          </HStack>
          <HStack gap={2}>
            <StackItem size="fill">
              <TextInput
                label="Đơn vị"
                value={editDonViTinh}
                onChange={(v) => setEditDonViTinh(v)}
              />
            </StackItem>
            <StackItem size="fill">
              <TextInput
                label="Đơn giá"
                value={editDonGia}
                onChange={(v) => setEditDonGia(v.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
              />
            </StackItem>
          </HStack>
          <Selector
            label="Nhóm"
            value={editNhomId}
            onChange={(v) => setEditNhomId(v)}
            options={groupSelectorOptions}
          />
          <HStack gap={2} justify="end" padding={1}>
            <Button label="Hủy" variant="ghost" onClick={() => setEditingProduct(null)} />
            <Button
              label="Lưu thay đổi"
              variant="secondary"
              clickAction={async () => {
                if (!editingProduct) return;
                if (!editTenSanPham || !editDonViTinh || Number(editDonGia) <= 0) return;
                await onUpdate({
                  san_pham_id: editingProduct.san_pham_id,
                  ten_san_pham: editTenSanPham,
                  don_vi_tinh: editDonViTinh,
                  don_gia: Number(editDonGia),
                  nhom_san_pham_id: editNhomId || "",
                });
                setEditingProduct(null);
              }}
            />
          </HStack>
        </VStack>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
        width={420}
        purpose="required"
      >
        <DialogHeader title="Xác nhận xóa sản phẩm" onOpenChange={() => { if (!deleting) setDeleteTarget(null); }} />
        <VStack gap={3} padding={4}>
          <Text type="body">
            Bạn có chắc chắn muốn xóa sản phẩm{" "}
            <Text weight="semibold">{deleteTarget?.ten_san_pham ?? ""}</Text>{" "}
            (<Text type="code">{deleteTarget?.san_pham_id ?? ""}</Text>)? Hành động này không thể hoàn tác.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Hủy" variant="ghost" isDisabled={deleting} onClick={() => setDeleteTarget(null)} />
            <Button
              label={deleting ? "Đang xóa..." : "Xóa"}
              variant="destructive"
              isLoading={deleting}
              clickAction={async () => { await confirmDeleteProduct(); }}
            />
          </HStack>
        </VStack>
      </Dialog>
    </VStack>
  );
}
