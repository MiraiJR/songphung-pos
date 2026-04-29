export const COLOR_SYSTEM = {
  brand: {
    primary: "#0F4C5C",
    primaryDark: "#0B3945",
    primarySoft: "#EBF4F6",
    secondary: "#10B981",
    secondaryDark: "#059669",
    tertiary: "#F87171",
    tertiaryDark: "#BE123C",
  },
  neutral: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    400: "#94A3B8",
    600: "#475569",
    800: "#1F2937",
  },
  semantic: {
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#BE123C",
    info: "#0F4C5C",
  },
} as const;

export type ColorSystem = typeof COLOR_SYSTEM;
