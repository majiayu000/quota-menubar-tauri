use image::{ImageBuffer, ImageEncoder, Rgba, RgbaImage};

fn smooth_step(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn usage_color(used_percent: u8) -> (u8, u8, u8) {
    if used_percent >= 80 {
        (239, 68, 68)
    } else if used_percent >= 50 {
        (245, 158, 11)
    } else {
        (34, 197, 94)
    }
}

fn encode_png(img: &RgbaImage, size: u32) -> Vec<u8> {
    let mut png_bytes = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
    encoder
        .write_image(img.as_raw(), size, size, image::ExtendedColorType::Rgba8)
        .expect("failed to encode tray icon png");
    png_bytes
}

fn draw_ring(
    img: &mut RgbaImage,
    size: u32,
    outer_radius: f32,
    ring_width: f32,
    used_percent: Option<u8>,
) {
    let center = size as f32 / 2.0;
    let inner_radius = outer_radius - ring_width;
    let start_angle = -std::f32::consts::FRAC_PI_2;
    let progress_angle = used_percent.map(|pct| {
        start_angle + (2.0 * std::f32::consts::PI * (pct.min(100) as f32 / 100.0))
    });

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center + 0.5;
            let dy = y as f32 - center + 0.5;
            let dist = (dx * dx + dy * dy).sqrt();

            let inner_edge = smooth_step(inner_radius - 0.5, inner_radius + 0.5, dist);
            let outer_edge = smooth_step(outer_radius + 0.5, outer_radius - 0.5, dist);
            let ring_mask = inner_edge * outer_edge;
            if ring_mask <= 0.01 {
                continue;
            }

            let angle = dy.atan2(dx);
            let normalized = if angle < start_angle {
                angle + 2.0 * std::f32::consts::PI
            } else {
                angle
            };

            if let Some(progress_angle) = progress_angle {
                if normalized <= progress_angle {
                    let (r, g, b) = usage_color(used_percent.unwrap_or(0));
                    img.put_pixel(x, y, Rgba([r, g, b, (255.0 * ring_mask) as u8]));
                } else {
                    img.put_pixel(x, y, Rgba([110, 110, 110, (68.0 * ring_mask) as u8]));
                }
            } else {
                img.put_pixel(x, y, Rgba([120, 120, 120, (84.0 * ring_mask) as u8]));
            }
        }
    }
}

/// Generate a dual-ring tray icon.
/// Outer ring is Claude Code, inner ring is Codex.
pub fn generate_tray_icon(
    claude_percent: Option<u8>,
    codex_percent: Option<u8>,
    size: u32,
) -> Vec<u8> {
    let mut img: RgbaImage = ImageBuffer::new(size, size);
    let center = size as f32 / 2.0;

    let outer_ring_width = if size >= 44 { 4.5 } else { 2.5 };
    let inner_ring_width = if size >= 44 { 3.5 } else { 2.0 };

    draw_ring(
        &mut img,
        size,
        center - 1.5,
        outer_ring_width,
        claude_percent,
    );
    draw_ring(
        &mut img,
        size,
        center - (outer_ring_width + 6.0),
        inner_ring_width,
        codex_percent,
    );

    encode_png(&img, size)
}

#[cfg(test)]
mod tests {
    use super::generate_tray_icon;

    #[test]
    fn generate_icon_returns_png_bytes() {
        let bytes = generate_tray_icon(Some(73), Some(54), 44);
        assert!(!bytes.is_empty());
    }

    #[test]
    fn generate_icon_supports_missing_sources() {
        let bytes = generate_tray_icon(Some(73), None, 44);
        assert!(!bytes.is_empty());
    }
}
