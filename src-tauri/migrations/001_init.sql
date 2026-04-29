CREATE TABLE phong (
    phong_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ten_phong TEXT NOT NULL,
    tien_gio REAL NOT NULL,
    trang_thai TEXT DEFAULT 'TRONG' CHECK (trang_thai IN ('TRONG', 'DANG_HOAT_DONG'))
);

CREATE TABLE nhom_san_pham (
    nhom_san_pham_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nhom_san_pham_cha_id INTEGER NULL,
    ten_nhom TEXT NOT NULL,
    FOREIGN KEY (nhom_san_pham_cha_id) REFERENCES nhom_san_pham(nhom_san_pham_id) ON DELETE SET NULL
);

CREATE TABLE san_pham (
    san_pham_id TEXT PRIMARY KEY,
    nhom_san_pham_id INTEGER NULL,
    ten_san_pham TEXT NOT NULL,
    don_vi_tinh TEXT NOT NULL,
    don_gia REAL NOT NULL,
    FOREIGN KEY (nhom_san_pham_id) REFERENCES nhom_san_pham(nhom_san_pham_id) ON DELETE SET NULL
);

CREATE TABLE lich_su_phong (
    lich_su_phong_id INTEGER PRIMARY KEY AUTOINCREMENT,
    phong_id INTEGER NOT NULL,
    gio_bat_dau DATETIME DEFAULT CURRENT_TIMESTAMP,
    gio_ket_thuc DATETIME NULL,
    tien_gio REAL NOT NULL,
    tong_tien_san_pham REAL DEFAULT 0,
    tong_tien_gio REAL DEFAULT 0,
    tong_tien_thanh_toan REAL DEFAULT 0,
    trang_thai TEXT DEFAULT 'DANG_PHUC_VU' CHECK (trang_thai IN ('DANG_PHUC_VU', 'DA_THANH_TOAN')),
    FOREIGN KEY (phong_id) REFERENCES phong(phong_id)
);

CREATE TABLE lich_su_phong_san_pham (
    lich_su_phong_san_pham_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lich_su_phong_id INTEGER NOT NULL,
    san_pham_id TEXT NOT NULL,
    so_luong INTEGER NOT NULL DEFAULT 1,
    don_gia REAL NOT NULL,
    FOREIGN KEY (lich_su_phong_id) REFERENCES lich_su_phong(lich_su_phong_id) ON DELETE CASCADE,
    FOREIGN KEY (san_pham_id) REFERENCES san_pham(san_pham_id),
    UNIQUE (lich_su_phong_id, san_pham_id)
);
