import { NavLink } from "react-router-dom";

export function AppHeader() {
  const items = [
    { label: "POS", to: "/" },
    { label: "Phòng", to: "/admin/rooms" },
    { label: "Sản phẩm", to: "/admin/products" },
    { label: "Nhóm SP", to: "/admin/categories" },
    { label: "Lịch sử", to: "/admin/history" },
    { label: "Cài đặt", to: "/admin/settings" },
  ];
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Song Phụng" className="h-8 w-auto rounded" />
        <h1 className="text-xl font-bold text-primary">Song Phụng</h1>
      </div>
      <nav className="flex gap-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`
            }
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
