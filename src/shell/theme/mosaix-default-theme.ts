import type { ThemeManifest } from "@mosaix/contracts";

export const MOSAIX_DEFAULT_THEME: ThemeManifest = {
  type: "theme",
  id: "mosaix-default",
  name: "MosaiX Default Theme",
  version: "1.0.0",
  tokens: {
    colors: {
      primary: "#4f46e5",
      primaryHover: "#4338ca",
      secondary: "#06b6d4",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#0f172a",
      textMuted: "#64748b",
      border: "#e2e8f0",
      accent: "#8b5cf6",
      danger: "#ef4444",
      success: "#10b981",
      warning: "#f59e0b",
    },
    typography: {
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      fontSizeBase: "16px",
      fontSizeSm: "14px",
      fontSizeLg: "18px",
      fontWeightNormal: "400",
      fontWeightMedium: "500",
      fontWeightBold: "700",
      lineHeight: "1.5",
    },
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "16px",
      lg: "24px",
      xl: "32px",
    },
    radius: {
      sm: "6px",
      md: "12px",
      lg: "16px",
      full: "9999px",
    },
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    },
    motion: {
      durationFast: "150ms",
      durationNormal: "300ms",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
  },
  modes: {
    light: {
      colors: {
        background: "#f8fafc",
        surface: "#ffffff",
        text: "#0f172a",
        textMuted: "#64748b",
        border: "#e2e8f0",
      },
    },
    dark: {
      colors: {
        primary: "#6366f1",
        primaryHover: "#818cf8",
        background: "#0f172a",
        surface: "#1e293b",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        border: "#334155",
      },
    },
    "high-contrast": {
      colors: {
        primary: "#ffff00",
        primaryHover: "#ffff80",
        background: "#000000",
        surface: "#000000",
        text: "#ffffff",
        textMuted: "#ffffff",
        border: "#ffffff",
      },
    },
  },
};
