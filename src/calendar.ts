/**
 * Internal: date plumbing, holiday naming, and the rule engine used to
 * project years SIFMA has not published. Not part of the public API.
 */

export interface MarketHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

/** Recommended early close, US Eastern Time. 14:00 is the norm. */
export type CloseTime = "11:00" | "12:00" | "13:00" | "14:00";

export interface EarlyClose {
  date: string; // YYYY-MM-DD
  name: string;
  /** Recommended close, US Eastern Time. */
  closeTimeET: CloseTime;
}

export interface YearCalendar {
  holidays: MarketHoliday[];
  earlyCloses: EarlyClose[];
}

// ---------------------------------------------------------------------------
// Date plumbing
// ---------------------------------------------------------------------------

export interface YMD {
  y: number;
  m: number;
  d: number;
}

export function iso(a: YMD): string {
  return `${String(a.y).padStart(4, "0")}-${String(a.m).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`;
}

export function fromIso(s: string): YMD {
  return { y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) };
}

export function dow(a: YMD): number {
  return new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay(); // 0=Sun … 6=Sat
}

export function addDays(a: YMD, n: number): YMD {
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** nth `weekday` (0=Sun…6=Sat) of a month, n ≥ 1. */
function nthWeekday(y: number, m: number, weekday: number, n: number): YMD {
  const first = dow({ y, m, d: 1 });
  return { y, m, d: 1 + ((weekday - first + 7) % 7) + (n - 1) * 7 };
}

function lastWeekday(y: number, m: number, weekday: number): YMD {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = dow({ y, m, d: lastDay });
  return { y, m, d: lastDay - ((last - weekday + 7) % 7) };
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
// Names
// ---------------------------------------------------------------------------

const NAMES: Record<string, string> = {
  NY: "New Year's Day",
  MLK: "Martin Luther King Jr. Day",
  PRES: "Presidents Day",
  GF: "Good Friday",
  MEM: "Memorial Day",
  JUNE: "Juneteenth",
  IND: "Independence Day",
  LAB: "Labor Day",
  COL: "Columbus Day",
  VET: "Veterans Day",
  THX: "Thanksgiving Day",
  XMAS: "Christmas Day",
  S911: "September 11 attacks",
  REAGAN: "National Day of Mourning (President Reagan)",
  FORD: "National Day of Mourning (President Ford)",
  SANDY: "Hurricane Sandy",
  BUSH: "National Day of Mourning (President George H. W. Bush)",
  CARTER: "National Day of Mourning (President Carter)",
};

/** Shorter forms used for early-close names, matching earlier releases. */
const EARLY_NAMES: Record<string, string> = {
  THX: "Thanksgiving",
  XMAS: "Christmas",
};

/** Fixed-date holidays: a close on any other date is the "(observed)" day. */
const NOMINAL: Record<string, string> = {
  NY: "01-01",
  JUNE: "06-19",
  IND: "07-04",
  VET: "11-11",
  XMAS: "12-25",
};

export function holidayName(code: string, date: string): string {
  const base = NAMES[code] ?? code;
  const nominal = NOMINAL[code];
  return nominal !== undefined && date.slice(5) !== nominal ? `${base} (observed)` : base;
}

export function earlyCloseName(code: string, date: string, goodFriday: string): string {
  // A Good Friday that is itself an early close (jobs-report years) is just "Good Friday".
  if (code === "GF" && date === goodFriday) return NAMES.GF!;
  return `${EARLY_NAMES[code] ?? NAMES[code] ?? code} (early close)`;
}

export function goodFridayOf(year: number): string {
  return iso(addDays(easterSunday(year), -2));
}

// ---------------------------------------------------------------------------
// Rule engine (projection for years SIFMA has not published)
// ---------------------------------------------------------------------------

/**
 * Good Friday is normally a full close, but since 2007 SIFMA has recommended
 * an early close instead whenever the BLS employment report is released that
 * morning (2007, 2010, 2012, 2015, 2021, 2023, 2026). The report is usually
 * the first Friday of the month, so a Good Friday on April 1–7 is projected as
 * a 12:00 early close. This is a heuristic: SIFMA confirms it each year.
 */
export function isJobsReportGoodFriday(year: number): boolean {
  const gf = fromIso(goodFridayOf(year));
  return year >= 2007 && gf.m === 4 && gf.d <= 7;
}

interface Entry {
  date: YMD;
  code: string;
}

/**
 * Weekend observance as SIFMA applies it: a Sunday holiday moves to Monday; a
 * Saturday holiday moves to Friday — except New Year's Day and Veterans Day,
 * which are simply not observed when they fall on a Saturday (e.g. SIFMA
 * recommended trading on 2021-12-31, with a 2pm close, and on 2023-11-10).
 */
function observed(y: number, m: number, d: number, code: string): YMD | null {
  const a = { y, m, d };
  const w = dow(a);
  if (w === 0) return addDays(a, 1);
  if (w === 6) return code === "NY" || code === "VET" ? null : addDays(a, -1);
  return a;
}

function ruleHolidayEntries(year: number): Entry[] {
  const items: Entry[] = [];
  const push = (date: YMD | null, code: string) => {
    if (date && date.y === year) items.push({ date, code });
  };
  push(observed(year, 1, 1, "NY"), "NY");
  push(nthWeekday(year, 1, 1, 3), "MLK");
  push(nthWeekday(year, 2, 1, 3), "PRES");
  if (!isJobsReportGoodFriday(year)) push(fromIso(goodFridayOf(year)), "GF");
  push(lastWeekday(year, 5, 1), "MEM");
  if (year >= 2022) push(observed(year, 6, 19, "JUNE"), "JUNE");
  push(observed(year, 7, 4, "IND"), "IND");
  push(nthWeekday(year, 9, 1, 1), "LAB");
  push(nthWeekday(year, 10, 1, 2), "COL");
  push(observed(year, 11, 11, "VET"), "VET");
  push(nthWeekday(year, 11, 4, 4), "THX");
  push(observed(year, 12, 25, "XMAS"), "XMAS");
  return items.sort((a, b) => (iso(a.date) < iso(b.date) ? -1 : 1));
}

function ruleHolidaySet(year: number): Set<string> {
  return new Set(ruleHolidayEntries(year).map((e) => iso(e.date)));
}

function ruleIsBusiness(a: YMD, cache: Map<number, Set<string>>): boolean {
  const w = dow(a);
  if (w === 0 || w === 6) return false;
  let set = cache.get(a.y);
  if (!set) {
    set = ruleHolidaySet(a.y);
    cache.set(a.y, set);
  }
  return !set.has(iso(a));
}

/** Rule-derived holidays for a year (named). */
export function ruleHolidays(year: number): MarketHoliday[] {
  return ruleHolidayEntries(year).map((e) => ({ date: iso(e.date), name: holidayName(e.code, iso(e.date)) }));
}

/**
 * Rule-derived early closes (2pm ET unless noted):
 *  - the business day before Good Friday (or Good Friday itself at 12:00 in
 *    jobs-report years), Memorial Day, Independence Day and Christmas;
 *  - the day after Thanksgiving; the last business day of the year.
 * Before SIFMA's April 2009 policy change it recommended twelve early closes
 * a year, adding the day before MLK, Presidents, Labor, Columbus and Veterans
 * Day and the day before Thanksgiving; projections before 1996 use that set.
 */
export function ruleEarlyCloses(year: number): EarlyClose[] {
  const cache = new Map<number, Set<string>>();
  const prevBusiness = (a: YMD): YMD => {
    let cur = addDays(a, -1);
    while (!ruleIsBusiness(cur, cache)) cur = addDays(cur, -1);
    return cur;
  };
  const holidays = ruleHolidayEntries(year);
  const gf = goodFridayOf(year);
  const items: { date: YMD; code: string; time: CloseTime }[] = [];
  const before = (code: string) => {
    const h = holidays.find((e) => e.code === code);
    if (h) items.push({ date: prevBusiness(h.date), code, time: "14:00" });
  };

  if (isJobsReportGoodFriday(year)) items.push({ date: fromIso(gf), code: "GF", time: "12:00" });
  else before("GF");
  before("MEM");
  before("IND");
  before("XMAS");
  const thx = holidays.find((e) => e.code === "THX")!;
  items.push({ date: addDays(thx.date, 1), code: "THX", time: "14:00" });
  // Last business day before next year's New Year's close (or before Jan 1
  // itself when that is a Saturday and not observed).
  items.push({ date: prevBusiness({ y: year + 1, m: 1, d: 1 }), code: "NY", time: "14:00" });

  if (year < 2009) {
    for (const code of ["MLK", "PRES", "LAB", "COL", "VET"]) before(code);
    items.push({ date: prevBusiness(thx.date), code: "THX", time: "14:00" });
  }

  const seen = new Set<string>();
  return items
    .filter((e) => e.date.y === year && !seen.has(iso(e.date)) && (seen.add(iso(e.date)), true))
    .sort((a, b) => (iso(a.date) < iso(b.date) ? -1 : 1))
    .map((e) => ({ date: iso(e.date), name: earlyCloseName(e.code, iso(e.date), gf), closeTimeET: e.time }));
}

/** Parse the compact published-data strings (see published.ts). */
export function parsePublished(year: number, data: readonly [string, string]): YearCalendar {
  const gf = goodFridayOf(year);
  const holidays = data[0].split(",").map((t) => {
    const [md, code] = t.split(" ") as [string, string];
    const date = `${year}-${md}`;
    return { date, name: holidayName(code, date) };
  });
  const earlyCloses = data[1].split(",").map((t) => {
    const [md, rest] = t.split(" ") as [string, string];
    const [code, time] = rest.split("@") as [string, string | undefined];
    const date = `${year}-${md}`;
    return { date, name: earlyCloseName(code, date, gf), closeTimeET: (time ?? "14:00") as CloseTime };
  });
  return { holidays, earlyCloses };
}
