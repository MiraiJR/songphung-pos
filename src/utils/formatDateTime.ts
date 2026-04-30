/**
 * Convert "YYYY-MM-DD HH:MM:SS" (local-time from DB) → "DD/MM/YYYY hh:mm AM/PM"
 */
export function formatDateTime(raw: string | null | undefined): string {
  if (!raw || raw === "--") return "--";

  const [datePart, timePart] = raw.trim().split(" ");
  if (!datePart) return raw;

  const [y, m, d] = datePart.split("-");
  const formattedDate = `${d}/${m}/${y}`;

  if (!timePart) return formattedDate;

  const [hStr, min] = timePart.split(":");
  const hour = parseInt(hStr, 10);
  if (isNaN(hour)) return `${formattedDate} ${timePart}`;

  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${formattedDate} ${String(h12).padStart(2, "0")}:${min} ${ampm}`;
}
