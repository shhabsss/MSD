/**
 * MSDFS Facility Services - Centralized Date Utilities
 * Ensures robust, timezone-safe date comparison and normalization.
 */

/**
 * Returns a local calendar date formatted as YYYY-MM-DD.
 * Avoids UTC timezone conversion bugs (e.g., IST UTC+5:30 early morning / late night offset).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns tomorrow's local calendar date as YYYY-MM-DD.
 */
export function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
}

/**
 * Normalizes any date value (ISO string, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, Date object, timestamp)
 * into a canonical YYYY-MM-DD string.
 */
export function normalizeDateString(dateVal?: string | number | Date | null): string {
  if (dateVal === undefined || dateVal === null || dateVal === '') return '';

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    return getLocalDateString(dateVal);
  }

  // If number (epoch timestamp)
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return getLocalDateString(d);
    return '';
  }

  const str = String(dateVal).trim();
  if (!str) return '';

  // Case 1: Indian/UK standard DD/MM/YYYY or DD-MM-YYYY (e.g. 19/09/2026 or 19-09-2026 or 19.09.2026)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Case 2: ISO YYYY-MM-DD or YYYY/MM/DD or YYYY-M-D (matches start of string including ISO datetimes)
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Case 3: Try standard Date constructor parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getLocalDateString(parsed);
  }

  return str;
}

/**
 * Checks if two date inputs represent the exact same calendar day.
 * Normalizes both values to YYYY-MM-DD before comparing.
 */
export function isSameDay(date1?: string | number | Date | null, date2?: string | number | Date | null): boolean {
  if (!date1 || !date2) return false;
  const n1 = normalizeDateString(date1);
  const n2 = normalizeDateString(date2);
  return Boolean(n1 && n2 && n1 === n2);
}

/**
 * Checks if a date falls between fromDate and toDate (inclusive).
 */
export function isDateInRange(
  dateVal?: string | number | Date | null,
  fromDate?: string | number | Date | null,
  toDate?: string | number | Date | null
): boolean {
  const d = normalizeDateString(dateVal);
  if (!d) return false;

  const from = normalizeDateString(fromDate);
  const to = normalizeDateString(toDate);

  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/**
 * Formats any date string into Indian display format (DD/MM/YYYY).
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const norm = normalizeDateString(dateStr);
  if (!norm) return String(dateStr).trim() || '-';
  const parts = norm.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return norm;
}

/**
 * Formats a date into human-readable format, e.g. "Sat, 19 Sep 2026".
 */
export function formatLongDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const norm = normalizeDateString(dateStr);
  if (!norm) return String(dateStr).trim() || '-';
  const [y, m, d] = norm.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (isNaN(dateObj.getTime())) return norm;
  return dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns the YYYY-MM month key for monthly aggregations.
 */
export function getDateMonthKey(dateStr?: string | null): string {
  const norm = normalizeDateString(dateStr);
  if (!norm) return '';
  return norm.slice(0, 7);
}
