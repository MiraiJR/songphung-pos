use image::GrayImage;

/// ESC/POS raster (GS v 0), suitable for 80mm printers (width capped).
pub fn png_to_esc_pos_gs_v0(png_bytes: &[u8], max_width_dots: u32) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Không đọc được ảnh QR: {e}"))?;
    let gray = img.to_luma8();
    let (gw, gh) = gray.dimensions();
    if gw == 0 || gh == 0 {
        return Err("Ảnh QR không hợp lệ.".to_string());
    }
    let target_w = max_width_dots.min(gw).max(1);
    let scale = target_w as f32 / gw as f32;
    let tw = ((gw as f32 * scale).round() as u32).max(1).min(max_width_dots);
    let th = ((gh as f32 * scale).round() as u32).max(1);

    let resized = if tw != gw || th != gh {
        image::imageops::resize(&gray, tw, th, image::imageops::FilterType::Triangle)
    } else {
        gray
    };

    raster_gs_v0(&resized)
}

fn raster_gs_v0(gray: &GrayImage) -> Result<Vec<u8>, String> {
    let width_dots = gray.width();
    let height_dots = gray.height();
    let width_bytes_u32 = (width_dots + 7) / 8;

    let mut raster = Vec::new();
    for y in 0..height_dots {
        for bx in 0..width_bytes_u32 {
            let mut byte = 0u8;
            for bit in 0..8u32 {
                let x = bx * 8 + bit;
                let black = if x < width_dots {
                    gray.get_pixel(x, y)[0] < 140
                } else {
                    false
                };
                if black {
                    byte |= 0x80 >> bit;
                }
            }
            raster.push(byte);
        }
    }

    let x_l = (width_bytes_u32 & 0xFF) as u8;
    let x_h = ((width_bytes_u32 >> 8) & 0xFF) as u8;
    let y_l = (height_dots & 0xFF) as u8;
    let y_h = ((height_dots >> 8) & 0xFF) as u8;

    let mut out = Vec::with_capacity(8 + raster.len());
    out.extend_from_slice(&[0x1D, 0x76, 0x30, 0x00, x_l, x_h, y_l, y_h]);
    out.extend_from_slice(&raster);
    Ok(out)
}
