pub mod receipt_format;

use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::time::Duration;

#[cfg(target_os = "windows")]
const WINDOWS_RAW_PRINT_PS1: &str = include_str!("windows_raw_print.ps1");

/// Tránh bật cửa sổ PowerShell/console khi gọi từ ứng dụng GUI (Cài đặt, in, …).
#[cfg(target_os = "windows")]
fn powershell_command() -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new("powershell");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// ESC/POS: init, bold on, body, bold off, feed, partial cut.
fn receipt_print_bytes(content: &str) -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&[0x1B, 0x40]); // ESC @ init
    bytes.extend_from_slice(&[0x1B, 0x45, 0x01]); // ESC E 1 bold on
    bytes.extend_from_slice(content.as_bytes());
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
        // Không đưa byte ESC/POS (có byte \0 trong "ESC E 0") vào dòng lệnh PowerShell —
        // Windows coi chuỗi lệnh là null-terminated nên gây lỗi "null byte found in provided data".
        // Ghi file nhị phân + winspool WritePrinter (RAW) thay cho Out-Printer.
        let bytes = receipt_print_bytes(content);
        let temp = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let id = format!("{}_{stamp}", std::process::id());
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
            let detail = format!("{stderr}{stdout}").trim().to_string();
            return Err(if detail.is_empty() {
                "Lệnh in máy in hệ thống thất bại.".to_string()
            } else {
                format!("Lệnh in máy in hệ thống thất bại: {detail}")
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
