import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

type Props = {
  value: string;
  onChange: (value: string) => void;
};

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function DatePicker({ value, onChange }: Props) {
  const selectedDate = useMemo(() => parseDateInput(value), [value]);
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  const days = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const items: Array<{ day: number; date: Date } | null> = [];
    for (let i = 0; i < startOffset; i += 1) items.push(null);
    for (let day = 1; day <= totalDays; day += 1) {
      items.push({ day, date: new Date(year, month, day) });
    }
    return items;
  }, [displayMonth]);

  const triggerLabel = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2, "0")}/${String(selectedDate.getMonth() + 1).padStart(2, "0")}/${selectedDate.getFullYear()}`
    : "Chọn ngày";

  function placePopup() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 336;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPopupPos({ top: rect.bottom + 8, left });
  }

  useEffect(() => {
    if (!open) return;
    placePopup();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onViewportChanged = () => placePopup();
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChanged);
    window.addEventListener("scroll", onViewportChanged, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChanged);
      window.removeEventListener("scroll", onViewportChanged, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-12 min-w-[230px] items-center justify-between rounded-xl border-2 border-primary/80 bg-white px-4 text-lg font-semibold text-primary shadow-sm transition hover:bg-slate-50"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              const base = selectedDate ?? new Date();
              setDisplayMonth(new Date(base.getFullYear(), base.getMonth(), 1));
              placePopup();
            }
            return next;
          });
        }}
      >
        <span>{triggerLabel}</span>
        <Calendar size={18} />
      </button>

      {open &&
        popupPos &&
        createPortal(
          <div
            ref={popupRef}
            style={{ top: popupPos.top, left: popupPos.left }}
            className="fixed z-[130] w-[336px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                onClick={() => {
                  const today = new Date();
                  onChange(toDateInputValue(today));
                  setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setOpen(false);
                }}
              >
                Hôm nay
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md p-1 hover:bg-slate-100"
                onClick={() =>
                  setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
              >
                <ChevronLeft size={16} />
              </button>
              <div className="font-semibold text-slate-800">
                {MONTH_LABELS[displayMonth.getMonth()]} {displayMonth.getFullYear()}
              </div>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-slate-100"
                onClick={() =>
                  setDisplayMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((item, idx) => {
                if (!item) return <div key={`empty-${idx}`} className="h-9" />;
                const dateValue = toDateInputValue(item.date);
                const isSelected = value === dateValue;
                return (
                  <button
                    key={dateValue}
                    type="button"
                    className={`h-9 rounded-md text-sm ${
                      isSelected ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                    }}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
