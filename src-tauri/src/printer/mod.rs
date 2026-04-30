pub mod receipt_format;

use encoding_rs::WINDOWS_1258;
use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::time::Duration;
use unicode_normalization::UnicodeNormalization;

#[cfg(target_os = "windows")]
const WINDOWS_RAW_PRINT_PS1: &str = include_str!("windows_raw_print.ps1");
#[cfg(target_os = "windows")]
const WINDOWS_UNICODE_PRINT_PS1: &str = include_str!("windows_unicode_print.ps1");

/// Tránh bật cửa sổ PowerShell/console khi gọi từ ứng dụng GUI (Cài đặt, in, …).
#[cfg(target_os = "windows")]
fn powershell_command() -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new("powershell");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// WPC1258 (Vietnamese) — bảng ký tự thường gặp trên máy in ESC/POS (Epson/Bixolon/nhiều Xprinter).
/// Một số máy dùng byte khác (ví dụ 47, 56); nếu vẫn sai, xem manual máy in.
const ESC_POS_CODE_PAGE_WPC1258: u8 = 52;

fn decode_html_numeric_entities(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'&' && i + 3 < bytes.len() && bytes[i + 1] == b'#' {
            let mut j = i + 2;
            let mut hex = false;
            if j < bytes.len() && (bytes[j] == b'x' || bytes[j] == b'X') {
                hex = true;
                j += 1;
            }
            let digits_start = j;
            while j < bytes.len() {
                let b = bytes[j];
                let ok = if hex {
                    b.is_ascii_hexdigit()
                } else {
                    b.is_ascii_digit()
                };
                if !ok {
                    break;
                }
                j += 1;
            }

            if j > digits_start && j < bytes.len() && bytes[j] == b';' {
                let radix = if hex { 16 } else { 10 };
                if let Ok(num_str) = std::str::from_utf8(&bytes[digits_start..j]) {
                    if let Ok(code) = u32::from_str_radix(num_str, radix) {
                        if let Some(ch) = char::from_u32(code) {
                            out.push(ch);
                            i = j + 1;
                            continue;
                        }
                    }
                }
            }
        }

        if let Some(ch) = input[i..].chars().next() {
            out.push(ch);
            i += ch.len_utf8();
        } else {
            break;
        }
    }

    out
}

/// Chuẩn NFD + Windows-1258:
/// - Nhiều ký tự tiếng Việt trong CP1258 được biểu diễn dạng base + dấu tổ hợp.
/// - Nếu dùng NFC (ký tự dựng sẵn), encoder có thể fallback thành chuỗi `&#NNNN;`
///   và máy in sẽ in literal ra giấy (lỗi như ảnh người dùng gửi).
fn receipt_body_to_printer_bytes(content: &str) -> Vec<u8> {
    let decoded = decode_html_numeric_entities(content);
    let nfd: String = decoded.nfd().collect();
    let (encoded, _enc, _had_unmappable) = WINDOWS_1258.encode(&nfd);
    encoded.into_owned()
}

/// ESC/POS: init, chọn bảng tiếng Việt, bold on, body, bold off, feed, partial cut.
fn receipt_print_bytes(content: &str) -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&[0x1B, 0x40]); // ESC @ init
    bytes.extend_from_slice(&[0x1B, 0x74, ESC_POS_CODE_PAGE_WPC1258]); // ESC t n — Windows-1258
    bytes.extend_from_slice(&[0x1B, 0x45, 0x01]); // ESC E 1 bold on
    bytes.extend_from_slice(&receipt_body_to_printer_bytes(content));
    bytes.extend_from_slice(&[0x1B, 0x45, 0x00]); // ESC E 0 bold off
    bytes.push(0x0A);
    bytes.push(0x0A);
    bytes.extend_from_slice(&[0x1D, 0x56, 0x41, 0x10]); // partial cut
    bytes
}

pub fn print_receipt_to_network(printer_addr: &str, content: &str) -> Result<(), String> {
    let mut stream = TcpStream::connect(printer_addr).map_err(|e| e.to_string())?;
    let bytes = receipt_print_bytes(content);
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

fn print_receipt_to_system(printer_name: &str, content: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let temp = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let id = format!("{}_{stamp}", std::process::id());
        let txt_path = temp.join(format!("songphung_{id}.txt"));
        let unicode_ps1_path = temp.join(format!("songphung_unicode_{id}.ps1"));

        let windows_text = content.replace('\n', "\r\n");
        std::fs::write(&txt_path, windows_text.as_bytes())
            .map_err(|e| format!("Không ghi file text in tạm: {e}"))?;
        std::fs::write(&unicode_ps1_path, WINDOWS_UNICODE_PRINT_PS1)
            .map_err(|e| format!("Không ghi script in Unicode tạm: {e}"))?;

        let txt_str = txt_path.to_str().ok_or_else(|| {
            "Đường dẫn file text in tạm không hợp lệ (UTF-8).".to_string()
        })?;
        let unicode_ps1_str = unicode_ps1_path.to_str().ok_or_else(|| {
            "Đường dẫn script in Unicode tạm không hợp lệ (UTF-8).".to_string()
        })?;

        // Ưu tiên in Unicode qua driver để đảm bảo tiếng Việt.
        let unicode_output = powershell_command()
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                unicode_ps1_str,
                "-Path",
                txt_str,
                "-Printer",
                printer_name,
            ])
            .output()
            .map_err(|e| format!("Không chạy PowerShell để in Unicode: {e}"))?;

        let _ = std::fs::remove_file(&unicode_ps1_path);
        let _ = std::fs::remove_file(&txt_path);
        if unicode_output.status.success() {
            return Ok(());
        }

        // Fallback RAW ESC/POS nếu driver từ chối Out-Printer.
        let bytes = receipt_print_bytes(content);
        let temp = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let id = format!("{}_{stamp}_raw", std::process::id());
        let prn_path = temp.join(format!("songphung_{id}.prn"));
        let ps1_path = temp.join(format!("songphung_{id}.ps1"));

        std::fs::write(&prn_path, &bytes).map_err(|e| format!("Không ghi file in tạm: {e}"))?;
        std::fs::write(&ps1_path, WINDOWS_RAW_PRINT_PS1)
            .map_err(|e| format!("Không ghi script in tạm: {e}"))?;

        let prn_str = prn_path.to_str().ok_or_else(|| {
            "Đường dẫn file in tạm không hợp lệ (UTF-8).".to_string()
        })?;
        let ps1_str = ps1_path.to_str().ok_or_else(|| {
            "Đường dẫn script in tạm không hợp lệ (UTF-8).".to_string()
        })?;

        let output = powershell_command()
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ps1_str,
                "-Path",
                prn_str,
                "-Printer",
                printer_name,
            ])
            .output()
            .map_err(|e| format!("Không chạy PowerShell để in RAW: {e}"))?;

        let _ = std::fs::remove_file(&ps1_path);
        if !output.status.success() {
            let _ = std::fs::remove_file(&prn_path);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let unicode_stderr = String::from_utf8_lossy(&unicode_output.stderr);
            let unicode_stdout = String::from_utf8_lossy(&unicode_output.stdout);
            let detail = format!("{stderr}{stdout}").trim().to_string();
            return Err(if detail.is_empty() {
                format!(
                    "Lệnh in máy in hệ thống thất bại (Unicode và RAW).\nUnicode: {}\nRAW: thất bại.",
                    format!("{unicode_stderr}{unicode_stdout}").trim()
                )
            } else {
                format!(
                    "Lệnh in máy in hệ thống thất bại (Unicode và RAW).\nUnicode: {}\nRAW: {detail}",
                    format!("{unicode_stderr}{unicode_stdout}").trim()
                )
            });
        }
        let _ = std::fs::remove_file(&prn_path);
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let bytes = receipt_print_bytes(content);
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

pub fn print_receipt_to_target(printer_name_or_ip: &str, content: &str) -> Result<(), String> {
    if is_network_target(printer_name_or_ip) {
        return print_receipt_to_network(printer_name_or_ip, content);
    }
    print_receipt_to_system(printer_name_or_ip, content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_decimal_html_entities() {
        let content = "PH&#7908;NG";
        let decoded = decode_html_numeric_entities(content);
        assert_eq!(decoded, "PHỤNG");
    }

    #[test]
    fn decodes_hex_html_entities() {
        let content = "&#x110;&#x1ECB;NH";
        let decoded = decode_html_numeric_entities(content);
        assert_eq!(decoded, "ĐịNH");
    }
}
