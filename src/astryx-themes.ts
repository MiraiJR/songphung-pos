/**
 * Song Phụng theme: Neutral + larger type scale for POS readability.
 * CSS for Neutral still loads from index.css (cascade layer order).
 */
import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

/** Base 16px (Astryx default is 14px) — toàn app dễ đọc hơn trên màn hình POS. */
const songphungTheme = defineTheme({
  name: "songphung",
  extends: neutralTheme,
  typography: {
    scale: {
      base: 16,
      ratio: 1.2,
    },
  },
});

export const themes = {
  songphung: songphungTheme,
  neutral: neutralTheme,
} as const;

export type ThemeSlug = keyof typeof themes;

export const defaultThemeSlug: ThemeSlug = "songphung";
