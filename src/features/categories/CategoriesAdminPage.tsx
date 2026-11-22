import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import type { ProductGroup } from "@/types/karaoke";
import { formatInvokeError } from "@/utils/invokeError";

import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/AppDialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Stack";
import { Badge } from "@astryxdesign/core/Badge";
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import { useToast } from "@astryxdesign/core/Toast";

type CsvImportStats = {
  message: string;
  total_rows: number;
  inserted: number;
  updated: number;
};

type Props = {
  groups: ProductGroup[];
  onCreate: (payload: { ten_nhom: string; nhom_san_pham_cha_id: number | null }) => Promise<void>;
  onUpdate: (payload: {
    nhom_san_pham_id: number;
    ten_nhom: string;
    nhom_san_pham_cha_id: number | null;
  }) => Promise<void>;
  onDelete: (groupId: number) => Promise<void>;
  onReloadMaster?: () => Promise<void>;
};

function dialogPath(selected: string | string[] | null): string | null {
  if (selected === null) return null;
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

interface GroupRow extends Record<string, unknown> {
  nhom_san_pham_id: number;
  ten_nhom: string;
  nhom_san_pham_cha_id: number | null;
  parentName: string;
}

export function CategoriesAdminPage({ groups, onCreate, onUpdate, onDelete, onReloadMaster }: Props) {
  const showToast = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterParentId, setFilterParentId] = useState<string>("");

  const [tenNhom, setTenNhom] = useState("");
  const [parentId, setParentId] = useState<string>("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTenNhom, setEditTenNhom] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<ProductGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        const byName = group.ten_nhom.toLowerCase().includes(searchKeyword.toLowerCase());
        const byParent =
          !filterParentId ||
          (group.nhom_san_pham_cha_id !== null &&
            String(group.nhom_san_pham_cha_id) === filterParentId);
        return byName && byParent;
      }),
    [groups, searchKeyword, filterParentId],
  );

  const tableData: GroupRow[] = filteredGroups.map((group) => ({
    nhom_san_pham_id: group.nhom_san_pham_id,
    ten_nhom: group.ten_nhom,
    nhom_san_pham_cha_id: group.nhom_san_pham_cha_id,
    parentName: group.nhom_san_pham_cha_id
      ? groups.find((g) => g.nhom_san_pham_id === group.nhom_san_pham_cha_id)?.ten_nhom ?? "--"
      : "--",
  }));

  const filterParentOptions = [
    { value: "", label: "Tất cả nhóm cha" },
    ...groups.map((g) => ({ value: String(g.nhom_san_pham_id), label: g.ten_nhom })),
  ];

  const parentSelectorOptions = [
    { value: "", label: "Không nhóm cha" },
    ...groups.map((g) => ({ value: String(g.nhom_san_pham_id), label: g.ten_nhom })),
  ];

  async function handleExportNhomTemplate() {
    setCsvBusy(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      const dir = dialogPath(selected);
      if (!dir) return;
      await invoke("export_nhom_san_pham_template", { dirPath: dir });
      showToast({ body: `Đã tạo nhom_san_pham.csv trong thư mục:\n${dir}` });
    } catch (e) {
      showToast({ body: formatInvokeError(e), type: "error" });
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleImportCategoriesCsv() {
    setCsvBusy(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      const path = dialogPath(selected);
      if (!path) return;
      const stats = await invoke<CsvImportStats>("import_categories_csv", { filePath: path });
      showToast({ body: stats.message });
      await onReloadMaster?.();
    } catch (e) {
      showToast({ body: formatInvokeError(e), type: "error" });
    } finally {
      setCsvBusy(false);
    }
  }

  async function confirmDeleteGroup() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.nhom_san_pham_id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <VStack gap={4} padding={4}>
      <HStack justify="between" align="start" wrap="wrap" gap={3}>
        <VStack gap={0.5}>
          <Heading level={2}>Danh sách nhóm sản phẩm</Heading>
          <Text type="supporting">Quản lý cấu trúc nhóm và nhóm cha.</Text>
        </VStack>
        <HStack gap={2} wrap="wrap">
          <Button
            label="Tải mẫu CSV nhóm"
            variant="secondary"
            icon={<Icon icon={Download} />}
            isDisabled={csvBusy}
            onClick={() => void handleExportNhomTemplate()}
          />
          <Button
            label="Import nhóm CSV"
            variant="secondary"
            icon={<Icon icon={Upload} />}
            isDisabled={csvBusy}
            onClick={() => void handleImportCategoriesCsv()}
          />
          <Button
            label="Thêm nhóm mới"
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
              placeholder="Tìm theo tên nhóm..."
              startIcon="search"
              hasClear
            />
          </StackItem>
          <Selector
            label="Nhóm cha"
            isLabelHidden
            value={filterParentId}
            onChange={(v) => setFilterParentId(v)}
            options={filterParentOptions}
            width={220}
          />
          <Text type="body" weight="semibold">
            Tổng cộng: {filteredGroups.length} nhóm
          </Text>
        </HStack>
      </Card>

      <Card elevation="low" padding={0}>
        <Table<GroupRow>
          data={tableData}
          idKey="nhom_san_pham_id"
          density="balanced"
          hasHover
          columns={[
            {
              key: "ten_nhom",
              header: "Tên nhóm",
              width: proportional(2),
              renderCell: (row) => <Text weight="semibold">{row.ten_nhom}</Text>,
            },
            {
              key: "parentName",
              header: "Nhóm cha",
              width: proportional(2),
              renderCell: (row) => <Badge label={row.parentName} variant="neutral" />,
            },
            {
              key: "actions",
              header: "Thao tác",
              width: pixel(160),
              align: "end",
              renderCell: (row) => {
                const group = groups.find((g) => g.nhom_san_pham_id === row.nhom_san_pham_id)!;
                return (
                  <HStack gap={1}>
                    <Button
                      label="Sửa"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingId(group.nhom_san_pham_id);
                        setEditTenNhom(group.ten_nhom);
                        setEditParentId(group.nhom_san_pham_cha_id ? String(group.nhom_san_pham_cha_id) : "");
                        setEditModalOpen(true);
                      }}
                    />
                    <Button
                      label="Xóa"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(group)}
                    />
                  </HStack>
                );
              },
            },
          ]}
          emptyState={
            <Text type="supporting" display="block" justify="center">
              Không có nhóm nào.
            </Text>
          }
        />
        <HStack padding={3} justify="between" align="center">
          <Text type="supporting">
            Hiển thị 1 đến {filteredGroups.length} của {filteredGroups.length} nhóm
          </Text>
        </HStack>
      </Card>

      {/* Create Group Dialog */}
      <Dialog isOpen={createModalOpen} onOpenChange={setCreateModalOpen} width={520} purpose="form">
        <DialogHeader title="Thêm nhóm sản phẩm" onOpenChange={setCreateModalOpen} />
        <DialogBody>
        <VStack gap={2} padding={4}>
          <TextInput
            label="Tên nhóm"
            value={tenNhom}
            onChange={(v) => setTenNhom(v)}
            placeholder="Tên nhóm"
          />
          <Selector
            label="Nhóm cha"
            value={parentId}
            onChange={(v) => setParentId(v)}
            options={parentSelectorOptions}
          />
        </VStack>
        </DialogBody>
        <DialogFooter>
          <Button label="Hủy" variant="ghost" onClick={() => setCreateModalOpen(false)} />
          <Button
            label="Tạo nhóm"
            variant="primary"
            clickAction={async () => {
              if (!tenNhom.trim()) return;
              await onCreate({
                ten_nhom: tenNhom.trim(),
                nhom_san_pham_cha_id: parentId ? Number(parentId) : null,
              });
              setTenNhom("");
              setParentId("");
              setCreateModalOpen(false);
            }}
          />
        </DialogFooter>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog
        isOpen={editModalOpen && editingId !== null}
        onOpenChange={(open) => { if (!open) setEditModalOpen(false); }}
        width={520}
        purpose="form"
      >
        <DialogHeader title="Sửa nhóm sản phẩm" onOpenChange={() => setEditModalOpen(false)} />
        <DialogBody>
        <VStack gap={2} padding={4}>
          <TextInput
            label="Tên nhóm"
            value={editTenNhom}
            onChange={(v) => setEditTenNhom(v)}
            placeholder="Tên nhóm"
          />
          <Selector
            label="Nhóm cha"
            value={editParentId}
            onChange={(v) => setEditParentId(v)}
            options={[
              { value: "", label: "Không nhóm cha" },
              ...groups
                .filter((g) => g.nhom_san_pham_id !== editingId)
                .map((g) => ({ value: String(g.nhom_san_pham_id), label: g.ten_nhom })),
            ]}
          />
        </VStack>
        </DialogBody>
        <DialogFooter>
          <Button label="Hủy" variant="ghost" onClick={() => setEditModalOpen(false)} />
          <Button
            label="Lưu thay đổi"
            variant="secondary"
            clickAction={async () => {
              if (!editTenNhom.trim() || editingId === null) return;
              await onUpdate({
                nhom_san_pham_id: editingId,
                ten_nhom: editTenNhom.trim(),
                nhom_san_pham_cha_id: editParentId ? Number(editParentId) : null,
              });
              setEditModalOpen(false);
            }}
          />
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
        width={420}
        purpose="required"
      >
        <DialogHeader title="Xác nhận xóa nhóm sản phẩm" onOpenChange={() => { if (!deleting) setDeleteTarget(null); }} />
        <DialogBody>
        <VStack gap={3} padding={4}>
          <Text type="body">
            Bạn có chắc chắn muốn xóa nhóm{" "}
            <Text weight="semibold">{deleteTarget?.ten_nhom ?? ""}</Text>
            ? Hành động này không thể hoàn tác.
          </Text>
        </VStack>
        </DialogBody>
        <DialogFooter>
          <Button label="Hủy" variant="ghost" isDisabled={deleting} onClick={() => setDeleteTarget(null)} />
          <Button
            label={deleting ? "Đang xóa..." : "Xóa"}
            variant="destructive"
            isLoading={deleting}
            clickAction={async () => { await confirmDeleteGroup(); }}
          />
        </DialogFooter>
      </Dialog>
    </VStack>
  );
}
