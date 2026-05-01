//! Payment QR image: bundled default + optional override in app data.

use std::path::PathBuf;

use tauri::AppHandle;
use tauri::Manager;

pub const QR_FILENAME: &str = "bill_qr_code.png";

pub fn default_qr_png_bytes() -> &'static [u8] {
    include_bytes!("../../src/assets/qr_code.png")
}

pub fn resolve_qr_storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(QR_FILENAME))
}

pub fn load_bill_qr_png(app: &AppHandle) -> Result<Vec<u8>, String> {
    let path = resolve_qr_storage_path(app)?;
    if path.exists() {
        std::fs::read(&path).map_err(|e| format!("Không đọc được ảnh QR: {e}"))
    } else {
        Ok(default_qr_png_bytes().to_vec())
    }
}

/// Bytes sent to the printer with every bill — never fails (falls back to bundled QR).
pub fn qr_png_for_print(app: &AppHandle) -> Vec<u8> {
    load_bill_qr_png(app).unwrap_or_else(|_| default_qr_png_bytes().to_vec())
}

pub fn save_bill_qr_png(app: &AppHandle, bytes: &[u8]) -> Result<(), String> {
    let _ = image::load_from_memory(bytes).map_err(|_| "File không phải ảnh hợp lệ (PNG/JPEG…).".to_string())?;
    let path = resolve_qr_storage_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, bytes).map_err(|e| format!("Không lưu được ảnh QR: {e}"))
}

pub fn reset_bill_qr_png(app: &AppHandle) -> Result<(), String> {
    let path = resolve_qr_storage_path(app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
