//! Fixed-width (48 chars) receipt lines for 80mm thermal; avoids driver word-wrap.

pub const RECEIPT_WIDTH: usize = 48;

pub fn line_sep() -> String {
    "-".repeat(RECEIPT_WIDTH) + "\n"
}

fn center_one(line: &str) -> String {
    let lc = line.chars().count();
    if lc >= RECEIPT_WIDTH {
        return line.chars().take(RECEIPT_WIDTH).collect();
    }
    let pad = RECEIPT_WIDTH - lc;
    let left = pad / 2;
    let right = pad - left;
    format!("{}{}{}", " ".repeat(left), line, " ".repeat(right))
}

pub fn lines_wrapped_centered(text: &str) -> String {
    let lines: Vec<String> = wrap_words(text, RECEIPT_WIDTH)
        .into_iter()
        .map(|l| center_one(&l))
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

/// Left column up to 24 chars, right column right-aligned in last 24 chars.
pub fn line_two_cols(left: &str, right: &str) -> String {
    let l: String = left.chars().take(24).collect();
    let r: String = right.chars().take(24).collect();
    format!("{:<24}{:>24}\n", l, r)
}

/// Label left, value right; total visual length never exceeds `RECEIPT_WIDTH`.
/// (Avoid `gap.max(1)` which could produce 49 columns and force the printer to wrap mid-amount.)
pub fn line_total(label: &str, value: &str) -> String {
    let vl = value.chars().count();
    let reserve = if label.is_empty() || value.is_empty() {
        0
    } else {
        1
    };
    let max_label = RECEIPT_WIDTH.saturating_sub(vl + reserve);
    let lb: String = label.chars().take(max_label).collect();
    let used = lb.chars().count();
    let gap = RECEIPT_WIDTH.saturating_sub(used + vl);
    format!("{}{}{}\n", lb, " ".repeat(gap), value)
}

/// Table header: name area 23 + numeric columns.
pub fn line_item_header() -> String {
    format!(
        "{:<23} {:>4} {:>8} {:>10}\n",
        "Mặt hàng", "SL", "Đ.GIÁ", "T.TIỀN"
    )
}

/// First line: up to 23 chars of name + fixed numeric columns; continuation lines full width.
pub fn lines_item_row(name: &str, qty: i64, dgia: &str, ttien: &str) -> String {
    let suffix = format!(" {:>4} {:>8} {:>10}", qty, dgia, ttien);
    let name_budget = RECEIPT_WIDTH - 25;
    let chars: Vec<char> = name.chars().collect();
    let mut out = String::new();
    let first: String = chars.iter().take(name_budget).collect();
    let consumed = first.chars().count();
    out.push_str(&format!("{:<23}{}\n", first, suffix));

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
    fn line_total_never_exceeds_receipt_width() {
        for (label, value) in [
            ("TỔNG CỘNG:", "425,000"),
            ("TIỀN GIỜ (tạm tính):", "165,000"),
            ("TIỀN MẶT (đ):", "1,234,567"),
            ("X", "99,999,999"),
        ] {
            let line = line_total(label, value);
            let row = line.trim_end_matches('\n');
            assert!(
                row.chars().count() <= RECEIPT_WIDTH,
                "len {} for {:?}",
                row.chars().count(),
                row
            );
        }
    }
}
