# Song Phung Karaoke Management

Desktop app quan ly karaoke xay dung voi:

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui + Zustand
- Backend: Rust + Tauri v2
- Database: SQLite + `sqlx`

## 1) Yeu cau cai dat

Can co san:

- [Bun](https://bun.sh/)
- [Rust](https://rustup.rs/)
- Tauri prerequisites theo OS: [Tauri Prerequisites](https://tauri.app/start/prerequisites/)

Kiem tra nhanh:

```bash
bun --version
rustc --version
cargo --version
```

## 2) Cai dependencies

Tai root project:

```bash
bun install
```

## 3) Chay app development

```bash
bun tauri dev
```

Lenh nay se:

- Chay Vite dev server
- Build/chay Rust backend Tauri
- Mo cua so desktop app

## 4) Migration SQLite

Migration nam trong:

- `src-tauri/migrations/001_init.sql`

Migration duoc chay tu dong khi app start trong `DbState::new()` bang:

- `sqlx::migrate!().run(&pool).await`

Ban khong can chay migration bang tay trong quy trinh dev thong thuong.

## 5) Database path mac dinh

Neu khong set `DATABASE_URL`, app se tao DB ngoai source code de tranh vong lap rebuild:

- Windows: `%APPDATA%/songphung/songphung.db`
- macOS/Linux fallback: `$HOME/.local/share/songphung/songphung.db`

Override bang env:

```bash
DATABASE_URL="sqlite:///absolute/path/songphung.db" bun tauri dev
```

## 6) In hoa don (ESC/POS qua TCP)

Checkout co ho tro goi in qua network socket.

Set dia chi may in:

```bash
PRINTER_ADDR="192.168.1.100:9100" bun tauri dev
```

Neu khong set, mac dinh:

- `127.0.0.1:9100`

## 7) Build production

```bash
bun run build
bun tauri build
```

## 8) Routes hien tai

- POS: `/`
- Admin Rooms: `/admin/rooms`
- Admin Products: `/admin/products`
- Admin History: `/admin/history`

Luu y: app desktop dang dung `HashRouter` de tuong thich Tauri.

## 9) Troubleshooting

### App bi rebuild lien tuc khi `tauri dev`

Nguyen nhan thuong gap: file SQLite (`.db-shm`, `.db-wal`) nam trong folder duoc watcher theo doi.

Trang thai hien tai cua project da fix bang cach luu DB ra ngoai `src-tauri`.

Neu ban tung tao DB cu trong `src-tauri`, co the xoa:

```bash
rm -f src-tauri/songphung.db src-tauri/songphung.db-shm src-tauri/songphung.db-wal
```

Sau do chay lai:

```bash
bun tauri dev
```
