/** Làm tròn phần nghìn lên bước 10.000đ, giữ 3 số cuối. 104.334 → 110.334. */
export function roundUpMoney(amount: number, step = 10_000): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const whole = Math.round(amount);
  const kept = whole % 1_000;
  const head = whole - kept;
  return Math.ceil(head / step) * step + kept;
}
