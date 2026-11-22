CREATE TABLE IF NOT EXISTS cai_dat_in (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    printer_target TEXT NOT NULL DEFAULT '',
    print_qr_on_receipt INTEGER NOT NULL DEFAULT 1,
    qr_use_fixed_amount INTEGER NOT NULL DEFAULT 0,
    qr_fixed_amount_vnd INTEGER NOT NULL DEFAULT 0,
    selected_qr_thanh_toan_id INTEGER NULL,
    FOREIGN KEY (selected_qr_thanh_toan_id) REFERENCES qr_thanh_toan(qr_thanh_toan_id) ON DELETE SET NULL
);

INSERT INTO cai_dat_in (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM cai_dat_in WHERE id = 1);
