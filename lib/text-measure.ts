// Canvas text measurement for the month grid: cell heights are computed in px before
// the browser lays the text out, so a wrapped title has to be predicted, not observed.

const widths = new Map<string, number>();
let context: CanvasRenderingContext2D | null | undefined;

function getContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context;
  try {
    context = document.createElement("canvas").getContext("2d");
  } catch {
    context = null;
  }
  return context;
}

function measure(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  const key = `${font}\u0000${text}`;
  const cached = widths.get(key);
  if (cached !== undefined) return cached;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  widths.set(key, width);
  return width;
}

const families = new Map<string, string>();

/** Reads a family once per page; `variable` is a CSS custom property such as `--font-mono`. */
function fontFamily(variable: string | null, fallback: string): string {
  const key = variable ?? "";
  const cached = families.get(key);
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return fallback;
  const style = getComputedStyle(document.body);
  const family = (variable ? style.getPropertyValue(variable) : style.fontFamily).trim();
  const resolved = family || fallback;
  families.set(key, resolved);
  return resolved;
}

/** A CSS font shorthand for a cell line, using whatever family the page renders in. */
export function cellFont(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${fontFamily(null, "sans-serif")}`;
}

export function cellMonoFont(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${fontFamily("--font-mono", "ui-monospace, monospace")}`;
}

/** Width of `text` in `font`, or 0 without a canvas. */
export function textWidth(text: string, font: string): number {
  const ctx = getContext();
  return ctx ? measure(ctx, font, text) : 0;
}

/**
 * How many lines `text` needs at `maxWidth`, capped at `maxLines`. Mirrors the CSS the chips
 * use: wrap at spaces, break an overlong word. Without a canvas (SSR) it reports one line,
 * which is the non-wrapping layout and therefore never over-reserves.
 */
export function countWrappedLines(
  text: string,
  font: string,
  maxWidth: number,
  maxLines: number
): number {
  const trimmed = text.trim();
  if (!trimmed || maxLines <= 1 || maxWidth <= 0) return 1;
  const ctx = getContext();
  if (!ctx) return 1;
  if (measure(ctx, font, trimmed) <= maxWidth) return 1;

  const space = measure(ctx, font, " ");
  let lines = 1;
  let used = 0;
  for (const word of trimmed.split(/\s+/)) {
    const width = measure(ctx, font, word);
    const next = used === 0 ? width : used + space + width;
    if (used > 0 && next > maxWidth) {
      lines++;
      if (lines >= maxLines) return maxLines;
      used = width;
    } else {
      used = next;
    }
    if (used > maxWidth) {
      const broken = Math.ceil(used / maxWidth) - 1;
      lines += broken;
      if (lines >= maxLines) return maxLines;
      used -= broken * maxWidth;
    }
  }
  return Math.min(lines, maxLines);
}
