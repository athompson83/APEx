import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistance, format, isToday, isYesterday } from "date-fns";

// =============================================================================
// Tailwind / Class Utilities
// =============================================================================

/**
 * Merge Tailwind CSS classes without conflicts.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 *
 * @param str - The string to truncate.
 * @param maxLength - Maximum character count (default: 100).
 * @param ellipsis - Suffix appended when truncated (default: "…").
 */
export function truncate(
  str: string,
  maxLength: number = 100,
  ellipsis: string = "…"
): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Convert a string to a URL-safe slug.
 *
 * @example
 * slugify("Hello World!") // "hello-world"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a camelCase or snake_case identifier to Title Case with spaces.
 *
 * @example
 * toTitleCase("chiefOfStaff")   // "Chief Of Staff"
 * toTitleCase("SALES_MANAGER")  // "Sales Manager"
 */
export function toTitleCase(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .split(" ")
    .filter(Boolean)
    .map(capitalize)
    .join(" ");
}

/**
 * Generate a random alphanumeric string of the given length.
 * Suitable for UI keys, not cryptographic purposes.
 */
export function randomId(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .padEnd(length, "0");
}

// =============================================================================
// Number / Currency Utilities
// =============================================================================

/**
 * Format a number as a currency string.
 *
 * @param amount - Numeric amount.
 * @param currency - ISO 4217 currency code (default: "USD").
 * @param locale - BCP 47 locale string (default: "en-US").
 *
 * @example
 * formatCurrency(1234.5)            // "$1,234.50"
 * formatCurrency(9999, "EUR", "de") // "9.999,00 €"
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a large number with compact notation.
 *
 * @example
 * formatCompactNumber(1_234_567) // "1.2M"
 * formatCompactNumber(9_800)     // "9.8K"
 */
export function formatCompactNumber(
  value: number,
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a number as a percentage string.
 *
 * @example
 * formatPercent(0.856)  // "85.6%"
 * formatPercent(1)      // "100%"
 */
export function formatPercent(
  value: number,
  decimals: number = 1,
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a byte count as a human-readable file size.
 *
 * @example
 * formatBytes(1024)        // "1 KB"
 * formatBytes(1_048_576)   // "1 MB"
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${units[i]}`;
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Format a date value using a date-fns format string.
 *
 * @param date - Date, timestamp, or ISO string.
 * @param fmt  - date-fns format pattern (default: "MMM d, yyyy").
 *
 * @example
 * formatDate(new Date())              // "May 15, 2026"
 * formatDate(new Date(), "MM/dd/yy")  // "05/15/26"
 */
export function formatDate(
  date: Date | string | number,
  fmt: string = "MMM d, yyyy"
): string {
  try {
    return format(new Date(date), fmt);
  } catch {
    return "";
  }
}

/**
 * Format a date as a human-readable relative time string, with smart
 * "today" / "yesterday" labels for recent dates.
 *
 * @param date - Date, timestamp, or ISO string.
 *
 * @example
 * formatRelativeTime(new Date())           // "just now"
 * formatRelativeTime(yesterday)            // "yesterday"
 * formatRelativeTime(new Date("2024-01")) // "about 1 year ago"
 */
export function formatRelativeTime(date: Date | string | number): string {
  try {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 10) return "just now";
    if (diffSeconds < 60) return `${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24 && isToday(d)) {
      return `${diffHours}h ago`;
    }

    if (isYesterday(d)) return "yesterday";
    if (diffHours < 48) return "yesterday";

    return formatDistance(d, now, { addSuffix: true });
  } catch {
    return "";
  }
}

/**
 * Format a date with both date and time components.
 *
 * @example
 * formatDateTime(new Date()) // "May 15, 2026 at 3:45 PM"
 */
export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, "MMM d, yyyy 'at' h:mm a");
}

// =============================================================================
// Array / Object Utilities
// =============================================================================

/**
 * Group an array of objects by a key selector function.
 *
 * @example
 * groupBy(tasks, t => t.status)
 * // { PENDING: [...], COMPLETED: [...] }
 */
export function groupBy<T>(
  arr: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

/**
 * Remove duplicate values from an array, with optional key selector
 * for deduplicating objects by a specific property.
 */
export function unique<T>(arr: T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) return [...new Set(arr)];
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sort an array of objects by a string or number property.
 *
 * @param arr - Array to sort (non-mutating).
 * @param key - Property name to sort by.
 * @param direction - "asc" (default) or "desc".
 */
export function sortBy<T>(
  arr: T[],
  key: keyof T,
  direction: "asc" | "desc" = "asc"
): T[] {
  return [...arr].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    const result = av < bv ? -1 : 1;
    return direction === "asc" ? result : -result;
  });
}

// =============================================================================
// Async Utilities
// =============================================================================

/**
 * Sleep for a given number of milliseconds.
 *
 * @example
 * await sleep(500);
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function up to `maxAttempts` times with exponential back-off.
 *
 * @param fn          - Async function to retry.
 * @param maxAttempts - Maximum total attempts (default: 3).
 * @param delayMs     - Initial delay in ms, doubled each retry (default: 500).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await sleep(delayMs * Math.pow(2, attempt - 1));
      }
    }
  }
  throw lastError;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Check if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Check if a value is a valid email address.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Check if a URL string is valid.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// URL Utilities
// =============================================================================

/**
 * Build a query string from a plain object, omitting null/undefined values.
 *
 * @example
 * buildQueryString({ page: 1, q: "test", filter: null })
 * // "?page=1&q=test"
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Extract the initials from a full name (up to 2 characters).
 *
 * @example
 * getInitials("Jane Doe")  // "JD"
 * getInitials("Alice")     // "AL"
 */
export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
