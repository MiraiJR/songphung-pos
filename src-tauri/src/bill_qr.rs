//! VietQR payload helpers. Bills embed the total via Tag 54 and CRC16-CCITT (False),
//! then render a fresh QR image per print.

use std::io::Cursor;

use image::DynamicImage;
use qrcode::QrCode;

/// EMV payload for the shop's static VietQR before Tag 54 / dynamic CRC.
pub const DEFAULT_VIETQR_PAYLOAD: &str = "00020101021138570010A000000727012700069704220113VQRQAFSHT12560208QRIBFTTA53037045802VN62340107NPS68690819VQRLOAMB2512055872763045694";

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
