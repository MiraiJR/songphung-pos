import { useForm } from "react-hook-form";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { Room } from "@/types/karaoke";

type FormData = {
  ten_phong: string;
  tien_gio: number;
};

type EditFormData = {
  phong_id: number;
  ten_phong: string;
  tien_gio: number;
  loai_phong: "THUONG" | "VIP";
};

type Props = {
  rooms: Room[];
  onCreate: (data: FormData) => Promise<void>;
  onUpdate: (data: { phong_id: number; ten_phong: string; tien_gio: number }) => Promise<void>;
  onDelete: (roomId: number) => Promise<void>;
};

function inferLoaiPhong(name: string): "THUONG" | "VIP" {
  return name.toUpperCase().includes("VIP") ? "VIP" : "THUONG";
}

function normalizeRoomNameByType(name: string, loai: "THUONG" | "VIP"): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (loai === "VIP") {
    return trimmed.toUpperCase().includes("VIP") ? trimmed : `VIP-${trimmed}`;
  }
  return trimmed.replace(/^VIP[-\s]*/i, "").trim() || trimmed;
}

function formatAmountDigits(digits: string): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

export function RoomsAdminPage({ rooms, onCreate, onUpdate, onDelete }: Props) {
  const form = useForm<FormData>({
    defaultValues: { ten_phong: "", tien_gio: 180000 },
  });
  const editForm = useForm<EditFormData>({
    defaultValues: { phong_id: 0, ten_phong: "", tien_gio: 180000, loai_phong: "THUONG" },
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<Room | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editTienGioInput, setEditTienGioInput] = useState("180,000");

  const submit = form.handleSubmit(async (data) => {
    if (!data.ten_phong || data.tien_gio <= 0) return;
    await onCreate(data);
    form.reset({ ten_phong: "", tien_gio: 180000 });
    setCreateModalOpen(false);
  });

  const submitEdit = editForm.handleSubmit(async (data) => {
    if (!data.ten_phong || data.tien_gio <= 0) return;
    const tenPhong = normalizeRoomNameByType(data.ten_phong, data.loai_phong);
    if (!tenPhong) return;
    await onUpdate({
      phong_id: data.phong_id,
      ten_phong: tenPhong,
      tien_gio: data.tien_gio,
    });
    setEditModalOpen(false);
  });

  const filteredRooms = rooms.filter((room) =>
    room.ten_phong.toLowerCase().includes(searchKeyword.toLowerCase()),
  );

  return (
    <section className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Danh sách phòng</h2>
          <p className="mt-1 text-sm text-slate-500">Quản lý trạng thái và cấu hình các phòng hát.</p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} />
          Thêm phòng mới
        </button>
      </div>

      <div className="app-card mb-4 p-3">
        <div className="grid grid-cols-[1fr,220px] gap-3">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="app-input w-full pl-9"
              placeholder="Tìm kiếm theo tên phòng..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm">
            Tổng cộng: <span className="ml-1 font-bold text-slate-800">{filteredRooms.length} phòng</span>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="grid grid-cols-[2fr,1.5fr,1.5fr,1.5fr,1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <span>Tên phòng</span>
          <span>Loại phòng</span>
          <span>Đơn giá giờ (VNĐ)</span>
          <span>Trạng thái</span>
          <span className="text-right">Thao tác</span>
        </div>

        {filteredRooms.map((room) => {
          const isActive = room.trang_thai === "DANG_HOAT_DONG";
          const isVip = room.ten_phong.toUpperCase().includes("VIP");
          return (
            <div
              key={room.phong_id}
              className={`grid grid-cols-[2fr,1.5fr,1.5fr,1.5fr,1fr] items-center border-b border-slate-200 px-4 py-3 text-sm ${
                isActive ? "bg-emerald-50/60" : "bg-white"
              }`}
            >
              <div>
                <div className="text-xl font-semibold text-slate-800">{room.ten_phong}</div>
              </div>
              <div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    isVip ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {isVip ? "VIP" : "Thường"}
                </span>
              </div>
              <div className="text-2xl font-semibold text-slate-700">{room.tien_gio.toLocaleString()}</div>
              <div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isActive ? "Đang hoạt động" : "Trống"}
                </span>
              </div>
              <div className="text-right">
                <button
                  className="mr-2 rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  onClick={() => {
                    editForm.reset({
                      phong_id: room.phong_id,
                      ten_phong: room.ten_phong,
                      tien_gio: room.tien_gio,
                      loai_phong: inferLoaiPhong(room.ten_phong),
                    });
                    setEditTienGioInput(formatAmountDigits(String(Math.round(room.tien_gio))));
                    setEditModalOpen(true);
                  }}
                >
                  Sửa
                </button>
                <button
                  className="rounded-md bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-200"
                  onClick={() => setConfirmDeleteRoom(room)}
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-500">
          <span>
            Hiển thị 1 đến {filteredRooms.length} của {filteredRooms.length} phòng
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
          <div className="w-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Thêm phòng</h3>
            <form className="space-y-2" onSubmit={submit}>
              <input
                className="app-input w-full"
                placeholder="Tên phòng"
                {...form.register("ten_phong")}
              />
              <input
                className="app-input w-full"
                type="number"
                placeholder="Tiền giờ"
                {...form.register("tien_gio", { valueAsNumber: true })}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Hủy
                </button>
                <button className="btn-primary" type="submit">
                  Tạo phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="w-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Sửa thông tin phòng</h3>
            <form className="space-y-2" onSubmit={submitEdit}>
              <input
                className="app-input w-full bg-slate-100 text-slate-500"
                disabled
                value={`Mã phòng: ${editForm.watch("phong_id") || "--"}`}
              />
              <input
                className="app-input w-full"
                placeholder="Tên phòng"
                {...editForm.register("ten_phong")}
              />
              <Select className="w-full" {...editForm.register("loai_phong")}>
                <option value="THUONG">Thường</option>
                <option value="VIP">VIP</option>
              </Select>
              <input
                className="app-input w-full"
                placeholder="Tiền giờ"
                inputMode="numeric"
                value={editTienGioInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setEditTienGioInput(formatAmountDigits(digits));
                  editForm.setValue("tien_gio", digits ? Number(digits) : 0, { shouldValidate: true });
                }}
              />
              <p className="text-xs text-slate-500">Loại phòng sẽ tự đồng bộ vào tên (ví dụ: VIP-1).</p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setEditModalOpen(false)}>
                  Hủy
                </button>
                <button className="btn-secondary" type="submit">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDeleteRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
          <div className="w-[420px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Xác nhận xóa phòng</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn có chắc muốn xóa phòng <span className="font-semibold">{confirmDeleteRoom.ten_phong}</span> không?
            </p>
            <p className="mt-1 text-xs text-rose-600">Hành động này không thể hoàn tác.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteRoom(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  await onDelete(confirmDeleteRoom.phong_id);
                  setConfirmDeleteRoom(null);
                }}
              >
                Xóa phòng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
