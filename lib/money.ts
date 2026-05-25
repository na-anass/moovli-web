// ============================================================================
// MONEY FORMATTING
// Path: lib/money.ts
//
// Single source of truth for money display across the web app. Wraps
// Intl.NumberFormat so we never hardcode "MAD" anywhere. Every studio carries
// its own `currency_code` (entities.currency_code) — pass that here.
// ============================================================================

export type CurrencyCode =
  | "MAD"
  | "TND"
  | "DZD"
  | "EGP"
  | "AED"
  | "SAR"
  | "EUR"
  | "GBP"
  | "USD";

export const DEFAULT_CURRENCY: CurrencyCode = "MAD";

const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale: string, opts: Intl.NumberFormatOptions = {}) {
  const key = `${locale}|${currency}|${JSON.stringify(opts)}`;
  let f = FORMATTER_CACHE.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        ...opts,
      });
    } catch {
      // Locale or currency unknown to the runtime; fall back to en-US with the
      // raw code so we still produce a readable string.
      f = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "code",
        ...opts,
      });
    }
    FORMATTER_CACHE.set(key, f);
  }
  return f;
}

interface FormatMoneyOptions {
  /** Browser locale by default. Pass e.g. "fr-MA" or "en-US" to override. */
  locale?: string;
  /** Minimum + maximum fraction digits. Defaults to the currency's standard. */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Format an amount in the given currency.
 *
 * @example
 *   formatMoney(120, "MAD")       // "MAD 120.00" or "120,00 MAD" depending on locale
 *   formatMoney(120, "EUR", { locale: "fr-FR" })  // "120,00 €"
 *   formatMoney(120, "USD", { maximumFractionDigits: 0 })  // "$120"
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: CurrencyCode | string | null | undefined = DEFAULT_CURRENCY,
  options: FormatMoneyOptions = {},
): string {
  const n = amount == null || amount === "" ? 0 : Number(amount);
  if (!Number.isFinite(n)) return "—";
  const cur = currency || DEFAULT_CURRENCY;
  const locale =
    options.locale ||
    (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const f = getFormatter(cur, locale, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  });
  return f.format(n);
}

/**
 * Format without decimals — useful for whole-number prices like "300 MAD"
 * shown on plan cards or studio price tags.
 */
export function formatMoneyWhole(
  amount: number | string | null | undefined,
  currency: CurrencyCode | string | null | undefined = DEFAULT_CURRENCY,
  locale?: string,
): string {
  return formatMoney(amount, currency, {
    locale,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
