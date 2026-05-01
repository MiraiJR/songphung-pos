pub mod receipt_format;

mod escpos_qr;

use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::time::Duration;
use unicode_normalization::UnicodeNormalization;

/// Single line in composed receipt text; replaced by QR bitmap when printing.
pub const BILL_QR_MARKER_LINE: &str = "@@BILL_QR@@";

/// Printable width for K80 @ ~203dpi (dots per line). QR uses a fraction of this, centered on the raster.
const RECEIPT_PAPER_WIDTH_DOTS: u32 = 384;
/// QR module width as % of paper width (centered on full-width raster).
const QR_BILL_WIDTH_PERCENT: u32 = 40;

#[cfg(target_os = "windows")]
const WINDOWS_UNICODE_PRINT_PS1: &str = include_str!("windows_unicode_print.ps1");

#[cfg(target_os = "windows")]
fn powershell_command() -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new("powershell");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

const ESC_POS_CODE_PAGE_WPC1258: u8 = 52;
const LARGE_MARKER: &str = "@@LARGE@@";

// ---------------------------------------------------------------------------
// Windows-1258 Vietnamese encoder
// ---------------------------------------------------------------------------
//
// CP1258 stores Vietnamese using:
//   A) Single-byte precomposed chars for base+modifier letters:
//      Â(0xC2) Ê(0xCA) Ô(0xD4) Ă(0xC3) Đ(0xD0) Ơ(0xD5) Ư(0xDF)
//      â(0xE2) ê(0xEA) ô(0xF4) ă(0xE3) đ(0xF0) ơ(0xF5) ư(0xFD) ..etc
//   B) Single-byte combining marks for the 5 tones:
//      grave(0xCC) acute(0xEC) tilde(0xDE) hook(0xD2) dot_below(0xF2)
//
// Double-accented chars like Ậ are encoded as Â(0xC2) + dot_below(0xF2).
//
// encoding_rs cannot do this decomposition, so we handle it manually.

fn char_to_cp1258_byte(ch: char) -> Option<u8> {
    // ASCII pass-through
    if (ch as u32) < 0x80 {
        return Some(ch as u8);
    }
    // Full CP1258 single-byte mapping for chars 0x80..0xFF
    // Reference: https://en.wikipedia.org/wiki/Windows-1258
    let b = match ch {
        // 0x80..0x9F control region (selected printable chars in CP1258)
        '\u{20AC}' => 0x80, // €
        '\u{201A}' => 0x82,
        '\u{0192}' => 0x83,
        '\u{201E}' => 0x84,
        '\u{2026}' => 0x85, // …
        '\u{2020}' => 0x86,
        '\u{2021}' => 0x87,
        '\u{02C6}' => 0x88,
        '\u{2030}' => 0x89,
        '\u{2039}' => 0x8B,
        '\u{0152}' => 0x8C, // Œ
        '\u{2018}' => 0x91,
        '\u{2019}' => 0x92,
        '\u{201C}' => 0x93,
        '\u{201D}' => 0x94,
        '\u{2022}' => 0x95,
        '\u{2013}' => 0x96,
        '\u{2014}' => 0x97,
        '\u{02DC}' => 0x98,
        '\u{2122}' => 0x99,
        '\u{203A}' => 0x9B,
        '\u{0153}' => 0x9C, // œ
        '\u{0178}' => 0x9F, // Ÿ
        // 0xA0..0xFF — Latin + Vietnamese
        '\u{00A0}' => 0xA0, // NBSP
        '\u{00A1}' => 0xA1,
        '\u{00A2}' => 0xA2,
        '\u{00A3}' => 0xA3,
        '\u{00A4}' => 0xA4,
        '\u{00A5}' => 0xA5,
        '\u{00A6}' => 0xA6,
        '\u{00A7}' => 0xA7,
        '\u{00A8}' => 0xA8,
        '\u{00A9}' => 0xA9,
        '\u{00AA}' => 0xAA,
        '\u{00AB}' => 0xAB,
        '\u{00AC}' => 0xAC,
        '\u{00AD}' => 0xAD,
        '\u{00AE}' => 0xAE,
        '\u{00AF}' => 0xAF,
        '\u{00B0}' => 0xB0,
        '\u{00B1}' => 0xB1,
        '\u{00B2}' => 0xB2,
        '\u{00B3}' => 0xB3,
        '\u{00B4}' => 0xB4,
        '\u{00B5}' => 0xB5,
        '\u{00B6}' => 0xB6,
        '\u{00B7}' => 0xB7,
        '\u{00B8}' => 0xB8,
        '\u{00B9}' => 0xB9,
        '\u{00BA}' => 0xBA,
        '\u{00BB}' => 0xBB,
        '\u{00BC}' => 0xBC,
        '\u{00BD}' => 0xBD,
        '\u{00BE}' => 0xBE,
        '\u{00BF}' => 0xBF,
        '\u{00C0}' => 0xC0, // À
        '\u{00C1}' => 0xC1, // Á
        '\u{00C2}' => 0xC2, // Â
        '\u{0102}' => 0xC3, // Ă
        '\u{00C4}' => 0xC4, // Ä
        '\u{00C5}' => 0xC5, // Å
        '\u{00C6}' => 0xC6, // Æ
        '\u{00C7}' => 0xC7, // Ç
        '\u{00C8}' => 0xC8, // È
        '\u{00C9}' => 0xC9, // É
        '\u{00CA}' => 0xCA, // Ê
        '\u{00CB}' => 0xCB, // Ë
        '\u{0300}' => 0xCC, // combining grave
        '\u{00CD}' => 0xCD, // Í
        '\u{00CE}' => 0xCE, // Î
        '\u{00CF}' => 0xCF, // Ï
        '\u{0110}' => 0xD0, // Đ
        '\u{00D1}' => 0xD1, // Ñ
        '\u{0309}' => 0xD2, // combining hook above
        '\u{00D3}' => 0xD3, // Ó
        '\u{00D4}' => 0xD4, // Ô
        '\u{01A0}' => 0xD5, // Ơ
        '\u{00D6}' => 0xD6, // Ö
        '\u{00D7}' => 0xD7, // ×
        '\u{00D8}' => 0xD8, // Ø
        '\u{00D9}' => 0xD9, // Ù
        '\u{00DA}' => 0xDA, // Ú
        '\u{00DB}' => 0xDB, // Û
        '\u{00DC}' => 0xDC, // Ü
        '\u{01AF}' => 0xDD, // Ư
        '\u{0303}' => 0xDE, // combining tilde
        '\u{00DF}' => 0xDF, // ß
        '\u{00E0}' => 0xE0, // à
        '\u{00E1}' => 0xE1, // á
        '\u{00E2}' => 0xE2, // â
        '\u{0103}' => 0xE3, // ă
        '\u{00E4}' => 0xE4, // ä
        '\u{00E5}' => 0xE5, // å
        '\u{00E6}' => 0xE6, // æ
        '\u{00E7}' => 0xE7, // ç
        '\u{00E8}' => 0xE8, // è
        '\u{00E9}' => 0xE9, // é
        '\u{00EA}' => 0xEA, // ê
        '\u{00EB}' => 0xEB, // ë
        '\u{0301}' => 0xEC, // combining acute
        '\u{00ED}' => 0xED, // í
        '\u{00EE}' => 0xEE, // î
        '\u{00EF}' => 0xEF, // ï
        '\u{0111}' => 0xF0, // đ
        '\u{00F1}' => 0xF1, // ñ
        '\u{0323}' => 0xF2, // combining dot below
        '\u{00F3}' => 0xF3, // ó
        '\u{00F4}' => 0xF4, // ô
        '\u{01A1}' => 0xF5, // ơ
        '\u{00F6}' => 0xF6, // ö
        '\u{00F7}' => 0xF7, // ÷
        '\u{00F8}' => 0xF8, // ø
        '\u{00F9}' => 0xF9, // ù
        '\u{00FA}' => 0xFA, // ú
        '\u{00FB}' => 0xFB, // û
        '\u{00FC}' => 0xFC, // ü
        '\u{01B0}' => 0xFD, // ư
        '\u{20AB}' => 0xFE, // ₫
        '\u{00FF}' => 0xFF, // ÿ
        _ => return None,
    };
    Some(b)
}

/// Vietnamese modifier combining marks (circumflex, breve, horn).
/// These combine with a base vowel to form a letter that has a CP1258 single byte.
fn is_modifier(ch: char) -> bool {
    matches!(ch, '\u{0302}' | '\u{0306}' | '\u{031B}')
}

/// Vietnamese tone combining marks (the 5 dấu thanh).
fn is_tone(ch: char) -> bool {
    matches!(ch, '\u{0300}' | '\u{0301}' | '\u{0303}' | '\u{0309}' | '\u{0323}')
}

/// Encode a single Unicode char (NFC) into CP1258 bytes.
///
/// For double-accented chars like Ậ, Unicode NFD gives: a + ̣(dot below) + ̂(circumflex)
/// (canonical ordering: ccc 220 before ccc 230).
/// CP1258 needs: â(0xE2) + ̣(0xF2) — i.e. base+modifier first, then tone.
///
/// Strategy: NFD decompose, separate into (base, modifiers, tones),
/// recompose base+modifiers via NFC to get a direct-mapped char, then append tones.
fn encode_char(ch: char, out: &mut Vec<u8>) {
    if let Some(b) = char_to_cp1258_byte(ch) {
        out.push(b);
        return;
    }

    let s = ch.to_string();
    let nfd: Vec<char> = s.nfd().collect();

    if nfd.len() >= 2 {
        let base = nfd[0];
        let mut modifiers = Vec::new();
        let mut tones = Vec::new();

        for &c in &nfd[1..] {
            if is_modifier(c) {
                modifiers.push(c);
            } else if is_tone(c) {
                tones.push(c);
            }
        }

        // Recompose base + modifiers (e.g. a + circumflex → â)
        let mut base_str = String::new();
        base_str.push(base);
        for &m in &modifiers {
            base_str.push(m);
        }
        let base_nfc: String = base_str.nfc().collect();

        if base_nfc.chars().count() == 1 {
            let base_ch = base_nfc.chars().next().unwrap();
            if let Some(base_byte) = char_to_cp1258_byte(base_ch) {
                out.push(base_byte);
                for &t in &tones {
                    if let Some(tb) = char_to_cp1258_byte(t) {
                        out.push(tb);
                    }
                }
                return;
            }
        }
    }

    out.push(b'?');
}

fn encode_vietnamese_cp1258(content: &str) -> Vec<u8> {
    let nfc: String = content.nfc().collect();
    let mut out = Vec::with_capacity(nfc.len() * 2);
    for ch in nfc.chars() {
        encode_char(ch, &mut out);
    }
    out
}

fn append_text_with_size_markers(buf: &mut Vec<u8>, content: &str) {
    for chunk in content.split_inclusive('\n') {
        let (line, has_newline) = if let Some(line) = chunk.strip_suffix('\n') {
            (line, true)
        } else {
            (chunk, false)
        };

        if let Some(text) = line.strip_prefix(LARGE_MARKER) {
            buf.extend_from_slice(&[0x1D, 0x21, 0x11]); // GS ! double width + double height
            buf.extend_from_slice(&encode_vietnamese_cp1258(text));
            if has_newline {
                buf.push(0x0A);
            }
            buf.extend_from_slice(&[0x1D, 0x21, 0x00]); // GS ! back to normal
        } else {
            buf.extend_from_slice(&encode_vietnamese_cp1258(line));
            if has_newline {
                buf.push(0x0A);
            }
        }
    }
}

fn receipt_print_bytes(content: &str, qr_png: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let mut buf = Vec::with_capacity(content.len() + 4096);

    buf.extend_from_slice(&[0x1B, 0x40]);                            // ESC @ init
    buf.extend_from_slice(&[0x1B, 0x74, ESC_POS_CODE_PAGE_WPC1258]); // ESC t n
    buf.extend_from_slice(&[0x1D, 0x21, 0x00]);                      // GS ! standard size
    buf.extend_from_slice(&[0x1B, 0x45, 0x01]);                      // ESC E bold ON

    let segments: Vec<&str> = content.split(BILL_QR_MARKER_LINE).collect();
    match segments.len() {
        1 => {
            append_text_with_size_markers(&mut buf, segments[0]);
        }
        2 => {
            append_text_with_size_markers(&mut buf, segments[0]);
            if let Some(png) = qr_png {
                // QR is centered inside a full-width raster (see escpos_qr); avoid ESC a (printer-dependent for bitmaps).
                buf.extend_from_slice(&escpos_qr::png_to_esc_pos_gs_v0(
                    png,
                    RECEIPT_PAPER_WIDTH_DOTS,
                    QR_BILL_WIDTH_PERCENT,
                )?);
                buf.push(0x0A);
            }
            append_text_with_size_markers(&mut buf, segments[1]);
        }
        _ => {
            return Err("Nội dung hóa đơn có nhiều hơn một vị trí mã QR.".to_string());
        }
    }

    buf.extend_from_slice(&[0x1B, 0x45, 0x00]);                      // ESC E bold OFF
    buf.push(0x0A);
    buf.push(0x0A);
    buf.extend_from_slice(&[0x1D, 0x56, 0x41, 0x10]);                // GS V partial cut

    Ok(buf)
}

// ---------------------------------------------------------------------------
// Printer I/O
// ---------------------------------------------------------------------------

pub fn print_receipt_to_network(
    printer_addr: &str,
    content: &str,
    qr_png: Option<&[u8]>,
) -> Result<(), String> {
    let mut stream = TcpStream::connect(printer_addr).map_err(|e| e.to_string())?;
    let bytes = receipt_print_bytes(content, qr_png)?;
    stream.write_all(&bytes).map_err(|e| e.to_string())
}

pub fn check_network_printer_connection(printer_addr: &str) -> Result<(), String> {
    let mut addrs = printer_addr
        .to_socket_addrs()
        .map_err(|e| format!("Địa chỉ máy in không hợp lệ: {e}"))?;
    let addr = addrs
        .next()
        .ok_or_else(|| "Không tìm thấy địa chỉ máy in hợp lệ".to_string())?;
    TcpStream::connect_timeout(&addr, Duration::from_secs(2))
        .map(|_| ())
        .map_err(|e| format!("Không kết nối được máy in tại {printer_addr}: {e}"))
}

pub fn list_system_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = powershell_command()
            .args([
                "-NoProfile",
                "-Command",
                "Get-Printer | Select-Object -ExpandProperty Name",
            ])
            .output()
            .map_err(|e| format!("Không đọc được danh sách máy in hệ thống: {e}"))?;
        if !output.status.success() {
            return Err("Lỗi khi lấy danh sách máy in hệ thống".to_string());
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        let list = stdout
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>();
        return Ok(list);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sh")
            .args(["-c", "lpstat -a | awk '{print $1}'"])
            .output()
            .map_err(|e| format!("Không đọc được danh sách máy in hệ thống: {e}"))?;
        if !output.status.success() {
            return Ok(vec![]);
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        let list = stdout
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>();
        Ok(list)
    }
}

fn is_network_target(target: &str) -> bool {
    target.contains(':')
}

fn print_receipt_to_system(
    printer_name: &str,
    content: &str,
    qr_png: Option<&[u8]>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let temp = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let id = format!("{}_{stamp}", std::process::id());
        let txt_path = temp.join(format!("songphung_{id}.txt"));
        let ps1_path = temp.join(format!("songphung_unicode_{id}.ps1"));
        let qr_path =
            if content.contains(BILL_QR_MARKER_LINE) && qr_png.is_some() {
                Some(temp.join(format!("songphung_qr_{id}.png")))
            } else {
                None
            };
        if let (Some(ref path), Some(bytes)) = (&qr_path, qr_png) {
            std::fs::write(path, bytes).map_err(|e| format!("Không ghi ảnh QR in tạm: {e}"))?;
        }

        let windows_text = content.replace('\n', "\r\n");
        std::fs::write(&txt_path, windows_text.as_bytes())
            .map_err(|e| format!("Không ghi file text in tạm: {e}"))?;
        std::fs::write(&ps1_path, WINDOWS_UNICODE_PRINT_PS1)
            .map_err(|e| format!("Không ghi script in Unicode tạm: {e}"))?;

        let txt_str = txt_path
            .to_str()
            .ok_or_else(|| "Đường dẫn file in tạm không hợp lệ.".to_string())?;
        let ps1_str = ps1_path
            .to_str()
            .ok_or_else(|| "Đường dẫn script in tạm không hợp lệ.".to_string())?;

        let qr_str = qr_path
            .as_ref()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_string();

        let output = powershell_command()
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ps1_str,
                "-Path",
                txt_str,
                "-Printer",
                printer_name,
                "-QrImagePath",
                &qr_str,
            ])
            .output()
            .map_err(|e| format!("Không chạy PowerShell để in: {e}"))?;

        let _ = std::fs::remove_file(&ps1_path);
        let _ = std::fs::remove_file(&txt_path);
        if let Some(ref path) = qr_path {
            let _ = std::fs::remove_file(path);
        }
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        let detail = format!("{stderr}{stdout_msg}").trim().to_string();
        return Err(if detail.is_empty() {
            "Lệnh in máy in hệ thống thất bại.".to_string()
        } else {
            format!("Lệnh in máy in hệ thống thất bại: {detail}")
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let bytes = receipt_print_bytes(content, qr_png)?;
        let mut child = Command::new("lp")
            .args(["-d", printer_name, "-o", "raw"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Không gọi được lệnh lp để in: {e}"))?;
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(&bytes)
                .map_err(|e| format!("Không gửi được dữ liệu in: {e}"))?;
        }
        let status = child
            .wait()
            .map_err(|e| format!("Lệnh in bị lỗi khi chờ hoàn tất: {e}"))?;
        if !status.success() {
            return Err("Lệnh in máy in hệ thống thất bại".to_string());
        }
        Ok(())
    }
}

pub fn check_printer_target_connection(printer_name_or_ip: &str) -> Result<(), String> {
    if is_network_target(printer_name_or_ip) {
        return check_network_printer_connection(printer_name_or_ip);
    }
    let printers = list_system_printers()?;
    if printers.iter().any(|name| name == printer_name_or_ip) {
        Ok(())
    } else {
        Err(format!(
            "Không tìm thấy máy in hệ thống: {printer_name_or_ip}"
        ))
    }
}

fn resolve_qr_png_for_bill_content<'a>(content: &str, qr_png: Option<&'a [u8]>) -> Option<&'a [u8]> {
    if !content.contains(BILL_QR_MARKER_LINE) {
        return qr_png;
    }
    match qr_png {
        Some(bytes) if !bytes.is_empty() => Some(bytes),
        Some(_) | None => Some(crate::bill_qr::default_qr_png_bytes()),
    }
}

pub fn print_receipt_to_target(
    printer_name_or_ip: &str,
    content: &str,
    qr_png: Option<&[u8]>,
) -> Result<(), String> {
    let qr = resolve_qr_png_for_bill_content(content, qr_png);
    if is_network_target(printer_name_or_ip) {
        return print_receipt_to_network(printer_name_or_ip, content, qr);
    }
    print_receipt_to_system(printer_name_or_ip, content, qr)
}

#[cfg(test)]
mod tests {
    use super::*;
    use encoding_rs::WINDOWS_1258;

    fn decode_cp1258(bytes: &[u8]) -> String {
        let (decoded, _, _) = WINDOWS_1258.decode(bytes);
        decoded.nfc().collect()
    }

    #[test]
    fn vietnamese_receipt_text_round_trips() {
        let samples = [
            "KARAOKE SONG PHỤNG 2",
            "373 LÊ QUÝ ĐÔN, AN NHƠN, BÌNH ĐỊNH",
            "ĐT: 0974 089 367",
            "PHIẾU THANH TOÁN",
            "Phòng P1 (P1)",
            "Thời gian: 2026-04-30",
            "Nhân viên: Admin",
            "Số HĐ: 00001",
            "(Chưa thanh toán - chỉ tham khảo)",
            "Mặt hàng",
            "Đ.GIÁ",
            "T.TIỀN",
            "BIA QUY NHƠN",
            "Nước suối",
            "Khăn lạnh",
            "TỔNG CỘNG:",
            "TIỀN GIỜ:",
            "TIỀN GIỜ (tạm tính):",
            "TỔNG TẠM TÍNH:",
            "TIỀN MẶT (đ):",
            "HÂN HẠNH ĐƯỢC PHỤC VỤ QUÝ KHÁCH!",
            "Chả ram tôm đất",
            "Dưa hấu",
            "Hướng dương",
            "Mực khô",
            "Bia Sài Gòn",
            "Bia Tiger",
            "Coca Cola",
            "Khô gà",
            "Bò húc",
            "Nước STING",
            "HEINEKEN LON",
        ];

        for sample in samples {
            let bytes = encode_vietnamese_cp1258(sample);
            assert!(
                !bytes.contains(&b'?') || sample.contains('?'),
                "Unmapped char in: {sample:?}\nbytes: {bytes:?}"
            );
            let decoded = decode_cp1258(&bytes);
            let expected: String = sample.nfc().collect();
            assert_eq!(
                decoded, expected,
                "Round-trip failed for: {sample:?}\nbytes: {bytes:?}"
            );
        }
    }

    #[test]
    fn all_vietnamese_diacritics_encode() {
        let lower = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
        let upper: String = lower.to_uppercase();
        for ch in lower.chars().chain(upper.chars()) {
            let s = ch.to_string();
            let nfd_chars: Vec<char> = s.nfd().collect();
            let bytes = encode_vietnamese_cp1258(&s);
            assert!(
                !bytes.contains(&b'?'),
                "Char '{ch}' (U+{:04X}) mapped to '?'\nnfd={:?}\nbytes: {bytes:?}",
                ch as u32,
                nfd_chars.iter().map(|c| format!("U+{:04X}", *c as u32)).collect::<Vec<_>>()
            );
        }
    }

    #[test]
    fn output_never_contains_html_entities() {
        let content = "PHỤNG ĐỊNH Ệ ờ ữ ẫ ổ ọ ạ ắ ẳ ẵ ặ ầ ậ";
        let bytes = encode_vietnamese_cp1258(content);
        let has_entity = bytes.windows(2).any(|w| w[0] == b'&' && w[1] == b'#');
        assert!(!has_entity, "HTML entities found in output: {bytes:?}");
    }
}
