export type FontStyle = "reference" | "sans" | "serif";
export type TextPreferences = Readonly<{ style: FontStyle; size: number; bold: boolean | null; italic: boolean }>;
export type FontPreferences = Readonly<{ names: TextPreferences; ui: TextPreferences }>;

export const FONT_STYLES = Object.freeze([
  Object.freeze({ id: "reference" as const, label: "原版黑體" }),
  Object.freeze({ id: "sans" as const, label: "系統黑體" }),
  Object.freeze({ id: "serif" as const, label: "宋體" }),
]);

export const DEFAULT_FONT_PREFERENCES: FontPreferences = Object.freeze({
  names: Object.freeze({ style: "reference", size: 17, bold: true, italic: false }),
  ui: Object.freeze({ style: "reference", size: 100, bold: null, italic: false }),
});

function textPreferences(value: unknown, target: "names" | "ui"): TextPreferences {
  const fallback = DEFAULT_FONT_PREFERENCES[target];
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const minimum = target === "names" ? 14 : 85;
  const maximum = target === "names" ? 20 : 125;
  const size = typeof record.size === "number" && Number.isFinite(record.size) ? Math.round(Math.min(maximum, Math.max(minimum, record.size))) : fallback.size;
  return Object.freeze({
    style: FONT_STYLES.some(style => style.id === record.style) ? record.style as FontStyle : fallback.style,
    size,
    bold: typeof record.bold === "boolean" ? record.bold : fallback.bold,
    italic: typeof record.italic === "boolean" ? record.italic : fallback.italic,
  });
}

export function normalizeFontPreferences(value: unknown): FontPreferences {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.freeze({ names: textPreferences(record.names, "names"), ui: textPreferences(record.ui, "ui") });
}

const families = Object.freeze({
  reference: '"Bosswatch Boss Names", "Microsoft JhengHei", sans-serif',
  sans: '"Microsoft JhengHei", "PingFang TC", system-ui, sans-serif',
  serif: '"Noto Serif TC", "PMingLiU", "Songti TC", serif',
});

export function fontPreferencePresentation(value: FontPreferences) {
  const preferences = normalizeFontPreferences(value);
  const ui = preferences.ui;
  const customized = JSON.stringify(preferences) !== JSON.stringify(DEFAULT_FONT_PREFERENCES);
  return {
    style: {
      "--user-name-family": families[preferences.names.style],
      "--user-name-size": `${preferences.names.size}px`,
      "--user-name-weight": preferences.names.bold ? 800 : 400,
      "--user-name-style": preferences.names.italic ? "italic" : "normal",
      "--user-ui-family": families[ui.style],
      "--user-ui-scale": ui.size / 100,
      "--user-ui-weight": ui.bold ? 800 : 400,
      "--user-ui-style": ui.italic ? "italic" : "normal",
    },
    attributes: {
      "data-typography-custom": customized ? "true" : undefined,
      "data-ui-font-custom": ui.style !== "reference" || ui.bold !== null ? "true" : undefined,
      "data-ui-size-custom": ui.size !== 100 ? "true" : undefined,
      "data-ui-weight-custom": ui.bold !== null ? "true" : undefined,
      "data-ui-italic-custom": ui.italic ? "true" : undefined,
    },
  };
}
