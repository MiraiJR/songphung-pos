import { useEffect, useMemo, useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Dialog, DialogBody, DialogHeader } from "@/components/AppDialog";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { ScrollableArea } from "@astryxdesign/core/ScrollableArea";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ROOM_STATUS_LABEL } from "@/types/karaoke";
import type { CurrentSession, OrderItem, Product, ProductGroup, Room } from "@/types/karaoke";
import { formatDateTime } from "@/utils/formatDateTime";

function parseLocalDateTime(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
}

function formatElapsed(startRaw: string, now: number): string {
  const start = parseLocalDateTime(startRaw);
  if (!start) return "--";
  const minutes = Math.max(0, Math.floor((now - start.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours <= 0 ? `${rest} phút` : `${hours} giờ ${rest} phút`;
}

function roomRunningTotal(room: Room, now: number): number | null {
  if (room.trang_thai !== "DANG_HOAT_DONG" || !room.gio_bat_dau) return null;
  const start = parseLocalDateTime(room.gio_bat_dau);
  if (!start) return null;
  const minutes = Math.max(0, Math.floor((now - start.getTime()) / 60000));
  const hourFee = Math.ceil((minutes * room.tien_gio) / 60);
  return hourFee + Math.ceil(room.tong_tien_san_pham ?? 0);
}

function RoomTile({ room, now }: { room: Room; now: number }) {
  const running = roomRunningTotal(room, now);
  return (
    <VStack gap={0.5}>
      <HStack hAlign="between" vAlign="center">
        <Text weight="semibold">{room.ten_phong}</Text>
        <Text size="2xs" color="secondary">
          {ROOM_STATUS_LABEL[room.trang_thai]}
        </Text>
      </HStack>
      {room.trang_thai === "DANG_HOAT_DONG" && room.gio_bat_dau ? (
        <>
          <Text size="sm">{formatElapsed(room.gio_bat_dau, now)}</Text>
          <Text weight="bold" hasTabularNumbers>
            {(running ?? 0).toLocaleString("vi-VN")}
          </Text>
        </>
      ) : (
        <Text size="sm" color="secondary">
          {Math.ceil(room.tien_gio).toLocaleString("vi-VN")} đ/giờ
        </Text>
      )}
    </VStack>
  );
}

type Props = {
  rooms: Room[];
  groups: ProductGroup[];
  products: Product[];
  selectedRoomId: number | null;
  selectedRoom: Room | null;
  currentSession: CurrentSession | null;
  onSelectRoom: (roomId: number) => void;
  onStartRoom: (roomId: number) => void | Promise<void>;
  onAddProduct: (product: Product) => void | Promise<void>;
  onAdjustItemQty: (item: OrderItem, delta: number) => void;
  onEditItem: (item: OrderItem) => void;
  onRefreshRooms: () => void | Promise<void>;
  onCancelRoom: () => void;
  onCheckout: () => void;
  onTransferRoom: (targetRoomId: number) => Promise<void>;
  onPrintTemporaryBill: () => Promise<void>;
  printTemporaryBillLoading?: boolean;
  checkoutLoading?: boolean;
  cancelLoading?: boolean;
};

export function PosPage(props: Props) {
  const {
    rooms,
    groups,
    products,
    selectedRoomId,
    selectedRoom,
    currentSession,
    onSelectRoom,
    onStartRoom,
    onAddProduct,
    onAdjustItemQty,
    onEditItem,
    onRefreshRooms,
    onCancelRoom,
    onCheckout,
    onTransferRoom,
    onPrintTemporaryBill,
    printTemporaryBillLoading = false,
    checkoutLoading = false,
    cancelLoading = false,
  } = props;
  const actionBusy = printTemporaryBillLoading || checkoutLoading || cancelLoading;
  const [keyword, setKeyword] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string>("ALL");
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [startingRoom, setStartingRoom] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void onRefreshRooms();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [onRefreshRooms]);

  const groupTabs = useMemo(() => {
    const base = groups
      .map((group) => ({
        id: String(group.nhom_san_pham_id),
        name: group.ten_nhom,
      }))
      .filter((group) => products.some((product) => String(product.nhom_san_pham_id) === group.id));

    if (products.some((product) => product.nhom_san_pham_id === null)) {
      base.push({ id: "NULL", name: "Khác" });
    }
    return [{ id: "ALL", name: "Tất cả" }, ...base];
  }, [groups, products]);

  const filteredProducts = useMemo(() => {
    const byKeyword = products.filter((product) =>
      product.ten_san_pham.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (activeGroupId === "ALL") return byKeyword;
    if (activeGroupId === "NULL") return byKeyword.filter((product) => product.nhom_san_pham_id === null);
    return byKeyword.filter((product) => String(product.nhom_san_pham_id) === activeGroupId);
  }, [products, keyword, activeGroupId]);

  const totalMinutes = useMemo(() => {
    if (!selectedRoom || !currentSession || selectedRoom.tien_gio <= 0) return 0;
    const hours = (currentSession.tong_tien_gio ?? 0) / selectedRoom.tien_gio;
    return Math.max(0, Math.round(hours * 60));
  }, [selectedRoom, currentSession]);
  const totalHoursPart = Math.floor(totalMinutes / 60);
  const totalMinutesPart = totalMinutes % 60;
  const totalDurationLabel =
    totalHoursPart <= 0 ? `${totalMinutesPart} phút` : `${totalHoursPart} giờ ${totalMinutesPart} phút`;
  const tongTienMonDisplay = Math.max(0, Math.ceil(currentSession?.tong_tien_san_pham ?? 0));
  const tongTienGioDisplay = Math.max(0, Math.ceil(currentSession?.tong_tien_gio ?? 0));
  const tongCongDisplay = Math.max(0, Math.ceil(currentSession?.tong_tien_thanh_toan ?? 0));

  const emptyRoomsForTransfer = useMemo(
    () => rooms.filter((r) => r.trang_thai === "TRONG" && r.phong_id !== selectedRoomId),
    [rooms, selectedRoomId],
  );

  // Keep CSS grid for the 3-column POS frame (proven stable). Astryx for chrome inside.
  return (
    <section className="grid h-[calc(100vh-64px)] grid-cols-[minmax(0,7fr)_minmax(0,9fr)_minmax(0,4fr)] gap-3 overflow-hidden bg-[var(--color-background-wash,#f4f7f9)] p-3">
      <div className="min-h-0 min-w-0 overflow-hidden">
        <Card elevation="low" padding={0} height="100%">
          <VStack height="100%">
            <VStack padding={3} gap={1}>
              <HStack hAlign="between" vAlign="start">
                <Heading level={2}>{selectedRoom ? selectedRoom.ten_phong : "--"}</Heading>
                <Text size="2xs" color="secondary">
                  Bắt đầu: {formatDateTime(currentSession?.gio_bat_dau)}
                </Text>
              </HStack>
              {selectedRoom && (
                <Badge
                  variant={selectedRoom.trang_thai === "TRONG" ? "warning" : "success"}
                  label={ROOM_STATUS_LABEL[selectedRoom.trang_thai]}
                />
              )}
            </VStack>
            <Divider />

            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollableArea label="Món đã gọi" height="100%" padding={3}>
                <VStack gap={2}>
                  {currentSession && currentSession.items.length === 0 ? (
                    <Text color="secondary">Chưa gọi món. Bấm món bên phải để thêm một.</Text>
                  ) : null}
                  {currentSession?.items.map((item) => (
                    <HStack key={item.lich_su_phong_san_pham_id} gap={2} vAlign="center" width="100%" style={{ minWidth: 0 }}>
                      <StackItem size="fill" style={{ minWidth: 0 }}>
                        <Text weight="medium" maxLines={1}>
                          {item.ten_san_pham}
                        </Text>
                      </StackItem>
                      <HStack gap={1} vAlign="center" width={148} hAlign="end">
                        <Button
                          label="−"
                          size="sm"
                          variant="secondary"
                          width={36}
                          onClick={() => onAdjustItemQty(item, -1)}
                        />
                        <Button
                          label={String(item.so_luong)}
                          size="sm"
                          variant="ghost"
                          width={56}
                          onClick={() => onEditItem(item)}
                        />
                        <Button
                          label="+"
                          size="sm"
                          variant="secondary"
                          width={36}
                          onClick={() => onAdjustItemQty(item, 1)}
                        />
                      </HStack>
                      <VStack width={128} hAlign="end">
                        <Text weight="semibold" hasTabularNumbers>
                          {Math.round(item.thanh_tien).toLocaleString("vi-VN")}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}
                </VStack>
              </ScrollableArea>
            </div>

            {selectedRoom?.trang_thai === "TRONG" && (
              <>
                <Divider />
                <VStack padding={3}>
                  <Button
                    label="Mở phòng"
                    variant="primary"
                    size="lg"
                    width="100%"
                    isLoading={startingRoom}
                    onClick={() => {
                      setStartingRoom(true);
                      void Promise.resolve(onStartRoom(selectedRoom.phong_id)).finally(() => setStartingRoom(false));
                    }}
                  />
                </VStack>
              </>
            )}

            {selectedRoom?.trang_thai === "DANG_HOAT_DONG" && (
              <>
                <Divider />
                <VStack padding={3} gap={2}>
                  <VStack gap={0.5}>
                    <HStack hAlign="between">
                      <Text color="secondary" size="sm">
                        Tổng giờ
                      </Text>
                      <Text weight="semibold" size="sm">
                        {totalDurationLabel}
                      </Text>
                    </HStack>
                    <HStack hAlign="between">
                      <Text color="secondary" size="sm">
                        Tiền món
                      </Text>
                      <Text weight="semibold" size="sm" hasTabularNumbers>
                        {tongTienMonDisplay.toLocaleString()}
                      </Text>
                    </HStack>
                    <HStack hAlign="between">
                      <Text color="secondary" size="sm">
                        Tiền giờ
                      </Text>
                      <Text weight="semibold" size="sm" hasTabularNumbers>
                        {tongTienGioDisplay.toLocaleString()}
                      </Text>
                    </HStack>
                  </VStack>
                  <HStack hAlign="between" vAlign="end" width="100%" style={{ minWidth: 0 }}>
                    <Text weight="bold">Tổng cộng</Text>
                    <Text
                      type="display-3"
                      weight="bold"
                      color="accent"
                      hasTabularNumbers
                      style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {tongCongDisplay.toLocaleString()}
                    </Text>
                  </HStack>

                  {currentSession ? (
                    <VStack gap={1}>
                      <Button
                        label="Thanh toán"
                        variant="secondary"
                        className="btn-pay"
                        size="lg"
                        width="100%"
                        isLoading={checkoutLoading}
                        isDisabled={actionBusy}
                        onClick={onCheckout}
                      />
                      <HStack gap={1}>
                        <Button
                          label="In phiếu"
                          variant="secondary"
                          width="100%"
                          isLoading={printTemporaryBillLoading}
                          isDisabled={actionBusy}
                          onClick={() => void onPrintTemporaryBill()}
                        />
                        <Button
                          label="Trả phòng"
                          variant="destructive"
                          width="100%"
                          isLoading={cancelLoading}
                          isDisabled={actionBusy}
                          onClick={onCancelRoom}
                        />
                      </HStack>
                      <Button
                        label="Chuyển phòng"
                        variant="ghost"
                        width="100%"
                        isDisabled={actionBusy}
                        onClick={() => setTransferModalOpen(true)}
                      />
                    </VStack>
                  ) : (
                    <Text color="secondary">Đang tải phiên phòng...</Text>
                  )}
                </VStack>
              </>
            )}
          </VStack>
        </Card>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
        <Card elevation="low" padding={3}>
          <VStack gap={2}>
            <TextInput
              label="Tìm kiếm món"
              isLabelHidden
              type="search"
              value={keyword}
              onChange={setKeyword}
              placeholder="Tìm kiếm món..."
              startIcon="search"
              hasClear
              width="100%"
            />
            <TabList value={activeGroupId} onChange={setActiveGroupId} size="sm" overflow="scroll">
              {groupTabs.map((tab) => (
                <Tab key={tab.id} value={tab.id} label={tab.name} />
              ))}
            </TabList>
          </VStack>
        </Card>

        <div className="min-h-0 flex-1">
          <Card elevation="low" padding={0} height="100%">
            <ScrollableArea label="Danh sách sản phẩm" height="100%" padding={3}>
              {filteredProducts.length === 0 ? (
                <EmptyState title="Không có món" description="Thử đổi nhóm hoặc từ khóa tìm kiếm." isCompact />
              ) : (
                <div className="pos-no-select grid grid-cols-3 gap-2">
                  {filteredProducts.map((product) => (
                    <ClickableCard
                      key={product.san_pham_id}
                      label={product.ten_san_pham}
                      elevation="low"
                      padding={3}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onAddProduct(product)}
                    >
                      <VStack gap={2}>
                        <Text weight="semibold" maxLines={2}>
                          {product.ten_san_pham}
                        </Text>
                        <Text weight="bold" hasTabularNumbers>
                          {product.don_gia.toLocaleString()}
                        </Text>
                      </VStack>
                    </ClickableCard>
                  ))}
                </div>
              )}
            </ScrollableArea>
          </Card>
        </div>
      </div>

      <div className="min-h-0 min-w-0 overflow-hidden">
        <Card elevation="low" padding={0} height="100%">
          <VStack height="100%">
            <VStack padding={3} gap={0}>
              <Heading level={3}>Phòng ({rooms.length})</Heading>
            </VStack>
            <Divider />
            <ScrollableArea label="Danh sách phòng" height="100%" padding={3}>
              <VStack gap={2}>
                {rooms.map((room) => (
                  <ClickableCard
                    key={room.phong_id}
                    label={room.ten_phong}
                    elevation={selectedRoomId === room.phong_id ? "med" : "low"}
                    variant={room.trang_thai === "TRONG" ? "default" : "green"}
                    padding={3}
                    onClick={() => onSelectRoom(room.phong_id)}
                    onDoubleClick={() => {
                      if (room.trang_thai === "TRONG") void onStartRoom(room.phong_id);
                    }}
                  >
                    <RoomTile room={room} now={now} />
                  </ClickableCard>
                ))}
              </VStack>
            </ScrollableArea>
          </VStack>
        </Card>
      </div>

      <Dialog
        isOpen={transferModalOpen}
        onOpenChange={(next) => {
          if (!next && !transferSubmitting) setTransferModalOpen(false);
        }}
        width={420}
        purpose="form"
        padding={0}
      >
        <DialogHeader
          title="Chuyển phòng"
          subtitle={
            selectedRoom
              ? `Đang hát tại ${selectedRoom.ten_phong}. Bấm phòng trống để chuyển phiên và món.`
              : "Bấm phòng trống để chuyển phiên và món."
          }
          onOpenChange={(next) => {
            if (!next && !transferSubmitting) setTransferModalOpen(false);
          }}
        />
        <DialogBody>
          <VStack padding={4} gap={2}>
            {emptyRoomsForTransfer.length === 0 ? (
              <EmptyState
                title="Không còn phòng trống"
                description="Tất cả phòng khác đang hát."
                isCompact
              />
            ) : (
              <VStack gap={2}>
                {emptyRoomsForTransfer.map((room) => (
                  <ClickableCard
                    key={room.phong_id}
                    label={`Chuyển sang ${room.ten_phong}`}
                    elevation="low"
                    padding={3}
                    isDisabled={transferSubmitting}
                    onClick={() => {
                      if (transferSubmitting) return;
                      void (async () => {
                        setTransferSubmitting(true);
                        try {
                          await onTransferRoom(room.phong_id);
                          setTransferModalOpen(false);
                        } catch (err) {
                          window.alert(String(err));
                        } finally {
                          setTransferSubmitting(false);
                        }
                      })();
                    }}
                  >
                    <HStack hAlign="between" vAlign="center">
                      <Text weight="semibold">{room.ten_phong}</Text>
                      <Text color="secondary" hasTabularNumbers>
                        {Math.ceil(room.tien_gio).toLocaleString("vi-VN")} đ/giờ
                      </Text>
                    </HStack>
                  </ClickableCard>
                ))}
              </VStack>
            )}
          </VStack>
        </DialogBody>
      </Dialog>
    </section>
  );
}
