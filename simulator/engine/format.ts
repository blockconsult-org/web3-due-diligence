import type { FieldSpec } from "./fields";

/**
 * Number formatting and input parsing for the simulator, in the two site
 * locales. German is Swiss German: an apostrophe groups thousands and the
 * decimal mark is a point, though a typed comma is accepted as one.
 */

export type FormatLocale = "en" | "de";

const intlLocale: Record<FormatLocale, string> = { en: "en-US", de: "de-CH" };

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(
  locale: FormatLocale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.NumberFormat(intlLocale[locale], options);
    formatters.set(key, found);
  }
  return found;
}

/** Shown wherever a value does not exist: an undefined ratio, an empty cell. */
export const EMPTY = "–";

/** Plain number with up to `maxDigits` decimals and grouped thousands. */
export function formatNumber(
  value: number,
  locale: FormatLocale,
  maxDigits = 2,
): string {
  return formatter(locale, { maximumFractionDigits: maxDigits }).format(value);
}

/** Short form for large values: 1.25M, 340K. Values under 1,000 keep up to
 *  two decimals. */
export function formatCompact(value: number, locale: FormatLocale): string {
  if (Math.abs(value) < 1000) return formatNumber(value, locale, 2);
  return formatter(locale, {
    notation: "compact",
    maximumSignificantDigits: 3,
  }).format(value);
}

/** Decimals that keep about four significant digits for a token price. */
function priceDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0 || abs >= 100) return 2;
  if (abs >= 1) return 3;
  return Math.min(10, 3 - Math.floor(Math.log10(abs)));
}

/** A token price in USD, with enough decimals for sub-cent prices. */
export function formatPrice(value: number, locale: FormatLocale): string {
  const digits = priceDigits(value);
  return formatter(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  }).format(value);
}

/** A USD amount: compact above 10,000, whole dollars below. */
export function formatUsd(value: number, locale: FormatLocale): string {
  if (Math.abs(value) >= 10000) {
    return formatter(locale, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumSignificantDigits: 3,
    }).format(value);
  }
  return formatter(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

/** A fraction as a percentage: 0.125 → "12.5%". */
export function formatPercent(
  fraction: number,
  locale: FormatLocale,
  maxDigits = 1,
): string {
  return formatter(locale, {
    style: "percent",
    maximumFractionDigits: maxDigits,
  }).format(fraction);
}

/** A multiple: 3.2 → "3.2×". */
export function formatMultiple(value: number, locale: FormatLocale): string {
  return `${formatNumber(value, locale, value >= 100 ? 0 : value >= 10 ? 1 : 2)}×`;
}

/** Any of the formatters above, or the empty mark for null and non-finite
 *  values. */
export function orEmpty(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  return value == null || !Number.isFinite(value) ? EMPTY : format(value);
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

/** Stored value → the number shown in a form control. */
export function toDisplay(spec: FieldSpec, stored: number): number {
  return spec.unit === "percent" ? stored * 100 : stored;
}

/** Number shown in a form control → stored value. */
export function fromDisplay(spec: FieldSpec, shown: number): number {
  return spec.unit === "percent" ? shown / 100 : shown;
}

/** The text a number input shows for a stored value while it is not being
 *  edited. No unit: the control renders that beside the input. */
export function formatFieldValue(
  spec: FieldSpec,
  stored: number | null,
  locale: FormatLocale,
): string {
  if (stored == null || !Number.isFinite(stored)) return "";
  const shown = toDisplay(spec, stored);
  if (spec.integer) return formatNumber(shown, locale, 0);
  if (spec.unit === "usdPerToken") {
    return formatNumber(shown, locale, priceDigits(shown));
  }
  // Float noise from the ×100 of a percent field must not reach the screen.
  return formatNumber(shown, locale, spec.unit === "percent" ? 4 : 6);
}

const suffixes: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
};

/**
 * Parse what a person typed into a number field. Accepts grouped thousands,
 * either decimal mark, a trailing % and the suffixes k, m, b and t ("1.5m").
 * Returns the stored value, unclamped, or null when the text is not a
 * number. An empty string is null too; the caller decides whether the field
 * may be empty.
 */
export function parseFieldInput(
  spec: FieldSpec,
  text: string,
  locale: FormatLocale,
): number | null {
  let s = text.trim().toLowerCase();
  if (s === "") return null;
  s = s.replace(/[\s'’_$%]/g, "");

  let scale = 1;
  const last = s.at(-1) ?? "";
  if (last in suffixes) {
    scale = suffixes[last];
    s = s.slice(0, -1);
  }

  const lastComma = s.lastIndexOf(",");
  const lastPoint = s.lastIndexOf(".");
  if (lastComma !== -1 && lastPoint !== -1) {
    // Both marks: the later one is the decimal mark, the other groups.
    const decimal = lastComma > lastPoint ? "," : ".";
    const group = decimal === "," ? "." : ",";
    s = s.split(group).join("").replace(decimal, ".");
  } else if (lastComma !== -1) {
    // A lone comma groups thousands in English and is a decimal in German.
    s = locale === "de" ? s.replace(",", ".") : s.split(",").join("");
  }

  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) return null;
  const shown = Number(s) * scale;
  if (!Number.isFinite(shown)) return null;
  return fromDisplay(spec, shown);
}
