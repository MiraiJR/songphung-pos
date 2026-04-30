# BÀI TOÁN TỔNG QUAN: PHẦN MỀM QUẢN LÝ KARAOKE "SONG PHỤNG"

**Tech Stack:**
- **Frontend:** React, TypeScript, Bun, TailwindCSS, Shadcn UI, Zustand (quản lý state).
- **Backend/Core:** Rust, Tauri (Desktop packaging).
- **Database:** SQLite (Lưu trữ local - `sqlite3`).
- **DB Interaction:** `sqlx` (Rust) hoặc `SeaORM`.
- **Printer Integration:** Giao thức ESC/POS (tương thích XPrinter).

---

## 1. CẤU TRÚC THƯ MỤC DỰ ÁN (Project Structure)

```text
song-phung-karaoke/
├── src/                    # Frontend (React)
│   ├── components/         # Reusable UI components (Shadcn)
│   ├── features/           # Chứa logic theo từng domain
│   │   ├── pos/            # Màn hình chính (Left, Center, Right panels)
│   │   ├── rooms/          # CRUD phòng
│   │   ├── products/       # CRUD sản phẩm & nhóm
│   │   └── history/        # Xem lịch sử hóa đơn
│   ├── hooks/              # Custom hooks (gọi Tauri IPC commands)
│   ├── store/              # Zustand stores (Global state cho POS)
│   ├── types/              # TypeScript interfaces/types
│   └── App.tsx             # Main routing & Layout
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── commands/       # Tauri IPC commands (expose cho Frontend gọi)
│   │   ├── database/       # Logic kết nối SQLite, migrations
│   │   ├── models/         # Rust structs map với DB
│   │   ├── printer/        # Module xử lý in ấn ESC/POS
│   │   └── main.rs         # Entry point, setup Tauri
│   ├── migrations/         # Chứa file SQL tạo bảng
│   └── tauri.conf.json     # Cấu hình app (window size, permissions)
└── package.json            # Bun config
```

---

## 2. THIẾT KẾ DATABASE (SQLite Schema)

Tạo một file migration `001_init.sql` trong thư mục `migrations` của Rust:

```sql
-- Bảng Phong
CREATE TABLE phong (
    phong_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ten_phong TEXT NOT NULL,
    tien_gio REAL NOT NULL,
    trang_thai TEXT DEFAULT 'TRONG' CHECK (trang_thai IN ('TRONG', 'DANG_HOAT_DONG'))
);

-- Bảng Nhom San Pham
CREATE TABLE nhom_san_pham (
    nhom_san_pham_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nhom_san_pham_cha_id INTEGER NULL,
    ten_nhom TEXT NOT NULL,
    FOREIGN KEY (nhom_san_pham_cha_id) REFERENCES nhom_san_pham(nhom_san_pham_id) ON DELETE SET NULL
);

-- Bảng San Pham
CREATE TABLE san_pham (
    san_pham_id TEXT PRIMARY KEY, -- Mã user tự nhập (VD: BIA01, NUOC02)
    nhom_san_pham_id INTEGER NULL,
    ten_san_pham TEXT NOT NULL,
    don_vi_tinh TEXT NOT NULL,
    don_gia REAL NOT NULL,
    FOREIGN KEY (nhom_san_pham_id) REFERENCES nhom_san_pham(nhom_san_pham_id) ON DELETE SET NULL
);

-- Bảng Lich Su Phong (Bill/Order)
CREATE TABLE lich_su_phong (
    lich_su_phong_id INTEGER PRIMARY KEY AUTOINCREMENT,
    phong_id INTEGER NOT NULL,
    gio_bat_dau DATETIME DEFAULT CURRENT_TIMESTAMP,
    gio_ket_thuc DATETIME NULL,
    tien_gio REAL NOT NULL, -- Sync từ phong
    tong_tien_san_pham REAL DEFAULT 0,
    tong_tien_gio REAL DEFAULT 0,
    tong_tien_thanh_toan REAL DEFAULT 0,
    trang_thai TEXT DEFAULT 'DANG_PHUC_VU' CHECK(trang_thai IN ('DANG_PHUC_VU', 'DA_THANH_TOAN')),
    FOREIGN KEY (phong_id) REFERENCES phong(phong_id)
);

-- Bảng Lich Su Phong San Pham (Order Details)
CREATE TABLE lich_su_phong_san_pham (
    lich_su_phong_san_pham_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lich_su_phong_id INTEGER NOT NULL,
    san_pham_id TEXT NOT NULL,
    so_luong INTEGER NOT NULL DEFAULT 1,
    don_gia REAL NOT NULL, -- Sync tại thời điểm gọi
    FOREIGN KEY (lich_su_phong_id) REFERENCES lich_su_phong(lich_su_phong_id) ON DELETE CASCADE,
    FOREIGN KEY (san_pham_id) REFERENCES san_pham(san_pham_id),
    UNIQUE(lich_su_phong_id, san_pham_id) -- Tránh duplicate, update số lượng nếu trùng
);
```

---

## 3. THIẾT KẾ UI/UX (Frontend Layout)

Màn hình chính (POS) sử dụng Flexbox hoặc CSS Grid chia làm 3 phần:

### Layout 3 Panels
* **Panel Left (Width: 30% - Hóa đơn hiện tại):**
    * **Header:** `[Tên Phòng] - [Trạng thái]` | Bắt đầu: `[HH:mm]` | Đã hát: `[X giờ Y phút]`. (Dùng `setInterval` mỗi phút để update UI).
    * **Body (Scrollable):** Danh sách món (Tên, Số lượng, Đơn giá, Thành tiền). Mỗi item có icon `Edit` và `Trash`.
    * **Footer:** * Nút nhỏ: `[Chuyển phòng]`
        * Tổng tiền món: `XXX`
        * Tổng tiền giờ (tạm tính): `YYY`
        * **Thành tiền: `XXX + YYY`**
        * Hai nút lớn: `[Trả Phòng] (Màu xám/đỏ)` và `[Thanh Toán] (Màu xanh)`.
* **Panel Center (Width: 50% - Menu món):**
    * **Header:** Tabs/Pills hiển thị danh mục (`Nhóm sản phẩm`). Có ô Search.
    * **Body:** Grid các thẻ `ProductCard` (A-Z). Mỗi thẻ gồm Tên món, Đơn giá.
* **Panel Right (Width: 20% - Danh sách phòng):**
    * Grid chứa các `RoomCard`.
    * Màu sắc: Đỏ (TRỐNG), Xanh (ĐANG HOẠT ĐỘNG). 
    * Hiển thị thông tin tóm tắt trên Card: Tên phòng, Thời gian đã hát (nếu đang hoạt động).

---

## 4. CHI TIẾT LOGIC CÁC TÍNH NĂNG (Hướng dẫn cho Cursor)

### Feature 1: Đặt bàn (Start Room)
* **Trigger:** Double click vào `RoomCard` ở Right Panel có trạng thái `TRONG`.
* **Rust IPC Command:** `invoke('start_room', { roomId })`
* **Logic (Backend):**
    1. Update `phong` -> `trang_thai = 'DANG_HOAT_DONG'`.
    2. Lấy `tien_gio` hiện tại của phòng.
    3. Insert 1 record mới vào `lich_su_phong` với `gio_bat_dau = NOW()`, `tien_gio = ...`, `trang_thai = 'DANG_PHUC_VU'`.
* **Frontend Action:** Cập nhật lại list phòng, select phòng vừa mở lên Panel Left.

### Feature 2: Gọi món (Order Items)
* **Trigger:** Click vào phòng ở Right Panel (để đưa data lên Left Panel) -> Click vào `ProductCard` ở Center.
* **Modal Numpad:** Hiện modal kèm input và lưới phím số (giống máy tính cầm tay).
* **Logic (Frontend -> Backend):**
    * Nếu số lượng `> 0`: Gọi IPC `invoke('add_or_update_order_item', { historyId, productId, qty, price })`.
    * Nếu số lượng `== 0`: Gọi IPC `invoke('remove_order_item', { historyId, productId })`.
    * Rust Backend sẽ dùng `INSERT ON CONFLICT` (vì đã setup UNIQUE constraints ở DB) hoặc `UPDATE` nếu đã tồn tại món.
* **Chỉnh sửa:** Click vào icon Edit trên Left Panel -> Mở lại Modal Numpad.

### Feature 3: Trả phòng (Cancel Room / Hủy Bill)
* **Trigger:** Click nút "Trả phòng" trên Left Panel.
* **Confirm:** Modal hỏi "Bạn có chắc chắn muốn hủy phòng này? Dữ liệu gọi món sẽ bị xóa."
* **Rust IPC Command:** `invoke('cancel_room', { historyId, roomId })`
* **Logic (Backend):**
    1. Delete khỏi `lich_su_phong_san_pham` (SQLite cascade sẽ lo việc này nếu xóa record cha, nhưng gọi explictly cho an toàn).
    2. Delete khỏi `lich_su_phong`.
    3. Update `phong` -> `trang_thai = 'TRONG'`.

### Feature 4: Thanh toán hóa đơn (Checkout)
* **Trigger:** Click nút "Thanh Toán".
* **Modal Checkout:** Hiện bảng tổng kết. Cho phép User gõ giá trị custom vào field "Thành tiền" (để làm tròn hoặc giảm giá). Có Checkbox `[x] In hóa đơn`.
* **Luồng xác nhận bắt buộc:** Click "Thanh toán" phải mở modal trước, chỉ khi User nhấn "Xác nhận thanh toán" mới thực hiện checkout.
* **Calculation Rule:** * `Thời gian hát` = (Time hiện tại - gio_bat_dau) -> Quy ra phút.
    * `Tiền giờ` = Math.ceil((Phút * tien_gio) / 60) -> *Làm tròn lên theo yêu cầu*.
* **Rust IPC Command:** `invoke('checkout_room', { historyId, roomId, endTime, totalItems, totalTime, finalAmount, printReceipt: boolean })`
* **Logic (Backend):**
    1. Update `lich_su_phong` với các thông tin thanh toán, chuyển trạng thái thành `DA_THANH_TOAN`.
    2. Update `phong` -> `trang_thai = 'TRONG'`.
    3. Nếu `printReceipt == true`, gọi thẳng hàm in (Feature 5).

### Feature 5: In hóa đơn (ESC/POS Printer)
* **Tiếp cận:** Sử dụng thư viện Rust. Crate khuyên dùng: **`escpos`** hoặc **`printer-pos`**. Nếu dùng kết nối USB trên Windows có thể phức tạp, ưu tiên kết nối máy in qua **Network (TCP/IP)** hoặc Share Printer qua driver của Windows rồi bắn raw data.
* **Kiểm tra kết nối trước khi in (BẮT BUỘC):**
    1. Khi User tick `[x] In hóa đơn` trong modal thanh toán, frontend gọi IPC `invoke('check_printer_connection')`.
    2. Nếu kết nối thành công: hiển thị trạng thái xanh "Đã kết nối máy in".
    3. Nếu thất bại: hiển thị trạng thái đỏ + hướng dẫn "Bỏ chọn In hóa đơn để tiếp tục thanh toán".
    4. Khi User bấm "Xác nhận thanh toán" và vẫn đang tick in hóa đơn, frontend phải kiểm tra lại kết nối máy in lần cuối; nếu không kết nối thì chặn checkout.
* **Template:**
    * Header: TÊN QUÁN (Song Phụng), Địa chỉ, Ngày giờ in.
    * Info: Tên phòng, Giờ vào, Giờ ra.
    * Table món: Tên món - SL - Đơn giá - Thành tiền (Căn đều trái phải).
    * Footer: Tiền giờ, Tổng cộng. Lời cảm ơn.
* **Tauri Logic:** Render template bằng Rust format string, convert sang byte array ESC/POS và đẩy qua TCP socket (ví dụ `192.168.1.100:9100`) của máy XPrinter.

### Feature 6, 7 & 8: CRUD Quản trị (Phòng, Sản phẩm & Nhóm sản phẩm)
* **UI:** Nằm ở các View riêng (Routing: `/admin/rooms`, `/admin/products`, `/admin/categories`).
* **Components:** Dùng DataTable của Shadcn (dựa trên TanStack Table) cho xịn và dễ filter/sort.
* **Forms:** Dùng `react-hook-form` + `zod` để validate. (Bắt buộc validate mã sản phẩm không trùng lặp khi tạo mới).
* **Riêng Nhóm sản phẩm (Feature 8):** Do có cấu trúc `nhom_san_pham_cha_id`, UI trong form tạo/sửa cần có Combobox để chọn nhóm cha. Backend cần validate không cho phép xóa nhóm nếu đang có sản phẩm hoặc nhóm con phụ thuộc.

### Feature 9: Chuyển phòng (Room Transfer)
* **Trigger:** Nhấn nút `[Chuyển phòng]` trên Panel Left (chỉ hiển thị khi đang focus vào phòng `DANG_HOAT_DONG`).
* **Modal Chuyển phòng:** Hiển thị danh sách các phòng hiện đang `TRONG` để người dùng lựa chọn phòng đích.
* **Rust IPC Command:** `invoke('transfer_room', { historyId, sourceRoomId, targetRoomId })`
* **Logic (Backend - BẮT BUỘC DÙNG TRANSACTION):**
    Sử dụng `sqlx::Transaction` để đảm bảo tính toàn vẹn:
    1. Update bảng `lich_su_phong`: SET `phong_id = targetRoomId` WHERE `lich_su_phong_id = historyId`.
    2. Update bảng `phong` (Nguồn): SET `trang_thai = 'TRONG'` WHERE `phong_id = sourceRoomId`.
    3. Update bảng `phong` (Đích): SET `trang_thai = 'DANG_HOAT_DONG'` WHERE `phong_id = targetRoomId`.
* **Frontend Action:** Nhận kết quả thành công -> Cập nhật lại UI Panel Right (đổi màu 2 phòng), và chuyển focus của Panel Left sang phòng đích.

### Feature 10: Quản lý lịch sử (Daily History)
* **UI:** View `/admin/history`.
* **Tính năng:** Bảng danh sách các `lich_su_phong` đã có trạng thái `DA_THANH_TOAN`. Lọc theo ngày (Date Picker). Có dòng dưới cùng tính "Tổng doanh thu trong ngày".
* **Tương tác dòng lịch sử (left click):** Left click vào 1 dòng `lich_su_phong` sẽ mở dropdown menu hành động gồm:
    1. `Xem chi tiết`
    2. `In lại hóa đơn`
* **Xem chi tiết hóa đơn:**
    * Mở modal chi tiết hóa đơn.
    * Hiển thị đầy đủ thông tin bill: mã hóa đơn, tên phòng, giờ vào, giờ ra, tiền món, tiền giờ, tổng thanh toán.
    * Hiển thị bảng danh sách món đã gọi: Tên món, Số lượng, Đơn giá, Thành tiền.
* **In lại hóa đơn:**
    * Frontend phải gọi IPC kiểm tra kết nối máy in trước: `invoke('check_printer_connection')`.
    * Nếu **không kết nối**: hiển thị lỗi trên UI và không thực hiện in.
    * Nếu **đã kết nối**: gọi IPC in lại bill: `invoke('reprint_history_bill', { historyId })`.
    * Backend render lại nội dung hóa đơn từ dữ liệu `lich_su_phong` + `lich_su_phong_san_pham`, sau đó in qua TCP socket ESC/POS.

### Feature 11: Kiểm tra & Cài đặt Máy in (Printer Setup & Test)
* **UI:** Có thể làm một Modal pop-up (Dialog) gọi từ màn hình chính (Left Panel) hoặc một View `/settings` nhỏ.
* **Tính năng (Chỉ lưu Local State):**
    * Combobox/Dropdown hiển thị danh sách các máy in đang cài đặt trên máy tính (System Printers) hoặc input để nhập IP máy in mạng.
    * Nút **[In thử / Kiểm tra kết nối]** (Không cần nút Lưu vào DB).
    * Hiển thị trạng thái kết nối trực quan: 🟢 Đã kết nối / Sẵn sàng (Kèm tên Model máy in) hoặc 🔴 Mất kết nối.
* **Rust IPC Command:**
    * `invoke('get_system_printers')` -> Trả về mảng `string[]` tên các máy in hiện có trên OS (dùng crate `printers` hoặc winapi).
    * `invoke('test_printer', { printerNameOrIp })` -> Thực hiện kết nối và bắn một lệnh ESC/POS đơn giản để in dòng chữ: *"TEST KẾT NỐI MÁY IN SONG PHỤNG... OK"* kèm tiếng cắt giấy/bíp. Trả về `Result<Ok, Error>` để Frontend xử lý Toast Notification.
* **Logic (Frontend - Zustand / LocalStorage):** * Khi người dùng test thành công và chọn một máy in, lưu tên/IP của máy in đó vào `localStorage` (thông qua Zustand middleware `persist`). 
    * Ở **Feature 4 (Thanh toán)**, khi gọi lệnh `checkout_room`, Frontend sẽ lấy giá trị máy in từ `localStorage` để truyền kèm vào IPC command cho Backend biết phải in hóa đơn ra máy nào. 
    * Mỗi lần app khởi động, trạng thái máy in sẽ tự động đọc từ `localStorage` và báo cho người dùng biết trên giao diện.

### Feature 12: In phiếu tạm tính (Print Pro-forma Invoice)
* **Mục đích:** Chỉ in hóa đơn để khách xem, không đóng phòng, không cập nhật trạng thái thanh toán.
* **Trigger:** Click nút **[In phiếu]** trên Panel Left.
* **Logic xử lý:**
    1. Frontend lấy toàn bộ thông tin hiện tại: Danh sách món, Giờ bắt đầu, Giờ hiện tại (để tính tiền giờ tạm tính).
    2. Gọi IPC Command: `invoke('print_temporary_bill', { data, printerNameOrIp })`.
    3. Backend Rust nhận data, format template tương tự hóa đơn thật nhưng có tiêu đề là **"PHIẾU TẠM TÍNH"**.
    4. Gửi lệnh tới máy in.
* **Ràng buộc:** Chỉ áp dụng cho phòng đang `DANG_HOAT_DONG`. Không thực hiện bất kỳ câu lệnh `UPDATE` nào vào Database.

### Feature 13: Import & Export CSV (với logic Upsert)
* **Giao diện:** Nằm tại `/admin/products`. Gồm 2 nút: **[Tải file mẫu]** và **[Import CSV]**.
* **Tính năng 1: Tải file mẫu (Export Template)**
    * Hệ thống tạo 2 file mẫu kèm Header và 1 dòng ví dụ để user dễ hiểu.
    * **Template `nhom_san_pham.csv`:** `nhom_san_pham_id`, `ten_nhom`, `nhom_san_pham_cha_id`
    * **Template `san_pham.csv`:** `san_pham_id`, `ten_san_pham`, `nhom_san_pham_id`, `don_vi_tinh`, `don_gia`
* **Tính năng 2: Import & Upsert (Cập nhật nếu trùng)**
    * **Xử lý Backend (Rust):**
        1. **Đọc & Validate:** Sử dụng crate `csv`. Kiểm tra các cột bắt buộc.
        2. **Logic Upsert (INSERT OR REPLACE):**
            * Đối với **Nhóm sản phẩm**: Nếu `nhom_san_pham_id` đã tồn tại, cập nhật `ten_nhom` và `nhom_san_pham_cha_id`.
            * Đối với **Sản phẩm**: Nếu `san_pham_id` đã tồn tại, tiến hành cập nhật (Update) các trường tên, đơn giá, đơn vị tính thay vì báo lỗi trùng lặp.
        3. **Ràng buộc:** Khi import sản phẩm, hệ thống phải kiểm tra `nhom_san_pham_id` có tồn tại trong bảng nhóm chưa. Nếu chưa, dòng đó sẽ bị bỏ qua và báo lỗi chi tiết.
        4. **Transaction:** Sử dụng `sqlx::Transaction` để đảm bảo nếu file có 100 dòng mà dòng 99 lỗi thì 98 dòng trước đó không bị lưu vào DB (giữ data sạch).


---

## 5. TỐI ƯU HIỆU SUẤT (Windows OS / Tauri Tips)

Khi đưa cho Cursor, hãy dặn nó lưu ý các điểm này:

1.  **Frontend State:** Không fetch lại toàn bộ database mỗi lần có người gõ món. Hãy fetch state ban đầu lúc app load, dùng Zustand để quản lý local state, và thực hiện Optimistic UI Update. Chỉ update DB ngầm ở background qua Tauri.
2.  **SQLite Connection Pool:** Trên Rust, cấu hình `sqlx` connection pool để duy trì kết nối (VD: `max_connections = 5`), không mở/đóng liên tục mỗi lần query. Bật WAL mode (`PRAGMA journal_mode=WAL;`) để app read/write mượt mà không lock DB.
3.  **Tauri Windows Build:** Khi build product, nhớ config trong `tauri.conf.json`:
    ```json
    "windows": {
      "webviewDataPath": "localAppData"
    }
    ```
    Để đảm bảo database SQLite được lưu ở đúng thư mục AppData của User trên Windows (tránh lỗi Permission Denied ở thư mục Program Files).