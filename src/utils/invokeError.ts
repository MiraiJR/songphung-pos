/** Lỗi invoke Tauri thường là object; String(err) có thể ra "[object Object]". */
export function formatInvokeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
