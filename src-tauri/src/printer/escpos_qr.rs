use image::GrayImage;
use image::Luma;
use image::imageops;

/// ESC/POS raster (GS v 0): QR scaled to `qr_width_percent` of paper width, centered on full-width row.
pub fn png_to_esc_pos_gs_v0(
    png_bytes: &[u8],
    paper_width_dots: u32,
    qr_width_percent: u32,
) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory(png_bytes)
        .map_err(|e| format!("Không đọc được ảnh QR: {e}"))?;
    let gray = img.to_luma8();
    let (gw, gh) = gray.dimensions();
    if gw == 0 || gh == 0 {
        return Err("Ảnh QR không hợp lệ.".to_string());
    }

    let paper_w = paper_width_dots.max(8);
    let qr_cap = ((paper_w * qr_width_percent.min(100)) / 100).max(48).min(paper_w);

    let scale = qr_cap as f32 / gw as f32;
    let tw = ((gw as f32 * scale).round() as u32).max(1).min(qr_cap);
    let th = ((gh as f32 * scale).round() as u32).max(1);

    let resized = if tw != gw || th != gh {
        image::imageops::resize(&gray, tw, th, image::imageops::FilterType::Triangle)
    } else {
        gray
    };

    let canvas_w = paper_w.next_multiple_of(8);
    let qh = resized.height();
    let qw = resized.width();
    let off_x = (canvas_w.saturating_sub(qw)) / 2;

    let mut canvas = GrayImage::new(canvas_w, qh);
    for p in canvas.pixels_mut() {
        *p = Luma([255]);
    }
    imageops::overlay(&mut canvas, &resized, off_x as i64, 0);

    raster_gs_v0(&canvas)
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
