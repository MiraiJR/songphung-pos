import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";
import { Download, Plus, Search, Upload, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProductGroup } from "@/types/karaoke";
import { formatInvokeError } from "@/utils/invokeError";

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

export function CategoriesAdminPage({ groups, onCreate, onUpdate, onDelete, onReloadMaster }: Props) {
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

  async function handleExportNhomTemplate() {
    setCsvBusy(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      const dir = dialogPath(selected);
      if (!dir) return;
      await invoke("export_nhom_san_pham_template", { dirPath: dir });
      window.alert(`Đã tạo nhom_san_pham.csv trong thư mục:\n${dir}`);
    } catch (e) {
      window.alert(formatInvokeError(e));
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
      window.alert(stats.message);
      await onReloadMaster?.();
    } catch (e) {
      window.alert(formatInvokeError(e));
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
    <section className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Danh sách nhóm sản phẩm</h2>
          <p className="mt-1 text-sm text-slate-500">Quản lý cấu trúc nhóm và nhóm cha.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={csvBusy}
            onClick={() => void handleExportNhomTemplate()}
          >
            <Download size={16} />
            Tải mẫu CSV nhóm
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={csvBusy}
            onClick={() => void handleImportCategoriesCsv()}
          >
            <Upload size={16} />
            Import nhóm CSV
          </button>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            Thêm nhóm mới
          </button>
        </div>
      </div>

      <div className="app-card mb-4 p-3">
        <div className="grid grid-cols-[1fr,220px,220px] gap-3">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="app-input w-full pl-9"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tên nhóm..."
            />
          </label>
          <Select value={filterParentId} onChange={(e) => setFilterParentId(e.target.value)}>
            <option value="">Tất cả nhóm cha</option>
            {groups.map((group) => (
              <option key={group.nhom_san_pham_id} value={String(group.nhom_san_pham_id)}>
                {group.ten_nhom}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm">
            Tổng cộng: <span className="ml-1 font-bold text-slate-800">{filteredGroups.length} nhóm</span>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="grid grid-cols-[2fr,2fr,1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <span>Tên nhóm</span>
          <span>Nhóm cha</span>
          <span className="text-right">Thao tác</span>
        </div>
        {filteredGroups.map((group) => {
          const parentName = group.nhom_san_pham_cha_id
            ? groups.find((g) => g.nhom_san_pham_id === group.nhom_san_pham_cha_id)?.ten_nhom ?? "--"
            : "--";
          return (
            <div key={group.nhom_san_pham_id} className="grid grid-cols-[2fr,2fr,1fr] items-center border-b border-slate-200 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-800">{group.ten_nhom}</span>
              <span>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {parentName}
                </span>
              </span>
              <div className="text-right">
                <button
                  className="mr-2 rounded-md bg-slate-100 px-3 py-1 text-slate-700"
                  onClick={() => {
                    setEditingId(group.nhom_san_pham_id);
                    setEditTenNhom(group.ten_nhom);
                    setEditParentId(group.nhom_san_pham_cha_id ? String(group.nhom_san_pham_cha_id) : "");
                    setEditModalOpen(true);
                  }}
                >
                  Sửa
                </button>
                <button
                  className="rounded-md bg-rose-100 px-3 py-1 text-rose-700"
                  onClick={() => setDeleteTarget(group)}
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-500">
          <span>
            Hiển thị 1 đến {filteredGroups.length} của {filteredGroups.length} nhóm
          </span>
          <div className="flex items-center gap-2">
            <button className="h-8 w-8 rounded border border-slate-200 bg-white text-slate-400">‹</button>
            <button className="h-8 w-8 rounded bg-primary text-white">1</button>
            <button className="h-8 w-8 rounded border border-slate-200 bg-white text-slate-500">›</button>
          </div>
        </div>
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="relative w-[520px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setCreateModalOpen(false)}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
            <h3 className="mb-3 text-lg font-semibold">Thêm nhóm sản phẩm</h3>
            <div className="space-y-2">
              <input
                className="app-input w-full"
                value={tenNhom}
                onChange={(e) => setTenNhom(e.target.value)}
                placeholder="Tên nhóm"
              />
              <Select className="w-full" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">Không nhóm cha</option>
                {groups.map((group) => (
                  <option key={group.nhom_san_pham_id} value={String(group.nhom_san_pham_id)}>
                    {group.ten_nhom}
                  </option>
                ))}
              </Select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCreateModalOpen(false)}>
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (!tenNhom.trim()) return;
                  await onCreate({
                    ten_nhom: tenNhom.trim(),
                    nhom_san_pham_cha_id: parentId ? Number(parentId) : null,
                  });
                  setTenNhom("");
                  setParentId("");
                  setCreateModalOpen(false);
                }}
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="relative w-[520px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setEditModalOpen(false)}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
            <h3 className="mb-3 text-lg font-semibold">Sửa nhóm sản phẩm</h3>
            <div className="space-y-2">
              <input
                className="app-input w-full"
                value={editTenNhom}
                onChange={(e) => setEditTenNhom(e.target.value)}
                placeholder="Tên nhóm"
              />
              <Select className="w-full" value={editParentId} onChange={(e) => setEditParentId(e.target.value)}>
                <option value="">Không nhóm cha</option>
                {groups
                  .filter((g) => g.nhom_san_pham_id !== editingId)
                  .map((group) => (
                    <option key={group.nhom_san_pham_id} value={String(group.nhom_san_pham_id)}>
                      {group.ten_nhom}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditModalOpen(false)}>
                Hủy
              </button>
              <button
                className="btn-secondary"
                onClick={async () => {
                  if (!editTenNhom.trim()) return;
                  await onUpdate({
                    nhom_san_pham_id: editingId,
                    ten_nhom: editTenNhom.trim(),
                    nhom_san_pham_cha_id: editParentId ? Number(editParentId) : null,
                  });
                  setEditModalOpen(false);
                }}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Xác nhận xóa nhóm sản phẩm</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa nhóm{" "}
              <span className="font-semibold text-slate-900">
                {deleteTarget?.ten_nhom ?? ""}
              </span>
              ? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteGroup();
              }}
            >
              {deleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
