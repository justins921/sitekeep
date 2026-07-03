/**
 * Brand-color helpers for the white-label dashboard. brand_color is chosen per
 * agency at runtime, so we compute readable pairings rather than relying on
 * static Tailwind classes.
 */

const INK = "#0e213d";
const WHITE = "#ffffff";

export function normalizeHex(input: string | null | undefined): string {
  const v = (input ?? "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
  if (/^#([0-9a-fA-F]{3})$/.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  }
  return "#0068ff"; // fall back to the SiteKeep brand blue when invalid
}

function toRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Relative luminance (0 = black, 1 = white) per WCAG. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Foreground (white or ink) that stays legible on the given background. */
export function readableText(bgHex: string): string {
  return luminance(bgHex) > 0.55 ? INK : WHITE;
}

/**
 * A version of the brand color safe to use as text/icon accents on a white
 * surface. Very light brand colors would be invisible, so fall back to ink.
 */
export function safeAccent(hex: string): string {
  return luminance(hex) > 0.7 ? INK : normalizeHex(hex);
}

/** rgba() form of the brand color for subtle tints/borders. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
