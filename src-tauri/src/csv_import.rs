//! Import/Export CSV cho nhóm sản phẩm & sản phẩm (upsert, transaction).

use crate::database::DbState;
use csv::ReaderBuilder;
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashSet;
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Serialize, Clone)]
pub struct CsvImportStats {
    pub message: String,
    pub total_rows: u32,
    pub inserted: u32,
    pub updated: u32,
}

fn summary_message(total: u32, ins: u32, upd: u32) -> String {
    format!("Đã xử lý xong {total} dòng ({ins} dòng mới, {upd} dòng cập nhật)")
}

const TEMPLATE_NHOM: &str = "nhom_san_pham_id,ten_nhom,nhom_san_pham_cha_id\n1,\"Ví dụ: Đồ uống\",\n";
const TEMPLATE_SAN_PHAM: &str =
    "san_pham_id,ten_san_pham,nhom_san_pham_id,don_vi_tinh,don_gia\nBIA01,\"Bia ví dụ\",1,lon,25000\n";

fn resolve_templates_dir(dir_path: &str) -> Result<std::path::PathBuf, String> {
    let dir = dir_path.trim();
    if dir.is_empty() {
        return Err("Thư mục không hợp lệ.".to_string());
    }
    let base = Path::new(dir);
    if !base.is_dir() {
        return Err("Đường dẫn không phải thư mục hoặc không tồn tại.".to_string());
    }
    Ok(base.to_path_buf())
}

/// Chỉ file mẫu nhóm — dùng trang quản lý nhóm sản phẩm.
#[tauri::command]
pub fn export_nhom_san_pham_template(dir_path: String) -> Result<(), String> {
    let base = resolve_templates_dir(&dir_path)?;
    std::fs::write(base.join("nhom_san_pham.csv"), TEMPLATE_NHOM)
        .map_err(|e| format!("Không ghi nhom_san_pham.csv: {e}"))
}

/// Chỉ file mẫu sản phẩm — dùng trang quản lý sản phẩm.
#[tauri::command]
pub fn export_san_pham_template(dir_path: String) -> Result<(), String> {
    let base = resolve_templates_dir(&dir_path)?;
    std::fs::write(base.join("san_pham.csv"), TEMPLATE_SAN_PHAM)
        .map_err(|e| format!("Không ghi san_pham.csv: {e}"))
}

#[tauri::command]
pub fn export_csv_templates(dir_path: String) -> Result<(), String> {
    export_nhom_san_pham_template(dir_path.clone())?;
    export_san_pham_template(dir_path)
}

fn header_indices(headers: &csv::StringRecord) -> Result<std::collections::HashMap<String, usize>, String> {
    let mut m = std::collections::HashMap::new();
    for (i, h) in headers.iter().enumerate() {
        let key = h.trim().to_lowercase();
        if !key.is_empty() {
            m.insert(key, i);
        }
    }
    Ok(m)
}

fn get_field<'a>(rec: &'a csv::StringRecord, map: &std::collections::HashMap<String, usize>, col: &str) -> Option<&'a str> {
    map.get(&col.to_lowercase()).and_then(|&i| rec.get(i))
}

fn parse_opt_i64_cell(s: &str) -> Result<Option<i64>, String> {
    let t = s.trim();
    if t.is_empty() {
        return Ok(None);
    }
    t.parse::<i64>()
        .map(Some)
        .map_err(|_| format!("Giá trị không phải số nguyên hợp lệ: '{t}'"))
}

#[tauri::command]
pub async fn import_categories_csv(
    state: tauri::State<'_, DbState>,
    file_path: String,
) -> Result<CsvImportStats, String> {
    let path = file_path.trim();
    if path.is_empty() {
        return Err("Chưa chọn file.".to_string());
    }
    let content = std::fs::read_to_string(path).map_err(|e| format!("Không đọc được file: {e}"))?;
    do_import_categories(state.pool(), &content).await
}

async fn do_import_categories(pool: &SqlitePool, content: &str) -> Result<CsvImportStats, String> {
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(content.as_bytes());
    let headers = rdr
        .headers()
        .map_err(|e| format!("CSV không hợp lệ: {e}"))?
        .clone();
    let col = header_indices(&headers)?;
    for required in ["ten_nhom"] {
        if !col.contains_key(required) {
            return Err(format!("Thiếu cột bắt buộc: {required}"));
        }
    }

    let db_ids: HashSet<i64> = sqlx::query_scalar::<_, i64>("SELECT nhom_san_pham_id FROM nhom_san_pham")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .collect();

    let mut rows: Vec<(usize, Option<i64>, String, Option<i64>)> = Vec::new();
    let mut line_no = 1_u32;
    for result in rdr.records() {
        line_no += 1;
        let rec = result.map_err(|e| format!("Dòng {line_no}: {e}"))?;
        if rec.iter().all(|c| c.trim().is_empty()) {
            continue;
        }
        let id_cell = get_field(&rec, &col, "nhom_san_pham_id").unwrap_or("");
        let id = parse_opt_i64_cell(id_cell)?;
        let ten = get_field(&rec, &col, "ten_nhom").unwrap_or("").trim();
        if ten.is_empty() {
            return Err(format!("Dòng {line_no}: ten_nhom không được để trống."));
        }
        let ten = ten.to_string();
        let cha_cell = get_field(&rec, &col, "nhom_san_pham_cha_id").unwrap_or("");
        let cha = parse_opt_i64_cell(cha_cell)?;
        rows.push((line_no as usize, id, ten, cha));
    }

    let explicit_ids: HashSet<i64> = rows.iter().filter_map(|(_, id, _, _)| *id).collect();
    let mut known: HashSet<i64> = db_ids.clone();
    known.extend(explicit_ids);

    for (line, _id, _ten, cha) in &rows {
        if let Some(p) = cha {
            if !known.contains(p) {
                return Err(format!(
                    "Dòng {line}: nhom_san_pham_cha_id={p} chưa tồn tại (trong DB hoặc cột nhom_san_pham_id trong file)."
                ));
            }
        }
    }

    let total = rows.len() as u32;
    if total == 0 {
        return Ok(CsvImportStats {
            message: summary_message(0, 0, 0),
            total_rows: 0,
            inserted: 0,
            updated: 0,
        });
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let mut inserted = 0_u32;
    let mut updated = 0_u32;
    let mut known_exec: HashSet<i64> = db_ids;

    for (line, id, ten, cha) in rows {
        if let Some(pid) = id {
            let existed: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM nhom_san_pham WHERE nhom_san_pham_id = ?")
                    .bind(pid)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(|e| format!("Dòng {line}: {e}"))?;
            if existed > 0 {
                updated += 1;
            } else {
                inserted += 1;
            }
            sqlx::query(
                "INSERT INTO nhom_san_pham (nhom_san_pham_id, ten_nhom, nhom_san_pham_cha_id)
                 VALUES (?, ?, ?)
                 ON CONFLICT(nhom_san_pham_id) DO UPDATE SET
                   ten_nhom = excluded.ten_nhom,
                   nhom_san_pham_cha_id = excluded.nhom_san_pham_cha_id",
            )
            .bind(pid)
            .bind(&ten)
            .bind(cha)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Dòng {line}: {e}"))?;
            known_exec.insert(pid);
        } else {
            if let Some(p) = cha {
                if !known_exec.contains(&p) {
                    return Err(format!(
                        "Dòng {line}: nhom_san_pham_cha_id={p} không hợp lệ tại thời điểm chèn."
                    ));
                }
            }
            sqlx::query("INSERT INTO nhom_san_pham (ten_nhom, nhom_san_pham_cha_id) VALUES (?, ?)")
                .bind(&ten)
                .bind(cha)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Dòng {line}: {e}"))?;
            let new_id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("Dòng {line}: {e}"))?;
            known_exec.insert(new_id);
            inserted += 1;
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(CsvImportStats {
        message: summary_message(total, inserted, updated),
        total_rows: total,
        inserted,
        updated,
    })
}

#[tauri::command]
pub async fn import_products_csv(
    state: tauri::State<'_, DbState>,
    file_path: String,
) -> Result<CsvImportStats, String> {
    let path = file_path.trim();
    if path.is_empty() {
        return Err("Chưa chọn file.".to_string());
    }
    let content = std::fs::read_to_string(path).map_err(|e| format!("Không đọc được file: {e}"))?;
    do_import_products(state.pool(), &content).await
}

async fn do_import_products(pool: &SqlitePool, content: &str) -> Result<CsvImportStats, String> {
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(content.as_bytes());
    let headers = rdr
        .headers()
        .map_err(|e| format!("CSV không hợp lệ: {e}"))?
        .clone();
    let col = header_indices(&headers)?;
    for required in ["ten_san_pham", "don_vi_tinh", "don_gia"] {
        if !col.contains_key(required) {
            return Err(format!("Thiếu cột bắt buộc: {required}"));
        }
    }

    let group_ids: HashSet<i64> = sqlx::query_scalar::<_, i64>("SELECT nhom_san_pham_id FROM nhom_san_pham")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .collect();

    #[derive(Clone)]
    struct RowData {
        line: usize,
        san_pham_id: String,
        ten_san_pham: String,
        nhom_id: Option<i64>,
        don_vi: String,
        don_gia: f64,
    }

    let mut rows: Vec<RowData> = Vec::new();
    let mut line_no = 1_u32;
    for result in rdr.records() {
        line_no += 1;
        let rec = result.map_err(|e| format!("Dòng {line_no}: {e}"))?;
        if rec.iter().all(|c| c.trim().is_empty()) {
            continue;
        }
        let mut sid = get_field(&rec, &col, "san_pham_id").unwrap_or("").trim().to_string();
        if sid.is_empty() {
            sid = format!("IMP-{}", Uuid::new_v4());
        }
        let ten = get_field(&rec, &col, "ten_san_pham").unwrap_or("").trim();
        if ten.is_empty() {
            return Err(format!("Dòng {line_no}: ten_san_pham không được để trống."));
        }
        let don_vi = get_field(&rec, &col, "don_vi_tinh").unwrap_or("").trim();
        if don_vi.is_empty() {
            return Err(format!("Dòng {line_no}: don_vi_tinh không được để trống."));
        }
        let dg_str = get_field(&rec, &col, "don_gia").unwrap_or("").trim();
        let don_gia: f64 = dg_str
            .parse()
            .map_err(|_| format!("Dòng {line_no}: don_gia không hợp lệ: '{dg_str}'"))?;
        if don_gia < 0.0 {
            return Err(format!("Dòng {line_no}: don_gia phải >= 0."));
        }
        let nhom_cell = get_field(&rec, &col, "nhom_san_pham_id").unwrap_or("");
        let nhom_id = parse_opt_i64_cell(nhom_cell)?;
        if let Some(nid) = nhom_id {
            if !group_ids.contains(&nid) {
                return Err(format!(
                    "Dòng {line_no}: nhom_san_pham_id={nid} không tồn tại. Hãy import nhóm trước hoặc sửa file."
                ));
            }
        }
        rows.push(RowData {
            line: line_no as usize,
            san_pham_id: sid,
            ten_san_pham: ten.to_string(),
            nhom_id,
            don_vi: don_vi.to_string(),
            don_gia,
        });
    }

    let total = rows.len() as u32;
    if total == 0 {
        return Ok(CsvImportStats {
            message: summary_message(0, 0, 0),
            total_rows: 0,
            inserted: 0,
            updated: 0,
        });
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let mut inserted = 0_u32;
    let mut updated = 0_u32;

    for r in rows {
        let existed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM san_pham WHERE san_pham_id = ?")
            .bind(&r.san_pham_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| format!("Dòng {}: {e}", r.line))?;
        if existed > 0 {
            updated += 1;
        } else {
            inserted += 1;
        }
        sqlx::query(
            "INSERT INTO san_pham (san_pham_id, nhom_san_pham_id, ten_san_pham, don_vi_tinh, don_gia)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(san_pham_id) DO UPDATE SET
               nhom_san_pham_id = excluded.nhom_san_pham_id,
               ten_san_pham = excluded.ten_san_pham,
               don_vi_tinh = excluded.don_vi_tinh,
               don_gia = excluded.don_gia",
        )
        .bind(&r.san_pham_id)
        .bind(r.nhom_id)
        .bind(&r.ten_san_pham)
        .bind(&r.don_vi)
        .bind(r.don_gia)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Dòng {}: {e}", r.line))?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(CsvImportStats {
        message: summary_message(total, inserted, updated),
        total_rows: total,
        inserted,
        updated,
    })
}
