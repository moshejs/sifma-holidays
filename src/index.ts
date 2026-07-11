/**
 * sifma-holidays — the US bond-market calendar.
 *
 * SIFMA (the Securities Industry and Financial Markets Association) publishes
 * recommended full closes and early closes for US fixed-income trading. This
 * calendar differs from the stock market's: the bond market also closes on
 * Columbus Day and Veterans Day, and observes 2:00 p.m. ET early closes
 * around holidays.
 *
 * Years with officially published recommendations (see PUBLISHED_YEARS) use
 * literal data tables. Other years are rule-derived projections — correct for
 * the fixed rules (MLK, Thanksgiving, weekend observance, Easter computus for
 * Good Friday) but not an official SIFMA recommendation. Good Friday in
 * projected years is treated as a full close; in some years SIFMA instead
 * recommends an early close (2026: 12:00 p.m. ET).
 *
 * Dates are "YYYY-MM-DD" strings (recommended) or Date objects read as UTC
 * calendar dates.
 */

export interface MarketHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface EarlyClose {
  date: string; // YYYY-MM-DD
  name: string;
  /** Recommended close, US Eastern Time. */
  closeTimeET: "14:00" | "12:00";
}

export type DateInput = string | Date;

/** Years covered by officially published SIFMA recommendations. */
export const PUBLISHED_YEARS: readonly number[] = [2026];

// ---------------------------------------------------------------------------
// Published SIFMA data (sifma.org US holiday recommendations)
// ---------------------------------------------------------------------------

const PUBLISHED: Record<
  number,
  { holidays: MarketHoliday[]; earlyCloses: EarlyClose[] }
> = {
  2026: {
    holidays: [
      { date: "2026-01-01", name: "New Year's Day" },
      { date: "2026-01-19", name: "Martin Luther King Jr. Day" },
      { date: "2026-02-16", name: "Presidents Day" },
      { date: "2026-05-25", name: "Memorial Day" },
      { date: "2026-06-19", name: "Juneteenth" },
      { date: "2026-07-03", name: "Independence Day (observed)" },
      { date: "2026-09-07", name: "Labor Day" },
      { date: "2026-10-12", name: "Columbus Day" },
      { date: "2026-11-11", name: "Veterans Day" },
      { date: "2026-11-26", name: "Thanksgiving Day" },
      { date: "2026-12-25", name: "Christmas Day" },
    ],
    earlyCloses: [
      { date: "2026-04-03", name: "Good Friday", closeTimeET: "12:00" },
      { date: "2026-05-22", name: "Memorial Day (early close)", closeTimeET: "14:00" },
      { date: "2026-07-02", name: "Independence Day (early close)", closeTimeET: "14:00" },
      { date: "2026-11-27", name: "Thanksgiving (early close)", closeTimeET: "14:00" },
      { date: "2026-12-24", name: "Christmas (early close)", closeTimeET: "14:00" },
      { date: "2026-12-31", name: "New Year's Day (early close)", closeTimeET: "14:00" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Date plumbing
// ---------------------------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface YMD {
  y: number;
  m: number;
  d: number;
}

function toYMD(input: DateInput, label = "date"): YMD {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new RangeError(`Invalid Date for ${label}`);
    return { y: input.getUTCFullYear(), m: input.getUTCMonth() + 1, d: input.getUTCDate() };
  }
  const m = DATE_RE.exec(input);
  if (!m) throw new RangeError(`Invalid date for ${label}: "${input}" (expected YYYY-MM-DD)`);
  const ymd = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const check = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d));
  if (
    check.getUTCFullYear() !== ymd.y ||
    check.getUTCMonth() + 1 !== ymd.m ||
    check.getUTCDate() !== ymd.d
  ) {
    throw new RangeError(`Invalid calendar date for ${label}: "${input}"`);
  }
  return ymd;
}

function iso(a: YMD): string {
  return `${String(a.y).padStart(4, "0")}-${String(a.m).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`;
}

function dow(a: YMD): number {
  return new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay(); // 0=Sun … 6=Sat
}

function addDays(a: YMD, n: number): YMD {
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** nth `weekday` (0=Sun…6=Sat) of a month, n ≥ 1. */
function nthWeekday(y: number, m: number, weekday: number, n: number): YMD {
  const first = dow({ y, m, d: 1 });
  const d = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return { y, m, d };
}

function lastWeekday(y: number, m: number, weekday: number): YMD {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = dow({ y, m, d: lastDay });
  return { y, m, d: lastDay - ((last - weekday + 7) % 7) };
}

/** Weekend observance: Saturday → prior Friday, Sunday → next Monday. */
function observed(a: YMD): { date: YMD; shifted: boolean } {
  const w = dow(a);
  if (w === 6) return { date: addDays(a, -1), shifted: true };
  if (w === 0) return { date: addDays(a, 1), shifted: true };
  return { date: a, shifted: false };
}

/** Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm). */
function easterSunday(y: number): YMD {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y, m: month, d: day };
}

// ---------------------------------------------------------------------------
// Rule-derived calendar (projection for non-published years)
// ---------------------------------------------------------------------------

function fixedHoliday(y: number, m: number, d: number, name: string): MarketHoliday {
  const { date, shifted } = observed({ y, m, d });
  return { date: iso(date), name: shifted ? `${name} (observed)` : name };
}

function ruleHolidays(year: number): MarketHoliday[] {
  const items: MarketHoliday[] = [
    fixedHoliday(year, 1, 1, "New Year's Day"),
    { date: iso(nthWeekday(year, 1, 1, 3)), name: "Martin Luther King Jr. Day" },
    { date: iso(nthWeekday(year, 2, 1, 3)), name: "Presidents Day" },
    { date: iso(addDays(easterSunday(year), -2)), name: "Good Friday" },
    { date: iso(lastWeekday(year, 5, 1)), name: "Memorial Day" },
    fixedHoliday(year, 7, 4, "Independence Day"),
    { date: iso(nthWeekday(year, 9, 1, 1)), name: "Labor Day" },
    { date: iso(nthWeekday(year, 10, 1, 2)), name: "Columbus Day" },
    fixedHoliday(year, 11, 11, "Veterans Day"),
    { date: iso(nthWeekday(year, 11, 4, 4)), name: "Thanksgiving Day" },
    fixedHoliday(year, 12, 25, "Christmas Day"),
  ];
  if (year >= 2022) items.push(fixedHoliday(year, 6, 19, "Juneteenth"));
  // New Year's of the NEXT year can observe back into this year (Jan 1 on a
  // Saturday → Friday Dec 31).
  const nextNY = fixedHoliday(year + 1, 1, 1, "New Year's Day");
  if (nextNY.date.startsWith(String(year))) items.push(nextNY);
  return items
    .filter((h) => h.date.startsWith(String(year)))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function holidaySetFor(year: number): Set<string> {
  const table = PUBLISHED[year];
  const list = table ? table.holidays : ruleHolidays(year);
  return new Set(list.map((h) => h.date));
}

const holidayCache = new Map<number, Set<string>>();

function isHolidayYMD(a: YMD): boolean {
  let set = holidayCache.get(a.y);
  if (!set) {
    set = holidaySetFor(a.y);
    holidayCache.set(a.y, set);
  }
  return set.has(iso(a));
}

function isBusinessYMD(a: YMD): boolean {
  const w = dow(a);
  return w !== 0 && w !== 6 && !isHolidayYMD(a);
}

function previousBusinessYMD(a: YMD): YMD {
  let cur = addDays(a, -1);
  while (!isBusinessYMD(cur)) cur = addDays(cur, -1);
  return cur;
}

function ruleEarlyCloses(year: number): EarlyClose[] {
  const holidays = ruleHolidays(year);
  const byName = (needle: string) => holidays.find((h) => h.name.startsWith(needle));

  const items: EarlyClose[] = [];
  const push = (before: MarketHoliday | undefined, name: string) => {
    if (!before) return;
    const day = previousBusinessYMD(toYMD(before.date));
    if (day.y === year) items.push({ date: iso(day), name, closeTimeET: "14:00" });
  };

  push(byName("Memorial Day"), "Memorial Day (early close)");
  push(byName("Independence Day"), "Independence Day (early close)");
  const thanksgiving = byName("Thanksgiving");
  if (thanksgiving) {
    items.push({
      date: iso(addDays(toYMD(thanksgiving.date), 1)),
      name: "Thanksgiving (early close)",
      closeTimeET: "14:00",
    });
  }
  push(byName("Christmas"), "Christmas (early close)");
  // New Year's early close precedes NEXT year's observance and falls on the
  // last business day of this year (even when Jan 1 observes back to Dec 31).
  const nyNext = fixedHoliday(year + 1, 1, 1, "New Year's Day");
  const nyDay = previousBusinessYMD(toYMD(nyNext.date));
  if (nyDay.y === year) {
    items.push({ date: iso(nyDay), name: "New Year's Day (early close)", closeTimeET: "14:00" });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * All recommended full market closes for a calendar year, sorted by date.
 * Published SIFMA data for PUBLISHED_YEARS; rule-derived projection otherwise.
 */
export function getHolidays(year: number): MarketHoliday[] {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new RangeError(`Year out of supported range (1990–2100): ${year}`);
  }
  const table = PUBLISHED[year];
  return (table ? table.holidays : ruleHolidays(year)).map((h) => ({ ...h }));
}

/** All recommended early closes for a calendar year, sorted by date. */
export function getEarlyCloses(year: number): EarlyClose[] {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new RangeError(`Year out of supported range (1990–2100): ${year}`);
  }
  const table = PUBLISHED[year];
  return (table ? table.earlyCloses : ruleEarlyCloses(year)).map((e) => ({ ...e }));
}

/** The holiday entry for a date, or null. */
export function isHoliday(date: DateInput): MarketHoliday | null {
  const a = toYMD(date);
  const list = getHolidays(a.y);
  return list.find((h) => h.date === iso(a)) ?? null;
}

/** The early-close entry for a date, or null. Early-close days ARE business days. */
export function isEarlyClose(date: DateInput): EarlyClose | null {
  const a = toYMD(date);
  const list = getEarlyCloses(a.y);
  return list.find((e) => e.date === iso(a)) ?? null;
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
