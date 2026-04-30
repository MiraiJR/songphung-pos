//! Fixed-width receipt lines for 80mm thermal printer.

pub const RECEIPT_WIDTH: usize = 42;

/// Width for large-font payment summary lines (fewer chars fit at bigger font).
const LARGE_WIDTH: usize = 30;

/// Prefix that tells the print script to use larger font for this line.
const LARGE_MARKER: &str = "@@LARGE@@";

pub fn line_sep() -> String {
    "-".repeat(RECEIPT_WIDTH) + "\n"
}

fn center_one(line: &str, width: usize) -> String {
    let lc = line.chars().count();
    if lc >= width {
        return line.chars().take(width).collect();
    }
    let pad = width - lc;
    let left = pad / 2;
    format!("{}{}{}", " ".repeat(left), line, " ".repeat(pad - left))
}

pub fn lines_wrapped_centered(text: &str) -> String {
    let lines: Vec<String> = wrap_words(text, RECEIPT_WIDTH)
        .into_iter()
        .map(|l| center_one(&l, RECEIPT_WIDTH))
        .collect();
    if lines.is_empty() {
        return String::new();
    }
    lines.join("\n") + "\n"
}

fn wrap_words(text: &str, width: usize) -> Vec<String> {
    if width == 0 {
        return vec![];
    }
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut out: Vec<String> = Vec::new();
    let mut current = String::new();

    for word in words {
        let wlen = word.chars().count();
        if wlen > width {
            if !current.is_empty() {
                out.push(std::mem::take(&mut current));
            }
            let chars: Vec<char> = word.chars().collect();
            let mut i = 0;
            while i < chars.len() {
                let end = (i + width).min(chars.len());
                out.push(chars[i..end].iter().collect());
                i = end;
            }
            continue;
        }
        let add_len = if current.is_empty() {
            wlen
        } else {
            current.chars().count() + 1 + wlen
        };
        if add_len <= width {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        } else {
            out.push(std::mem::take(&mut current));
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

pub fn line_two_cols(left: &str, right: &str) -> String {
    let half = RECEIPT_WIDTH / 2;
    let l: String = left.chars().take(half).collect();
    let r: String = right.chars().take(half).collect();
    format!("{:<half$}{:>half$}\n", l, r, half = half)
}

/// Payment summary line — printed with LARGE font.
/// Uses `@@LARGE@@` prefix so the print script switches to bigger font.
pub fn line_total(label: &str, value: &str) -> String {
    const VALUE_W: usize = 12;
    let lb_w = LARGE_WIDTH.saturating_sub(VALUE_W + 1);
    let lb: String = label.chars().take(lb_w).collect();
    let rv: String = value.chars().take(VALUE_W).collect();
    format!(
        "{}{:<lb_w$} {:>VALUE_W$}\n",
        LARGE_MARKER, lb, rv,
        lb_w = lb_w,
        VALUE_W = VALUE_W,
    )
}

pub fn line_item_header() -> String {
    format!(
        "{:<19} {:>3} {:>8} {:>8}\n",
        "Mặt hàng", "SL", "Đ.GIÁ", "T.TIỀN"
    )
}

pub fn lines_item_row(name: &str, qty: i64, dgia: &str, ttien: &str) -> String {
    let suffix = format!(" {:>3} {:>8} {:>8}", qty, dgia, ttien);
    let name_budget = RECEIPT_WIDTH.saturating_sub(suffix.chars().count());
    let chars: Vec<char> = name.chars().collect();
    let mut out = String::new();
    let first: String = chars.iter().take(name_budget).collect();
    let consumed = first.chars().count();
    let padded = format!("{:<width$}", first, width = name_budget);
    out.push_str(&format!("{}{}\n", padded, suffix));

    let mut i = consumed;
    while i < chars.len() {
        let chunk: String = chars[i..].iter().take(RECEIPT_WIDTH).collect();
        let n = chunk.chars().count();
        i += n;
        out.push_str(&format!("{}\n", chunk));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_total_never_exceeds_large_width() {
        for (label, value) in [
            ("TỔNG CỘNG:", "425,000"),
            ("TIỀN GIỜ:", "165,000"),
            ("TIỀN MẶT (đ):", "1,234,567"),
        ] {
            let line = line_total(label, value);
            let row = line
                .trim_start_matches(LARGE_MARKER)
                .trim_end_matches('\n');
            assert!(
                row.chars().count() <= LARGE_WIDTH,
                "len {} for {:?}",
                row.chars().count(),
                row
            );
        }
    }

    #[test]
    fn item_row_fits_receipt_width() {
        let row = lines_item_row("BIA QUY NHƠN", 12, "14,000", "168,000");
        let first_line = row.lines().next().unwrap();
        assert!(
            first_line.chars().count() <= RECEIPT_WIDTH,
            "len {} > {}: {:?}",
            first_line.chars().count(),
            RECEIPT_WIDTH,
            first_line
        );
    }
}
