use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Phong {
    pub phong_id: i64,
    pub ten_phong: String,
    pub tien_gio: f64,
    pub trang_thai: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NhomSanPham {
    pub nhom_san_pham_id: i64,
    pub nhom_san_pham_cha_id: Option<i64>,
    pub ten_nhom: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SanPham {
    pub san_pham_id: String,
    pub nhom_san_pham_id: Option<i64>,
    pub ten_san_pham: String,
    pub don_vi_tinh: String,
    pub don_gia: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LichSuPhong {
    pub lich_su_phong_id: i64,
    pub phong_id: i64,
    pub gio_bat_dau: String,
    pub gio_ket_thuc: Option<String>,
    pub tien_gio: f64,
    pub tong_tien_san_pham: f64,
    pub tong_tien_gio: f64,
    pub tong_tien_thanh_toan: f64,
    pub trang_thai: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LichSuPhongSanPham {
    pub lich_su_phong_san_pham_id: i64,
    pub lich_su_phong_id: i64,
    pub san_pham_id: String,
    pub so_luong: i64,
    pub don_gia: f64,
}
