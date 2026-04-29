export type Page = "pos" | "rooms" | "products" | "history";

export type Room = {
  phong_id: number;
  ten_phong: string;
  tien_gio: number;
  trang_thai: "TRONG" | "DANG_HOAT_DONG";
};

export const ROOM_STATUS_LABEL: Record<Room["trang_thai"], string> = {
  TRONG: "Trống",
  DANG_HOAT_DONG: "Đang hoạt động",
};

export type ProductGroup = {
  nhom_san_pham_id: number;
  nhom_san_pham_cha_id: number | null;
  ten_nhom: string;
};

export type Product = {
  san_pham_id: string;
  nhom_san_pham_id: number | null;
  ten_san_pham: string;
  don_vi_tinh: string;
  don_gia: number;
};

export type OrderItem = {
  lich_su_phong_san_pham_id: number;
  lich_su_phong_id: number;
  san_pham_id: string;
  ten_san_pham: string;
  so_luong: number;
  don_gia: number;
  thanh_tien: number;
};

export type CurrentSession = {
  lich_su_phong_id: number;
  phong_id: number;
  ten_phong: string;
  tien_gio: number;
  gio_bat_dau: string;
  trang_thai: string;
  tong_tien_san_pham: number;
  tong_tien_gio: number;
  tong_tien_thanh_toan: number;
  items: OrderItem[];
};

export type PaidHistory = {
  lich_su_phong_id: number;
  phong_id: number;
  ten_phong: string;
  gio_bat_dau: string;
  gio_ket_thuc: string | null;
  tong_tien_san_pham: number;
  tong_tien_gio: number;
  tong_tien_thanh_toan: number;
};

export type HistoryOrderItem = {
  san_pham_id: string;
  ten_san_pham: string;
  so_luong: number;
  don_gia: number;
  thanh_tien: number;
};
