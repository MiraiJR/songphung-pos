use crate::database::DbState;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Room {
    pub phong_id: i64,
    pub ten_phong: String,
    pub tien_gio: f64,
    pub trang_thai: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProductGroup {
    pub nhom_san_pham_id: i64,
    pub nhom_san_pham_cha_id: Option<i64>,
    pub ten_nhom: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Product {
    pub san_pham_id: String,
    pub nhom_san_pham_id: Option<i64>,
    pub ten_san_pham: String,
    pub don_vi_tinh: String,
    pub don_gia: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OrderItem {
    pub lich_su_phong_san_pham_id: i64,
    pub lich_su_phong_id: i64,
    pub san_pham_id: String,
    pub ten_san_pham: String,
    pub so_luong: i64,
    pub don_gia: f64,
    pub thanh_tien: f64,
}

#[derive(Debug, Serialize)]
pub struct CurrentSession {
    pub lich_su_phong_id: i64,
    pub phong_id: i64,
    pub ten_phong: String,
    pub tien_gio: f64,
    pub gio_bat_dau: String,
    pub trang_thai: String,
    pub tong_tien_san_pham: f64,
    pub tong_tien_gio: f64,
    pub tong_tien_thanh_toan: f64,
    pub items: Vec<OrderItem>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PaidHistory {
    pub lich_su_phong_id: i64,
    pub phong_id: i64,
    pub ten_phong: String,
    pub gio_bat_dau: String,
    pub gio_ket_thuc: Option<String>,
    pub tong_tien_san_pham: f64,
    pub tong_tien_gio: f64,
    pub tong_tien_thanh_toan: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HistoryOrderItem {
    pub san_pham_id: String,
    pub ten_san_pham: String,
    pub so_luong: i64,
    pub don_gia: f64,
    pub thanh_tien: f64,
}

#[derive(Debug, Serialize)]
pub struct PrinterConnectionStatus {
    pub connected: bool,
    pub address: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomPayload {
    pub ten_phong: String,
    pub tien_gio: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoomPayload {
    pub phong_id: i64,
    pub ten_phong: String,
    pub tien_gio: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductGroupPayload {
    pub ten_nhom: String,
    pub nhom_san_pham_cha_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductGroupPayload {
    pub nhom_san_pham_id: i64,
    pub ten_nhom: String,
    pub nhom_san_pham_cha_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub san_pham_id: String,
    pub nhom_san_pham_id: Option<i64>,
    pub ten_san_pham: String,
    pub don_vi_tinh: String,
    pub don_gia: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub san_pham_id: String,
    pub nhom_san_pham_id: Option<i64>,
    pub ten_san_pham: String,
    pub don_vi_tinh: String,
    pub don_gia: f64,
}

#[derive(Debug, Deserialize)]
pub struct CheckoutPayload {
    pub history_id: i64,
    pub room_id: i64,
    pub final_amount: f64,
    pub print_receipt: bool,
    pub printer_name_or_ip: Option<String>,
}

#[tauri::command]
pub async fn health_check(state: tauri::State<'_, DbState>) -> Result<String, String> {
    sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(state.pool())
        .await
        .map_err(|error| format!("database health check failed: {error}"))?;

    Ok("ok".to_string())
}

#[tauri::command]
pub async fn seed_demo_data(state: tauri::State<'_, DbState>) -> Result<(), String> {
    let pool = state.pool();

    let room_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM phong")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if room_count == 0 {
        for name in ["P1", "P2", "P3", "VIP-1", "VIP-2"] {
            sqlx::query("INSERT INTO phong(ten_phong, tien_gio, trang_thai) VALUES (?, 180000, 'TRONG')")
                .bind(name)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    let group_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM nhom_san_pham")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if group_count == 0 {
        sqlx::query("INSERT INTO nhom_san_pham(ten_nhom) VALUES ('Bia')")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO nhom_san_pham(ten_nhom) VALUES ('Nước ngọt')")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO nhom_san_pham(ten_nhom) VALUES ('Đồ ăn')")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    let product_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM san_pham")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if product_count == 0 {
        sqlx::query(
            "INSERT INTO san_pham(san_pham_id, nhom_san_pham_id, ten_san_pham, don_vi_tinh, don_gia)
             SELECT 'BIA01', nhom_san_pham_id, 'Bia Tiger', 'lon', 25000 FROM nhom_san_pham WHERE ten_nhom='Bia' LIMIT 1",
        )
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
        sqlx::query(
            "INSERT INTO san_pham(san_pham_id, nhom_san_pham_id, ten_san_pham, don_vi_tinh, don_gia)
             SELECT 'NUOC01', nhom_san_pham_id, 'Coca Cola', 'lon', 18000 FROM nhom_san_pham WHERE ten_nhom='Nước ngọt' LIMIT 1",
        )
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
        sqlx::query(
            "INSERT INTO san_pham(san_pham_id, nhom_san_pham_id, ten_san_pham, don_vi_tinh, don_gia)
             SELECT 'SNACK01', nhom_san_pham_id, 'Khô gà', 'đĩa', 55000 FROM nhom_san_pham WHERE ten_nhom='Đồ ăn' LIMIT 1",
        )
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn list_rooms(state: tauri::State<'_, DbState>) -> Result<Vec<Room>, String> {
    sqlx::query_as::<_, Room>("SELECT phong_id, ten_phong, tien_gio, trang_thai FROM phong ORDER BY phong_id")
        .fetch_all(state.pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_room(
    state: tauri::State<'_, DbState>,
    payload: CreateRoomPayload,
) -> Result<(), String> {
    sqlx::query("INSERT INTO phong(ten_phong, tien_gio, trang_thai) VALUES (?, ?, 'TRONG')")
        .bind(payload.ten_phong)
        .bind(payload.tien_gio)
        .execute(state.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_room(
    state: tauri::State<'_, DbState>,
    payload: UpdateRoomPayload,
) -> Result<(), String> {
    sqlx::query("UPDATE phong SET ten_phong = ?, tien_gio = ? WHERE phong_id = ?")
        .bind(payload.ten_phong)
        .bind(payload.tien_gio)
        .bind(payload.phong_id)
        .execute(state.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_room(state: tauri::State<'_, DbState>, room_id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM phong WHERE phong_id = ?")
        .bind(room_id)
        .execute(state.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_product_groups(state: tauri::State<'_, DbState>) -> Result<Vec<ProductGroup>, String> {
    sqlx::query_as::<_, ProductGroup>(
        "SELECT nhom_san_pham_id, nhom_san_pham_cha_id, ten_nhom FROM nhom_san_pham ORDER BY ten_nhom",
    )
    .fetch_all(state.pool())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_product_group(
    state: tauri::State<'_, DbState>,
    payload: CreateProductGroupPayload,
) -> Result<(), String> {
    sqlx::query("INSERT INTO nhom_san_pham(ten_nhom, nhom_san_pham_cha_id) VALUES (?, ?)")
        .bind(payload.ten_nhom)
        .bind(payload.nhom_san_pham_cha_id)
        .execute(state.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_product_group(
    state: tauri::State<'_, DbState>,
    payload: UpdateProductGroupPayload,
) -> Result<(), String> {
    if payload.nhom_san_pham_cha_id == Some(payload.nhom_san_pham_id) {
        return Err("Nhóm cha không thể trùng chính nó".to_string());
    }
    sqlx::query(
        "UPDATE nhom_san_pham SET ten_nhom = ?, nhom_san_pham_cha_id = ? WHERE nhom_san_pham_id = ?",
    )
    .bind(payload.ten_nhom)
    .bind(payload.nhom_san_pham_cha_id)
    .bind(payload.nhom_san_pham_id)
    .execute(state.pool())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_product_group(
    state: tauri::State<'_, DbState>,
    nhom_san_pham_id: i64,
) -> Result<(), String> {
    let pool = state.pool();
    let product_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM san_pham WHERE nhom_san_pham_id = ?")
            .bind(nhom_san_pham_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    if product_count > 0 {
        return Err("Không thể xóa nhóm đang có sản phẩm".to_string());
    }

    let child_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM nhom_san_pham WHERE nhom_san_pham_cha_id = ?",
    )
    .bind(nhom_san_pham_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if child_count > 0 {
        return Err("Không thể xóa nhóm đang có nhóm con".to_string());
    }

    sqlx::query("DELETE FROM nhom_san_pham WHERE nhom_san_pham_id = ?")
        .bind(nhom_san_pham_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_products(state: tauri::State<'_, DbState>) -> Result<Vec<Product>, String> {
    sqlx::query_as::<_, Product>(
        "SELECT san_pham_id, nhom_san_pham_id, ten_san_pham, don_vi_tinh, don_gia FROM san_pham ORDER BY ten_san_pham",
    )
    .fetch_all(state.pool())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_product(
    state: tauri::State<'_, DbState>,
    payload: CreateProductPayload,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO san_pham(san_pham_id, nhom_san_pham_id, ten_san_pham, don_vi_tinh, don_gia) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(payload.san_pham_id)
    .bind(payload.nhom_san_pham_id)
    .bind(payload.ten_san_pham)
    .bind(payload.don_vi_tinh)
    .bind(payload.don_gia)
    .execute(state.pool())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_product(
    state: tauri::State<'_, DbState>,
    payload: UpdateProductPayload,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE san_pham SET nhom_san_pham_id = ?, ten_san_pham = ?, don_vi_tinh = ?, don_gia = ? WHERE san_pham_id = ?",
    )
    .bind(payload.nhom_san_pham_id)
    .bind(payload.ten_san_pham)
    .bind(payload.don_vi_tinh)
    .bind(payload.don_gia)
    .bind(payload.san_pham_id)
    .execute(state.pool())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_product(state: tauri::State<'_, DbState>, product_id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM san_pham WHERE san_pham_id = ?")
        .bind(product_id)
        .execute(state.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_room(state: tauri::State<'_, DbState>, room_id: i64) -> Result<i64, String> {
    let pool = state.pool();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let room = sqlx::query("SELECT tien_gio, trang_thai FROM phong WHERE phong_id = ?")
        .bind(room_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let tien_gio: f64 = room.try_get("tien_gio").map_err(|e| e.to_string())?;
    let status: String = room.try_get("trang_thai").map_err(|e| e.to_string())?;
    if status != "TRONG" {
        return Err("Phòng đang hoạt động".to_string());
    }

    sqlx::query("UPDATE phong SET trang_thai = 'DANG_HOAT_DONG' WHERE phong_id = ?")
        .bind(room_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    let result = sqlx::query(
        "INSERT INTO lich_su_phong(phong_id, gio_bat_dau, tien_gio, trang_thai) VALUES (?, CURRENT_TIMESTAMP, ?, 'DANG_PHUC_VU')",
    )
    .bind(room_id)
    .bind(tien_gio)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_rowid())
}

#[tauri::command]
pub async fn get_active_history_id(state: tauri::State<'_, DbState>, room_id: i64) -> Result<Option<i64>, String> {
    sqlx::query_scalar::<_, i64>(
        "SELECT lich_su_phong_id
         FROM lich_su_phong
         WHERE phong_id = ? AND trang_thai = 'DANG_PHUC_VU'
         ORDER BY lich_su_phong_id DESC
         LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(state.pool())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_or_update_order_item(
    state: tauri::State<'_, DbState>,
    history_id: i64,
    product_id: String,
    qty: i64,
    price: f64,
) -> Result<(), String> {
    if qty <= 0 {
        return Err("Số lượng phải lớn hơn 0".to_string());
    }
    sqlx::query(
        "INSERT INTO lich_su_phong_san_pham(lich_su_phong_id, san_pham_id, so_luong, don_gia)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(lich_su_phong_id, san_pham_id)
         DO UPDATE SET so_luong = excluded.so_luong, don_gia = excluded.don_gia",
    )
    .bind(history_id)
    .bind(product_id)
    .bind(qty)
    .bind(price)
    .execute(state.pool())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_order_item(
    state: tauri::State<'_, DbState>,
    history_id: i64,
    product_id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM lich_su_phong_san_pham WHERE lich_su_phong_id = ? AND san_pham_id = ?")
        .bind(history_id)
        .bind(product_id)
        .execute(state.pool())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn cancel_room(
    state: tauri::State<'_, DbState>,
    history_id: i64,
    room_id: i64,
) -> Result<(), String> {
    let pool = state.pool();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let active_history_id = sqlx::query_scalar::<_, i64>(
        "SELECT lich_su_phong_id
         FROM lich_su_phong
         WHERE phong_id = ? AND trang_thai = 'DANG_PHUC_VU'
         ORDER BY lich_su_phong_id DESC
         LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let target_history_id = match active_history_id {
        Some(active_id) if history_id <= 0 || history_id != active_id => active_id,
        Some(_) => history_id,
        None => return Err("Phòng này không có phiên đang phục vụ để trả phòng".to_string()),
    };

    sqlx::query("DELETE FROM lich_su_phong_san_pham WHERE lich_su_phong_id = ?")
        .bind(target_history_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    let deleted = sqlx::query("DELETE FROM lich_su_phong WHERE lich_su_phong_id = ?")
        .bind(target_history_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    if deleted.rows_affected() == 0 {
        return Err("Không thể hủy hóa đơn phòng hiện tại".to_string());
    }

    sqlx::query("UPDATE phong SET trang_thai = 'TRONG' WHERE phong_id = ?")
        .bind(room_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn checkout_room(
    state: tauri::State<'_, DbState>,
    payload: CheckoutPayload,
) -> Result<(), String> {
    let pool = state.pool();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT CAST((julianday(CURRENT_TIMESTAMP) - julianday(gio_bat_dau)) * 24 * 60 AS INTEGER) AS total_minutes, tien_gio
         FROM lich_su_phong
         WHERE lich_su_phong_id = ?",
    )
    .bind(payload.history_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    let total_minutes: i64 = row.try_get("total_minutes").map_err(|e| e.to_string())?;
    let tien_gio: f64 = row.try_get("tien_gio").map_err(|e| e.to_string())?;
    let tong_tien_gio = ((total_minutes as f64 * tien_gio) / 60.0).ceil();

    let tong_tien_san_pham: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(so_luong * don_gia), 0) FROM lich_su_phong_san_pham WHERE lich_su_phong_id = ?",
    )
    .bind(payload.history_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE lich_su_phong
         SET gio_ket_thuc = CURRENT_TIMESTAMP,
             tong_tien_san_pham = ?,
             tong_tien_gio = ?,
             tong_tien_thanh_toan = ?,
             trang_thai = 'DA_THANH_TOAN'
         WHERE lich_su_phong_id = ?",
    )
    .bind(tong_tien_san_pham)
    .bind(tong_tien_gio)
    .bind(payload.final_amount)
    .bind(payload.history_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE phong SET trang_thai = 'TRONG' WHERE phong_id = ?")
        .bind(payload.room_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    if payload.print_receipt {
        let preview = crate::printer::render_receipt_preview();
        let target = payload
            .printer_name_or_ip
            .clone()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| std::env::var("PRINTER_ADDR").unwrap_or_else(|_| "127.0.0.1:9100".to_string()));
        let _ = crate::printer::print_receipt_to_target(&target, &preview);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_current_session(
    state: tauri::State<'_, DbState>,
    room_id: i64,
) -> Result<Option<CurrentSession>, String> {
    let pool = state.pool();
    let session_row = sqlx::query(
        "SELECT lsp.lich_su_phong_id, lsp.phong_id, p.ten_phong, lsp.tien_gio, lsp.gio_bat_dau,
                lsp.trang_thai, lsp.tong_tien_san_pham, lsp.tong_tien_gio, lsp.tong_tien_thanh_toan
         FROM lich_su_phong lsp
         JOIN phong p ON p.phong_id = lsp.phong_id
         WHERE lsp.phong_id = ? AND lsp.trang_thai = 'DANG_PHUC_VU'
         ORDER BY lsp.lich_su_phong_id DESC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(row) = session_row else {
        return Ok(None);
    };

    let history_id: i64 = row.try_get("lich_su_phong_id").map_err(|e| e.to_string())?;
    let items = sqlx::query_as::<_, OrderItem>(
        "SELECT ct.lich_su_phong_san_pham_id, ct.lich_su_phong_id, ct.san_pham_id, sp.ten_san_pham,
                ct.so_luong, ct.don_gia, (ct.so_luong * ct.don_gia) AS thanh_tien
         FROM lich_su_phong_san_pham ct
         JOIN san_pham sp ON sp.san_pham_id = ct.san_pham_id
         WHERE ct.lich_su_phong_id = ?
         ORDER BY sp.ten_san_pham",
    )
    .bind(history_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let tong_tien_san_pham = items.iter().map(|item| item.thanh_tien).sum::<f64>();
    let minutes: i64 = sqlx::query_scalar(
        "SELECT CAST((julianday(CURRENT_TIMESTAMP) - julianday(gio_bat_dau)) * 24 * 60 AS INTEGER)
         FROM lich_su_phong WHERE lich_su_phong_id = ?",
    )
    .bind(history_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    let tien_gio: f64 = row.try_get("tien_gio").map_err(|e| e.to_string())?;
    let tong_tien_gio = ((minutes as f64 * tien_gio) / 60.0).ceil();

    Ok(Some(CurrentSession {
        lich_su_phong_id: history_id,
        phong_id: row.try_get("phong_id").map_err(|e| e.to_string())?,
        ten_phong: row.try_get("ten_phong").map_err(|e| e.to_string())?,
        tien_gio,
        gio_bat_dau: row.try_get("gio_bat_dau").map_err(|e| e.to_string())?,
        trang_thai: row.try_get("trang_thai").map_err(|e| e.to_string())?,
        tong_tien_san_pham,
        tong_tien_gio,
        tong_tien_thanh_toan: tong_tien_san_pham + tong_tien_gio,
        items,
    }))
}

#[tauri::command]
pub async fn list_paid_history(
    state: tauri::State<'_, DbState>,
    date: Option<String>,
) -> Result<Vec<PaidHistory>, String> {
    let pool = state.pool();
    if let Some(day) = date {
        sqlx::query_as::<_, PaidHistory>(
            "SELECT lsp.lich_su_phong_id, lsp.phong_id, p.ten_phong, lsp.gio_bat_dau, lsp.gio_ket_thuc,
                    lsp.tong_tien_san_pham, lsp.tong_tien_gio, lsp.tong_tien_thanh_toan
             FROM lich_su_phong lsp
             JOIN phong p ON p.phong_id = lsp.phong_id
             WHERE lsp.trang_thai = 'DA_THANH_TOAN' AND date(lsp.gio_ket_thuc) = date(?)
             ORDER BY lsp.gio_ket_thuc DESC",
        )
        .bind(day)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
    } else {
        sqlx::query_as::<_, PaidHistory>(
            "SELECT lsp.lich_su_phong_id, lsp.phong_id, p.ten_phong, lsp.gio_bat_dau, lsp.gio_ket_thuc,
                    lsp.tong_tien_san_pham, lsp.tong_tien_gio, lsp.tong_tien_thanh_toan
             FROM lich_su_phong lsp
             JOIN phong p ON p.phong_id = lsp.phong_id
             WHERE lsp.trang_thai = 'DA_THANH_TOAN'
             ORDER BY lsp.gio_ket_thuc DESC",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_history_order_items(
    state: tauri::State<'_, DbState>,
    history_id: i64,
) -> Result<Vec<HistoryOrderItem>, String> {
    sqlx::query_as::<_, HistoryOrderItem>(
        "SELECT ct.san_pham_id, sp.ten_san_pham, ct.so_luong, ct.don_gia, (ct.so_luong * ct.don_gia) AS thanh_tien
         FROM lich_su_phong_san_pham ct
         JOIN san_pham sp ON sp.san_pham_id = ct.san_pham_id
         WHERE ct.lich_su_phong_id = ?
         ORDER BY sp.ten_san_pham",
    )
    .bind(history_id)
    .fetch_all(state.pool())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_printer_connection(
    printer_addr: Option<String>,
) -> Result<PrinterConnectionStatus, String> {
    let address = printer_addr
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| std::env::var("PRINTER_ADDR").unwrap_or_else(|_| "127.0.0.1:9100".to_string()));

    match crate::printer::check_printer_target_connection(&address) {
        Ok(_) => Ok(PrinterConnectionStatus {
            connected: true,
            address: address.clone(),
            message: format!("Đã kết nối máy in tại {address}"),
        }),
        Err(error) => Ok(PrinterConnectionStatus {
            connected: false,
            address: address.clone(),
            message: format!("{error}. Bạn có thể bỏ chọn 'In hóa đơn' để tiếp tục thanh toán."),
        }),
    }
}

#[tauri::command]
pub async fn get_system_printers() -> Result<Vec<String>, String> {
    crate::printer::list_system_printers()
}

#[tauri::command]
pub async fn test_printer(printer_name_or_ip: String) -> Result<String, String> {
    let target = printer_name_or_ip.trim();
    if target.is_empty() {
        return Err("Vui lòng chọn hoặc nhập máy in trước khi kiểm tra.".to_string());
    }
    crate::printer::check_printer_target_connection(target)?;
    let content = "TEST KET NOI MAY IN SONG PHUNG... OK\n\x1b@\x07";
    crate::printer::print_receipt_to_target(target, content)?;
    Ok(format!("Đã kiểm tra thành công máy in: {target}"))
}

#[tauri::command]
pub async fn reprint_history_bill(
    state: tauri::State<'_, DbState>,
    history_id: i64,
    printer_addr: Option<String>,
) -> Result<String, String> {
    let pool = state.pool();
    let address = printer_addr
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| std::env::var("PRINTER_ADDR").unwrap_or_else(|_| "127.0.0.1:9100".to_string()));

    crate::printer::check_printer_target_connection(&address)?;

    let bill = sqlx::query(
        "SELECT lsp.lich_su_phong_id, p.ten_phong, lsp.gio_bat_dau, lsp.gio_ket_thuc,
                lsp.tong_tien_san_pham, lsp.tong_tien_gio, lsp.tong_tien_thanh_toan
         FROM lich_su_phong lsp
         JOIN phong p ON p.phong_id = lsp.phong_id
         WHERE lsp.lich_su_phong_id = ? AND lsp.trang_thai = 'DA_THANH_TOAN'",
    )
    .bind(history_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(bill) = bill else {
        return Err("Không tìm thấy hóa đơn đã thanh toán để in lại.".to_string());
    };

    let items = sqlx::query_as::<_, HistoryOrderItem>(
        "SELECT ct.san_pham_id, sp.ten_san_pham, ct.so_luong, ct.don_gia, (ct.so_luong * ct.don_gia) AS thanh_tien
         FROM lich_su_phong_san_pham ct
         JOIN san_pham sp ON sp.san_pham_id = ct.san_pham_id
         WHERE ct.lich_su_phong_id = ?
         ORDER BY sp.ten_san_pham",
    )
    .bind(history_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut content = String::new();
    content.push_str("SONG PHUNG KARAOKE\n");
    content.push_str("Dia chi: Song Phung\n");
    content.push_str("------------------------------\n");
    content.push_str(&format!(
        "Phong: {}\n",
        bill.try_get::<String, _>("ten_phong").map_err(|e| e.to_string())?
    ));
    content.push_str(&format!(
        "Gio vao: {}\n",
        bill.try_get::<String, _>("gio_bat_dau").map_err(|e| e.to_string())?
    ));
    content.push_str(&format!(
        "Gio ra: {}\n",
        bill.try_get::<Option<String>, _>("gio_ket_thuc")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "--".to_string())
    ));
    content.push_str("------------------------------\n");
    for item in items {
        content.push_str(&format!(
            "{} | {} x {} = {}\n",
            item.ten_san_pham,
            item.so_luong,
            item.don_gia as i64,
            item.thanh_tien as i64
        ));
    }
    content.push_str("------------------------------\n");
    content.push_str(&format!(
        "Tien mon: {}\n",
        bill.try_get::<f64, _>("tong_tien_san_pham").map_err(|e| e.to_string())? as i64
    ));
    content.push_str(&format!(
        "Tien gio: {}\n",
        bill.try_get::<f64, _>("tong_tien_gio").map_err(|e| e.to_string())? as i64
    ));
    content.push_str(&format!(
        "Tong cong: {}\n",
        bill.try_get::<f64, _>("tong_tien_thanh_toan").map_err(|e| e.to_string())? as i64
    ));
    content.push_str("Cam on quy khach!\n");

    crate::printer::print_receipt_to_target(&address, &content)?;
    Ok(format!("Đã in lại hóa đơn #{history_id}"))
}
