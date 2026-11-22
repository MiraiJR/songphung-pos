import { useForm } from "react-hook-form";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { Room } from "@/types/karaoke";

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
import { Badge } from "@astryxdesign/core/Badge";
import { Table, proportional, pixel } from "@astryxdesign/core/Table";


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

interface RoomRow extends Record<string, unknown> {
  phong_id: number;
  ten_phong: string;
  tien_gio: number;
  trang_thai: string;
  isVip: boolean;
  isActive: boolean;
}

export function RoomsAdminPage({ rooms, onCreate, onUpdate, onDelete }: Props) {
  const form = useForm<FormData>({
    defaultValues: { ten_phong: "", tien_gio: 0 },
  });
  const editForm = useForm<EditFormData>({
    defaultValues: { phong_id: 0, ten_phong: "", tien_gio: 180000, loai_phong: "THUONG" },
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<Room | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [createTienGioInput, setCreateTienGioInput] = useState("");
  const [editTienGioInput, setEditTienGioInput] = useState("180,000");

  const submit = form.handleSubmit(async (data) => {
    if (!data.ten_phong || data.tien_gio <= 0) return;
    await onCreate(data);
    form.reset({ ten_phong: "", tien_gio: 0 });
    setCreateTienGioInput("");
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
  const activeCount = filteredRooms.filter((room) => room.trang_thai === "DANG_HOAT_DONG").length;
  const emptyCount = filteredRooms.length - activeCount;

  const tableData: RoomRow[] = filteredRooms.map((room) => ({
    phong_id: room.phong_id,
    ten_phong: room.ten_phong,
    tien_gio: room.tien_gio,
    trang_thai: room.trang_thai,
    isVip: room.ten_phong.toUpperCase().includes("VIP"),
    isActive: room.trang_thai === "DANG_HOAT_DONG",
  }));

  return (
    <VStack gap={4} padding={4}>
      <HStack justify="between" align="end" wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={2}>Danh sách phòng</Heading>
          <Text type="supporting">
            {filteredRooms.length} phòng · {activeCount} đang hát · {emptyCount} trống
          </Text>
        </VStack>
        <HStack gap={2} align="center">
          <TextInput
            label="Tìm kiếm"
            isLabelHidden
            value={searchKeyword}
            onChange={(v) => setSearchKeyword(v)}
            placeholder="Tên phòng"
            startIcon="search"
            hasClear
            width={240}
          />
          <Button
            label="Thêm phòng"
            variant="primary"
            icon={<Icon icon={Plus} />}
            onClick={() => setCreateModalOpen(true)}
          />
        </HStack>
      </HStack>

      <Card elevation="low" padding={0}>
        <Table<RoomRow>
          data={tableData}
          idKey="phong_id"
          density="balanced"
          hasHover
          columns={[
            {
              key: "ten_phong",
              header: "Tên phòng",
              width: proportional(1),
              renderCell: (row) => (
                <Text weight="semibold">{row.ten_phong}</Text>
              ),
            },
            {
              key: "isVip",
              header: "Loại",
              width: pixel(110),
              renderCell: (row) => (
                <Badge
                  label={row.isVip ? "VIP" : "Thường"}
                  variant={row.isVip ? "red" : "neutral"}
                />
              ),
            },
            {
              key: "tien_gio",
              header: "Giá / giờ",
              width: pixel(140),
              align: "end",
              renderCell: (row) => (
                <Text weight="semibold" hasTabularNumbers>
                  {row.tien_gio.toLocaleString("vi-VN")}
                </Text>
              ),
            },
            {
              key: "trang_thai",
              header: "Trạng thái",
              width: pixel(150),
              renderCell: (row) => (
                <Badge
                  label={row.isActive ? "Đang hát" : "Trống"}
                  variant={row.isActive ? "success" : "neutral"}
                />
              ),
            },
            {
              key: "actions",
              header: "Thao tác",
              width: pixel(150),
              align: "end",
              renderCell: (row) => {
                const room = rooms.find((r) => r.phong_id === row.phong_id)!;
                return (
                  <HStack gap={1}>
                    <Button
                      label="Sửa"
                      variant="secondary"
                      size="sm"
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
                    />
                    <Button
                      label="Xóa"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDeleteRoom(room)}
                    />
                  </HStack>
                );
              },
            },
          ]}
          emptyState={
            <Text type="supporting" display="block" justify="center">
              {searchKeyword ? "Không có phòng khớp từ khóa." : "Chưa có phòng nào."}
            </Text>
          }
        />
      </Card>

      {/* Create Room Dialog */}
      <Dialog isOpen={createModalOpen} onOpenChange={setCreateModalOpen} width={420} purpose="form">
        <DialogHeader title="Thêm phòng" onOpenChange={setCreateModalOpen} />
        <DialogBody>
        <VStack gap={2} padding={4}>
          <TextInput
            label="Tên phòng"
            value={form.watch("ten_phong")}
            onChange={(v) => form.setValue("ten_phong", v)}
            placeholder="Tên phòng (VD: P1 hoặc VIP-P1)"
          />
          <TextInput
            label="Đơn giá giờ"
            value={createTienGioInput}
            onChange={(v) => {
              const digits = v.replace(/\D/g, "");
              setCreateTienGioInput(formatAmountDigits(digits));
              form.setValue("tien_gio", digits ? Number(digits) : 0, { shouldValidate: true });
            }}
            placeholder="Đơn giá giờ (VD: 180,000)"
            inputMode="numeric"
          />
        </VStack>
        </DialogBody>
        <DialogFooter>
          <Button label="Hủy" variant="ghost" onClick={() => setCreateModalOpen(false)} />
          <Button label="Tạo phòng" variant="primary" onClick={() => void submit()} />
        </DialogFooter>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog isOpen={editModalOpen} onOpenChange={setEditModalOpen} width={420} purpose="form">
        <DialogHeader title="Sửa thông tin phòng" onOpenChange={setEditModalOpen} />
        <DialogBody>
        <VStack gap={2} padding={4}>
          <TextInput
            label="Mã phòng"
            value={`Mã phòng: ${editForm.watch("phong_id") || "--"}`}
            isDisabled
            onChange={() => {}}
          />
          <TextInput
            label="Tên phòng"
            value={editForm.watch("ten_phong")}
            onChange={(v) => editForm.setValue("ten_phong", v)}
            placeholder="Tên phòng"
          />
          <Selector
            label="Loại phòng"
            value={editForm.watch("loai_phong")}
            onChange={(v) => editForm.setValue("loai_phong", v as "THUONG" | "VIP")}
            options={[
              { value: "THUONG", label: "Thường" },
              { value: "VIP", label: "VIP" },
            ]}
          />
          <TextInput
            label="Tiền giờ"
            value={editTienGioInput}
            onChange={(v) => {
              const digits = v.replace(/\D/g, "");
              setEditTienGioInput(formatAmountDigits(digits));
              editForm.setValue("tien_gio", digits ? Number(digits) : 0, { shouldValidate: true });
            }}
            placeholder="Tiền giờ"
            inputMode="numeric"
          />
          <Text type="supporting">Loại phòng sẽ tự đồng bộ vào tên (ví dụ: VIP-1).</Text>
        </VStack>
        </DialogBody>
        <DialogFooter>
          <Button label="Hủy" variant="ghost" onClick={() => setEditModalOpen(false)} />
          <Button label="Lưu thay đổi" variant="secondary" onClick={() => void submitEdit()} />
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={confirmDeleteRoom !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteRoom(null); }}
        width={420}
        purpose="required"
      >
        <DialogHeader title="Xác nhận xóa phòng" onOpenChange={() => setConfirmDeleteRoom(null)} />
        <DialogBody>
        <VStack gap={3} padding={4}>
          <Text type="body">
            Bạn có chắc muốn xóa phòng{" "}
            <Text weight="semibold">{confirmDeleteRoom?.ten_phong}</Text> không?
          </Text>
          <Text type="supporting" color="accent">Hành động này không thể hoàn tác.</Text>
        </VStack>
        </DialogBody>
        <DialogFooter>
          <Button label="Hủy" variant="ghost" onClick={() => setConfirmDeleteRoom(null)} />
          <Button
            label="Xóa phòng"
            variant="destructive"
            clickAction={async () => {
              if (!confirmDeleteRoom) return;
              await onDelete(confirmDeleteRoom.phong_id);
              setConfirmDeleteRoom(null);
            }}
          />
        </DialogFooter>
      </Dialog>
    </VStack>
  );
}
