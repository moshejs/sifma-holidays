/**
 * sifma-holidays — the US bond-market calendar.
 *
 * SIFMA (the Securities Industry and Financial Markets Association) publishes
 * recommended full closes and early closes for US fixed-income trading. This
 * calendar differs from the stock market's: the bond market also closes on
 * Columbus Day and Veterans Day, and observes 2:00 p.m. ET early closes
 * around holidays.
 *
 * Years SIFMA has published (PUBLISHED_YEARS, currently 1996–2027) use its
 * recommendations verbatim, including unscheduled closures (9/11, Hurricane
 * Sandy, national days of mourning). Other years are rule-derived
 * projections, not official recommendations.
 *
 * Dates are "YYYY-MM-DD" strings (recommended) or Date objects read as UTC
 * calendar dates.
 */

import {
  type CloseTime,
  type EarlyClose,
  type MarketHoliday,
  type YMD,
  type YearCalendar,
  addDays,
  dow,
  iso,
  parsePublished,
  ruleEarlyCloses,
  ruleHolidays,
} from "./calendar.js";
import { PUBLISHED_DATA } from "./published.js";

export type { CloseTime, EarlyClose, MarketHoliday };

export type DateInput = string | Date;

/** Years backed by SIFMA's published recommendations (1996–2027). */
export const PUBLISHED_YEARS: readonly number[] = Object.keys(PUBLISHED_DATA).map(Number);

const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

// ---------------------------------------------------------------------------
// Date plumbing
// ---------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function checkYear(year: number, label = "year"): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`${label} out of supported range (${MIN_YEAR}–${MAX_YEAR}): ${year}`);
  }
}

function toYMD(input: DateInput, label = "date"): YMD {
  let ymd: YMD;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError(`Invalid Date for ${label}`);
    ymd = { y: input.getUTCFullYear(), m: input.getUTCMonth() + 1, d: input.getUTCDate() };
  } else {
    const m = typeof input === "string" ? DATE_RE.exec(input) : null;
    if (!m) throw new RangeError(`Invalid date for ${label}: "${input}" (expected YYYY-MM-DD)`);
    ymd = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    const check = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d));
    if (
      check.getUTCFullYear() !== ymd.y ||
      check.getUTCMonth() + 1 !== ymd.m ||
      check.getUTCDate() !== ymd.d
    ) {
      throw new RangeError(`Invalid calendar date for ${label}: "${input}"`);
    }
  }
  checkYear(ymd.y, `Year of ${label}`);
  return ymd;
}

// ---------------------------------------------------------------------------
// Calendar lookup (published data, else rule projection)
// ---------------------------------------------------------------------------

const yearCache = new Map<number, YearCalendar & { holidaySet: Set<string> }>();

function calendarFor(year: number): YearCalendar & { holidaySet: Set<string> } {
  let cal = yearCache.get(year);
  if (!cal) {
    const data = PUBLISHED_DATA[year];
    const base = data ? parsePublished(year, data) : { holidays: ruleHolidays(year), earlyCloses: ruleEarlyCloses(year) };
    cal = { ...base, holidaySet: new Set(base.holidays.map((h) => h.date)) };
    yearCache.set(year, cal);
  }
  return cal;
}

function isBusinessYMD(a: YMD): boolean {
  const w = dow(a);
  return w !== 0 && w !== 6 && !calendarFor(a.y).holidaySet.has(iso(a));
}

function previousBusinessYMD(a: YMD): YMD {
  let cur = addDays(a, -1);
  while (!isBusinessYMD(cur)) cur = addDays(cur, -1);
  return cur;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * All recommended full market closes for a calendar year, sorted by date.
 * Published SIFMA data for PUBLISHED_YEARS; rule-derived projection otherwise.
 */
export function getHolidays(year: number): MarketHoliday[] {
  checkYear(year);
  return calendarFor(year).holidays.map((h) => ({ ...h }));
}

/** All recommended early closes for a calendar year, sorted by date. */
export function getEarlyCloses(year: number): EarlyClose[] {
  checkYear(year);
  return calendarFor(year).earlyCloses.map((e) => ({ ...e }));
}

/** True when the year's calendar is SIFMA's published recommendation, not a projection. */
export function isPublishedYear(year: number): boolean {
  checkYear(year);
  return PUBLISHED_DATA[year] !== undefined;
}

/** The holiday entry for a date, or null. */
export function isHoliday(date: DateInput): MarketHoliday | null {
  const a = toYMD(date);
  const hit = calendarFor(a.y).holidays.find((h) => h.date === iso(a));
  return hit ? { ...hit } : null;
}

/** The early-close entry for a date, or null. Early-close days ARE business days. */
export function isEarlyClose(date: DateInput): EarlyClose | null {
  const a = toYMD(date);
  const hit = calendarFor(a.y).earlyCloses.find((e) => e.date === iso(a));
  return hit ? { ...hit } : null;
}

/** True when the bond market is open: a weekday that is not a full close. */
export function isBusinessDay(date: DateInput): boolean {
  return isBusinessYMD(toYMD(date));
}

/** The next bond-market business day strictly after `date`. */
export function nextBusinessDay(date: DateInput): string {
  let cur = addDays(toYMD(date), 1);
  while (!isBusinessYMD(cur)) cur = addDays(cur, 1);
  return iso(cur);
}

/** The previous bond-market business day strictly before `date`. */
export function previousBusinessDay(date: DateInput): string {
  return iso(previousBusinessYMD(toYMD(date)));
}

/**
 * Add `n` business days (n may be negative; n = 0 returns the date as-is).
 */
export function addBusinessDays(date: DateInput, n: number): string {
  if (!Number.isInteger(n)) throw new RangeError(`n must be an integer, got ${n}`);
  let cur = toYMD(date);
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0; left--) {
    cur = addDays(cur, step);
    while (!isBusinessYMD(cur)) cur = addDays(cur, step);
  }
  return iso(cur);
}

/**
 * Regular-way settlement date: `days` business days after the trade date
 * (default 1 — US Treasuries settle T+1).
 *
 * ```ts
 * settlementDate("2026-07-02"); // "2026-07-06" — skips July 3 close + weekend
 * ```
 */
export function settlementDate(tradeDate: DateInput, days = 1): string {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError(`days must be a non-negative integer, got ${days}`);
  }
  return addBusinessDays(tradeDate, days);
}
