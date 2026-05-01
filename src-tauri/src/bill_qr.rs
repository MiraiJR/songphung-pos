//! Payment QR: bundled default image + optional override PNG in app data.
//! VietQR EMV string is stored separately (`bill_qr_vietqr_payload.txt`) so bills can embed
//! **tổng tiền** via Tag 54 + CRC16-CCITT (False), then render a fresh QR image per print.

use std::io::Cursor;
use std::path::PathBuf;

use image::DynamicImage;
use qrcode::QrCode;
use tauri::AppHandle;
use tauri::Manager;

pub const QR_FILENAME: &str = "bill_qr_code.png";
/// Optional UTF-8 EMVCo/VietQR payload (decoded from uploaded QR or copied default).
pub const VIETQR_PAYLOAD_FILENAME: &str = "bill_qr_vietqr_payload.txt";

/// EMV payload decoded from the bundled `qr_code.png` (static VietQR before Tag 54 / dynamic CRC).
pub const DEFAULT_VIETQR_PAYLOAD: &str = "00020101021138570010A000000727012700069704220113VQRQAFSHT12560208QRIBFTTA53037045802VN62340107NPS68690819VQRLOAMB2512055872763045694";

pub fn default_qr_png_bytes() -> &'static [u8] {
    include_bytes!("../../src/assets/qr_code.png")
}

pub fn resolve_qr_storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(QR_FILENAME))
}

fn resolve_vietqr_payload_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(VIETQR_PAYLOAD_FILENAME))
}

/// Prefer user-decoded payload file; otherwise bundled shop default.
pub fn load_vietqr_base_string(app: &AppHandle) -> String {
    if let Ok(path) = resolve_vietqr_payload_path(app) {
        if path.exists() {
            if let Ok(s) = std::fs::read_to_string(&path) {
                let t = s.trim();
                if looks_like_vietqr_payload(t) && t.contains("010211") {
                    return t.to_string();
                }
            }
        }
    }
    DEFAULT_VIETQR_PAYLOAD.to_string()
}

fn looks_like_vietqr_payload(s: &str) -> bool {
    s.len() >= 32 && s.starts_with("000201") && s.contains("5802VN")
}

/// CRC16-CCITT (False / polynomial 0x1021), same as EMVCo VietQR Tag 63.
fn crc16_ccitt_false(data: &str) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data.as_bytes() {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if (crc & 0x8000) != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    crc
}

/// Static → dynamic (`010211` → `010212`), insert Tag 54 (amount), recompute Tag 63 CRC.
pub fn generate_dynamic_vietqr_payload(original: &str, amount_vnd: u64) -> Result<String, String> {
    let trimmed = original.trim();
    if trimmed.len() < 16 {
        return Err("Chuỗi VietQR quá ngắn.".to_string());
    }
    if !trimmed.contains("010211") {
        return Err("QR không phải dạng tĩnh (thiếu 010211).".to_string());
    }
    if !trimmed.contains("5802VN") {
        return Err("QR không đủ thông tin (thiếu 5802VN).".to_string());
    }

    let mut modified = trimmed.replace("010211", "010212");
    modified = modified
        .get(..modified.len().saturating_sub(8))
        .ok_or_else(|| "Không cắt được CRC cũ.".to_string())?
        .to_string();

    let amount_str = amount_vnd.to_string();
    let len = format!("{:02}", amount_str.len());
    let tag54 = format!("54{len}{amount_str}");
    if !modified.contains("5802VN") {
        return Err("Không chèn được Tag 54.".to_string());
    }
    modified = modified.replacen("5802VN", &format!("{tag54}5802VN"), 1);

    modified.push_str("6304");
    let crc = crc16_ccitt_false(&modified);
    let crc_hex = format!("{crc:04X}");
    Ok(modified + &crc_hex)
}

fn encode_vietqr_string_to_png(payload: &str) -> Result<Vec<u8>, String> {
    let code = QrCode::new(payload.as_bytes()).map_err(|e| format!("Không tạo được ma trận QR: {e}"))?;
    let img = code
        .render::<image::Luma<u8>>()
        .quiet_zone(true)
        .min_dimensions(256, 256)
        .build();
    let dyn_img = DynamicImage::ImageLuma8(img);
    let mut buf = Vec::new();
    dyn_img
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| format!("Không ghi PNG QR: {e}"))?;
    Ok(buf)
}

fn fallback_static_png(app: &AppHandle) -> Vec<u8> {
    load_bill_qr_png(app).unwrap_or_else(|_| default_qr_png_bytes().to_vec())
}

pub fn amount_vnd_from_total(total: f64) -> u64 {
    if total.is_nan() || total <= 0.0 {
        return 0;
    }
    let r = total.round();
    if r > u64::MAX as f64 {
        u64::MAX
    } else {
        r as u64
    }
}

/// Generate QR PNG bytes from a specific static VietQR base string.
pub fn qr_png_for_bill_from_base(base_qr: &str, tong_tien: f64) -> Result<Vec<u8>, String> {
    let amount_vnd = amount_vnd_from_total(tong_tien);
    let payload = generate_dynamic_vietqr_payload(base_qr, amount_vnd)?;
    encode_vietqr_string_to_png(&payload)
}

/// Generate QR preview bytes from a specific static VietQR base string.
pub fn qr_png_preview_from_base(base_qr: &str, use_fixed_amount: bool, fixed_amount_vnd: u64) -> Result<Vec<u8>, String> {
    let amount_vnd = if use_fixed_amount { fixed_amount_vnd } else { 451_000 };
    let payload = generate_dynamic_vietqr_payload(base_qr, amount_vnd)?;
    encode_vietqr_string_to_png(&payload)
}

/// PNG bytes for a bill: dynamic VietQR from **tổng tiền** when payload is valid; else bundled/custom PNG.
pub fn qr_png_for_bill(app: &AppHandle, tong_tien: f64) -> Vec<u8> {
    qr_png_for_bill_amount(app, amount_vnd_from_total(tong_tien))
}

pub fn qr_png_for_bill_amount(app: &AppHandle, amount_vnd: u64) -> Vec<u8> {
    let base = load_vietqr_base_string(app);
    match generate_dynamic_vietqr_payload(&base, amount_vnd) {
        Ok(payload) => match encode_vietqr_string_to_png(&payload) {
            Ok(png) => png,
            Err(_) => fallback_static_png(app),
        },
        Err(_) => fallback_static_png(app),
    }
}

/// Preview / in thử: dùng cùng pipeline với mẫu 451.000 đ (trùng `compose_printer_test_sample_receipt`).
pub fn qr_png_for_preview(app: &AppHandle) -> Vec<u8> {
    qr_png_for_bill_amount(app, 451_000)
}

pub fn load_bill_qr_png(app: &AppHandle) -> Result<Vec<u8>, String> {
    let path = resolve_qr_storage_path(app)?;
    if path.exists() {
        std::fs::read(&path).map_err(|e| format!("Không đọc được ảnh QR: {e}"))
    } else {
        Ok(default_qr_png_bytes().to_vec())
    }
}

pub fn save_bill_qr_png(app: &AppHandle, bytes: &[u8]) -> Result<(), String> {
    let _ = image::load_from_memory(bytes).map_err(|_| "File không phải ảnh hợp lệ (PNG/JPEG…).".to_string())?;
    let path = resolve_qr_storage_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, bytes).map_err(|e| format!("Không lưu được ảnh QR: {e}"))?;

    if let Some(payload) = try_decode_vietqr_from_png(bytes) {
        let ppath = resolve_vietqr_payload_path(app)?;
        if let Some(parent) = ppath.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&ppath, payload).map_err(|e| format!("Không lưu chuỗi VietQR: {e}"))?;
    }

    Ok(())
}

fn try_decode_vietqr_from_png(bytes: &[u8]) -> Option<String> {
    let img = image::load_from_memory(bytes).ok()?.into_luma8();
    let mut prepared = rqrr::PreparedImage::prepare(img);
    let grids = prepared.detect_grids();
    for grid in grids {
        if let Ok((_, content)) = grid.decode() {
            if looks_like_vietqr_payload(&content) && content.contains("010211") {
                return Some(content);
            }
        }
    }
    None
}

pub fn reset_bill_qr_png(app: &AppHandle) -> Result<(), String> {
    let path = resolve_qr_storage_path(app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    let ppath = resolve_vietqr_payload_path(app)?;
    if ppath.exists() {
        std::fs::remove_file(&ppath).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dynamic_vietqr_matches_reference_implementation() {
        let raw = DEFAULT_VIETQR_PAYLOAD;
        assert_eq!(
            generate_dynamic_vietqr_payload(raw, 150_000).unwrap(),
            "00020101021238570010A000000727012700069704220113VQRQAFSHT12560208QRIBFTTA530370454061500005802VN62340107NPS68690819VQRLOAMB25120558727630468F5"
        );
        assert_eq!(
            generate_dynamic_vietqr_payload(raw, 0).unwrap(),
            "00020101021238570010A000000727012700069704220113VQRQAFSHT12560208QRIBFTTA5303704540105802VN62340107NPS68690819VQRLOAMB251205587276304055E"
        );
        assert_eq!(
            generate_dynamic_vietqr_payload(raw, 451_000).unwrap(),
            "00020101021238570010A000000727012700069704220113VQRQAFSHT12560208QRIBFTTA530370454064510005802VN62340107NPS68690819VQRLOAMB251205587276304DE0C"
        );
    }
}
