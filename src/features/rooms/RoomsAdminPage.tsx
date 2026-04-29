import { useForm } from "react-hook-form";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Room } from "@/types/karaoke";

type FormData = {
  ten_phong: string;
  tien_gio: number;
};

type Props = {
  rooms: Room[];
  onCreate: (data: FormData) => Promise<void>;
  onDelete: (roomId: number) => Promise<void>;
};

export function RoomsAdminPage({ rooms, onCreate, onDelete }: Props) {
  const form = useForm<FormData>({
    defaultValues: { ten_phong: "", tien_gio: 180000 },
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const submit = form.handleSubmit(async (data) => {
    if (!data.ten_phong || data.tien_gio <= 0) return;
    await onCreate(data);
    form.reset({ ten_phong: "", tien_gio: 180000 });
    setCreateModalOpen(false);
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
                  className="rounded-md bg-rose-100 px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-200"
                  onClick={() => void onDelete(room.phong_id)}
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
    </section>
  );
}
