use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::time::Duration;

pub fn print_receipt_to_network(printer_addr: &str, content: &str) -> Result<(), String> {
    let mut stream = TcpStream::connect(printer_addr).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    bytes.extend_from_slice(content.as_bytes());
    bytes.push(0x0A);
    bytes.push(0x0A);
    bytes.extend_from_slice(&[0x1D, 0x56, 0x41, 0x10]);
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
        let output = Command::new("powershell")
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
        let escaped_content = content.replace('\'', "''");
        let escaped_printer = printer_name.replace('\'', "''");
        let script = format!(
            "$t = @'\n{escaped_content}\n'@; $t | Out-Printer -Name '{escaped_printer}'"
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Không in được tới máy in hệ thống: {e}"))?;
        if !output.status.success() {
            return Err("Lệnh in máy in hệ thống thất bại".to_string());
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut child = Command::new("lp")
            .args(["-d", printer_name, "-o", "raw"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Không gọi được lệnh lp để in: {e}"))?;
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(content.as_bytes())
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
