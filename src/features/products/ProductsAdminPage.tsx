import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Download, Plus, Search, Upload } from "lucide-react";
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
import type { Product, ProductGroup } from "@/types/karaoke";
import { formatInvokeError } from "@/utils/invokeError";

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

export function ProductsAdminPage({ products, groups, onCreate, onUpdate, onDelete, onReloadMaster }: Props) {
  const form = useForm<FormData>({
    defaultValues: { don_vi_tinh: "phan", don_gia: 10000 },
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

  const filteredProducts = products.filter((product) => {
    const byName = product.ten_san_pham.toLowerCase().includes(searchKeyword.toLowerCase());
    const byGroup =
      !filterGroupId ||
      (product.nhom_san_pham_id !== null && String(product.nhom_san_pham_id) === filterGroupId);
    return byName && byGroup;
  });

  async function handleExportSanPhamTemplate() {
    setCsvBusy(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      const dir = dialogPath(selected);
      if (!dir) return;
      await invoke("export_san_pham_template", { dirPath: dir });
      window.alert(`Đã tạo san_pham.csv trong thư mục:\n${dir}`);
    } catch (e) {
      window.alert(formatInvokeError(e));
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
      window.alert(stats.message);
      await onReloadMaster?.();
    } catch (e) {
      window.alert(formatInvokeError(e));
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
    <section className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Danh sách sản phẩm</h2>
          <p className="mt-1 text-sm text-slate-500">Quản lý món bán, đơn giá và nhóm sản phẩm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={csvBusy}
            onClick={() => void handleExportSanPhamTemplate()}
          >
            <Download size={16} />
            Tải mẫu CSV sản phẩm
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={csvBusy}
            onClick={() => void handleImportProductsCsv()}
          >
            <Upload size={16} />
            Import sản phẩm CSV
          </button>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} />
            Thêm sản phẩm mới
          </button>
        </div>
      </div>

      <div className="app-card mb-4 p-3">
        <div className="grid grid-cols-[1fr,220px,220px] gap-3">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="app-input w-full pl-9"
              placeholder="Tìm theo tên sản phẩm..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </label>
          <Select value={filterGroupId} onChange={(e) => setFilterGroupId(e.target.value)}>
            <option value="">Tất cả nhóm</option>
            {groups.map((group) => (
              <option key={group.nhom_san_pham_id} value={String(group.nhom_san_pham_id)}>
                {group.ten_nhom}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm">
            Tổng cộng: <span className="ml-1 font-bold text-slate-800">{filteredProducts.length} sản phẩm</span>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-sm font-semibold text-slate-700">
                <th className="border-b px-4 py-3">Mã</th>
                <th className="border-b px-4 py-3">Tên sản phẩm</th>
                <th className="border-b px-4 py-3">Nhóm</th>
                <th className="border-b px-4 py-3">Đơn vị</th>
                <th className="border-b px-4 py-3 text-right">Đơn giá</th>
                <th className="border-b px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const groupName =
                  groups.find((group) => group.nhom_san_pham_id === product.nhom_san_pham_id)?.ten_nhom ?? "--";
                return (
                  <tr key={product.san_pham_id} className="hover:bg-slate-50">
                    <td className="border-b px-4 py-3 font-semibold text-slate-800">{product.san_pham_id}</td>
                    <td className="border-b px-4 py-3 font-medium">{product.ten_san_pham}</td>
                    <td className="border-b px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {groupName}
                      </span>
                    </td>
                    <td className="border-b px-4 py-3">{product.don_vi_tinh}</td>
                    <td className="border-b px-4 py-3 text-right text-lg font-semibold text-slate-700">
                      {product.don_gia.toLocaleString()}
                    </td>
                    <td className="border-b px-4 py-3 text-right">
                      <button
                        className="mr-2 rounded-md bg-slate-100 px-3 py-1 text-slate-700"
                        onClick={() => {
                          setEditingProduct(product);
                          setEditTenSanPham(product.ten_san_pham);
                          setEditDonViTinh(product.don_vi_tinh);
                          setEditDonGia(String(product.don_gia));
                          setEditNhomId(
                            product.nhom_san_pham_id ? String(product.nhom_san_pham_id) : "",
                          );
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        className="rounded-md bg-rose-100 px-3 py-1 text-rose-700"
                        onClick={() => setDeleteTarget(product)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-500">
          <span>
            Hiển thị 1 đến {filteredProducts.length} của {filteredProducts.length} sản phẩm
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
          <div className="w-[560px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Thêm sản phẩm</h3>
            <form
              className="grid grid-cols-2 gap-2"
              onSubmit={form.handleSubmit(async (data) => {
                if (!data.san_pham_id || !data.ten_san_pham || !data.don_vi_tinh || data.don_gia <= 0) return;
                await onCreate(data);
                form.reset({ don_vi_tinh: "phan", don_gia: 10000 });
                setCreateModalOpen(false);
              })}
            >
              <div>
                <label className="mb-1 block text-sm text-slate-600">Mã</label>
                <input className="app-input w-full" {...form.register("san_pham_id")} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Tên</label>
                <input className="app-input w-full" {...form.register("ten_san_pham")} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Đơn vị</label>
                <input className="app-input w-full" {...form.register("don_vi_tinh")} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Đơn giá</label>
                <input
                  className="app-input w-full"
                  type="number"
                  {...form.register("don_gia", { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-600">Nhóm</label>
                <Select className="w-full" {...form.register("nhom_san_pham_id")}>
                  <option value="">Không nhóm</option>
                  {groups.map((group) => (
                    <option key={group.nhom_san_pham_id} value={String(group.nhom_san_pham_id)}>
                      {group.ten_nhom}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2 mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Hủy
                </button>
                <button className="btn-primary" type="submit">
                  Tạo sản phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="w-[520px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Sửa sản phẩm</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Mã sản phẩm</label>
                <input
                  className="w-full rounded border bg-slate-100 px-2 py-1"
                  value={editingProduct.san_pham_id}
                  disabled
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Tên sản phẩm</label>
                <input
                  className="app-input w-full"
                  value={editTenSanPham}
                  onChange={(e) => setEditTenSanPham(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Đơn vị</label>
                <input
                  className="app-input w-full"
                  value={editDonViTinh}
                  onChange={(e) => setEditDonViTinh(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Đơn giá</label>
                <input
                  className="app-input w-full"
                  value={editDonGia}
                  onChange={(e) => setEditDonGia(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-600">Nhóm</label>
                <Select className="w-full" value={editNhomId} onChange={(e) => setEditNhomId(e.target.value)}>
                  <option value="">Không nhóm</option>
                  {groups.map((group) => (
                    <option key={group.nhom_san_pham_id} value={String(group.nhom_san_pham_id)}>
                      {group.ten_nhom}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditingProduct(null)}>
                Hủy
              </button>
              <button
                className="btn-secondary"
                onClick={async () => {
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
            <AlertDialogTitle className="text-rose-600">Xác nhận xóa sản phẩm</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa sản phẩm{" "}
              <span className="font-semibold text-slate-900">
                {deleteTarget?.ten_san_pham ?? ""}
              </span>{" "}
              (<span className="font-mono">{deleteTarget?.san_pham_id ?? ""}</span>)? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteProduct();
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
