import { describe, expect, it } from "vitest";
import { parsePublished, ruleEarlyCloses, ruleHolidays } from "../src/calendar.js";
import {
  PUBLISHED_YEARS,
  addBusinessDays,
  getEarlyCloses,
  getHolidays,
  isBusinessDay,
  isEarlyClose,
  isHoliday,
  isPublishedYear,
  nextBusinessDay,
  previousBusinessDay,
  settlementDate,
} from "../src/index.js";
import { PUBLISHED_DATA } from "../src/published.js";
import { officialEarlyCloses, officialFullCloses } from "./fixtures.js";

describe("published SIFMA data — 2026", () => {
  it("matches the official recommended full closes exactly", () => {
    expect(getHolidays(2026).map((h) => h.date)).toEqual([
      "2026-01-01", // New Year's Day
      "2026-01-19", // MLK
      "2026-02-16", // Presidents Day
      "2026-05-25", // Memorial Day
      "2026-06-19", // Juneteenth
      "2026-07-03", // Independence Day (observed — July 4 is a Saturday)
      "2026-09-07", // Labor Day
      "2026-10-12", // Columbus Day
      "2026-11-11", // Veterans Day
      "2026-11-26", // Thanksgiving
      "2026-12-25", // Christmas
    ]);
    expect(PUBLISHED_YEARS).toContain(2026);
  });

  it("matches the official early closes, including Good Friday at noon", () => {
    const closes = getEarlyCloses(2026);
    expect(closes.map((e) => [e.date, e.closeTimeET])).toEqual([
      ["2026-04-03", "12:00"], // Good Friday — early close, NOT a holiday in 2026
      ["2026-05-22", "14:00"],
      ["2026-07-02", "14:00"],
      ["2026-11-27", "14:00"],
      ["2026-12-24", "14:00"],
      ["2026-12-31", "14:00"],
    ]);
    expect(isHoliday("2026-04-03")).toBeNull();
    expect(isEarlyClose("2026-04-03")?.name).toBe("Good Friday");
  });
});

describe("matches SIFMA's official pages, 2015–2027 (test/fixtures.ts)", () => {
  const unscheduledFull = new Set(["2018-12-05"]);
  const unscheduledEarly = new Set(["2025-01-09"]);

  for (let y = 2015; y <= 2027; y++) {
    it(`${y}`, () => {
      expect(getHolidays(y).map((h) => h.date).filter((d) => !unscheduledFull.has(d))).toEqual(
        officialFullCloses.filter((d) => d.startsWith(String(y))),
      );
      expect(
        Object.fromEntries(
          getEarlyCloses(y)
            .filter((e) => !unscheduledEarly.has(e.date))
            .map((e) => [e.date, e.closeTimeET]),
        ),
      ).toEqual(
        Object.fromEntries(Object.entries(officialEarlyCloses).filter(([d]) => d.startsWith(String(y)))),
      );
    });
  }
});

describe("historical recommendations (bugs in 1.0.0's rule projection)", () => {
  it("Thursday before Good Friday is a 2pm early close", () => {
    expect(isEarlyClose("2025-04-17")?.closeTimeET).toBe("14:00");
    expect(isEarlyClose("2024-03-28")?.name).toBe("Good Friday (early close)");
  });

  it("Good Friday was a noon early close, not a holiday, in jobs-report years", () => {
    for (const d of ["2010-04-02", "2012-04-06", "2015-04-03", "2021-04-02", "2023-04-07"]) {
      expect(isBusinessDay(d), d).toBe(true);
      expect(isEarlyClose(d)?.closeTimeET, d).toBe("12:00");
    }
    expect(isEarlyClose("2007-04-06")?.closeTimeET).toBe("11:00");
  });

  it("New Year's Day on a Saturday is not observed: Dec 31 is a 2pm early close", () => {
    for (const d of ["2010-12-31", "2021-12-31", "2027-12-31"]) {
      expect(isBusinessDay(d), d).toBe(true);
      expect(isEarlyClose(d)?.closeTimeET, d).toBe("14:00");
    }
    expect(isEarlyClose("1999-12-31")?.closeTimeET).toBe("13:00");
  });

  it("Veterans Day on a Saturday is not observed", () => {
    expect(isBusinessDay("2017-11-10")).toBe(true);
    expect(isBusinessDay("2023-11-10")).toBe(true);
  });

  it("includes unscheduled closures", () => {
    expect(isHoliday("2001-09-11")?.name).toBe("September 11 attacks");
    expect(isBusinessDay("2001-09-12")).toBe(false);
    expect(isEarlyClose("2001-09-13")?.closeTimeET).toBe("14:00");
    expect(isBusinessDay("2004-06-11")).toBe(false);
    expect(isEarlyClose("2007-01-02")?.closeTimeET).toBe("14:00");
    expect(isEarlyClose("2012-10-29")?.closeTimeET).toBe("12:00");
    expect(isHoliday("2012-10-30")?.name).toBe("Hurricane Sandy");
    expect(isBusinessDay("2018-12-05")).toBe(false);
    expect(isEarlyClose("2025-01-09")?.name).toBe("National Day of Mourning (President Carter) (early close)");
    expect(isBusinessDay("2025-01-09")).toBe(true);
  });

  it("before April 2009 SIFMA recommended twelve early closes a year", () => {
    expect(getEarlyCloses(2008).map((e) => e.date)).toEqual([
      "2008-01-18", // MLK
      "2008-02-15", // Presidents
      "2008-03-20", // Good Friday
      "2008-05-23", // Memorial
      "2008-07-03", // Independence
      "2008-08-29", // Labor
      "2008-10-10", // Columbus
      "2008-11-10", // Veterans
      "2008-11-26", // Thanksgiving eve
      "2008-11-28", // day after Thanksgiving
      "2008-12-24", // Christmas
      "2008-12-31", // New Year's
    ]);
  });

  it("no July 4 early close in 2010, 2011 and 2015; restored from 2016", () => {
    expect(getEarlyCloses(2015).some((e) => e.name.startsWith("Independence"))).toBe(false);
    expect(isEarlyClose("2016-07-01")?.name).toBe("Independence Day (early close)");
  });

  it("Juneteenth starts in 2022 and a Saturday Juneteenth closes the Friday", () => {
    expect(getHolidays(2021).some((h) => h.name.startsWith("Juneteenth"))).toBe(false);
    expect(isHoliday("2022-06-20")?.name).toBe("Juneteenth (observed)");
    expect(isHoliday("2027-06-18")?.name).toBe("Juneteenth (observed)");
  });
});

describe("rule-derived projection", () => {
  it("reproduces every published year from 2016 to 2027, except unscheduled closures", () => {
    const unscheduled = new Set(["2018-12-05", "2025-01-09"]);
    for (let y = 2016; y <= 2027; y++) {
      const pub = parsePublished(y, PUBLISHED_DATA[y]!);
      const strip = <T extends { date: string }>(xs: T[]) => xs.filter((x) => !unscheduled.has(x.date));
      expect(ruleHolidays(y), `${y} holidays`).toEqual(strip(pub.holidays));
      expect(ruleEarlyCloses(y), `${y} early closes`).toEqual(strip(pub.earlyCloses));
    }
  });

  it("projects years after the published range", () => {
    expect(isPublishedYear(2028)).toBe(false);
    expect(isPublishedYear(2027)).toBe(true);
    const h28 = getHolidays(2028).map((h) => h.date);
    expect(h28).not.toContain("2027-12-31");
    expect(h28.some((d) => d.endsWith("-01-01") || d.endsWith("-01-03"))).toBe(false); // Jan 1 2028 is a Saturday
    expect(isHoliday("2028-11-10")).toBeNull(); // Veterans Day 2028 is a Saturday
    // 2034: Good Friday April 7 is projected as a jobs-report noon close
    expect(isEarlyClose("2034-04-07")?.closeTimeET).toBe("12:00");
    expect(isEarlyClose("2030-04-18")?.name).toBe("Good Friday (early close)");
  });
});

describe("business days and settlement", () => {
  it("weekends and holidays are not business days; early-close days are", () => {
    expect(isBusinessDay("2026-07-03")).toBe(false); // holiday
    expect(isBusinessDay("2026-07-04")).toBe(false); // Saturday
    expect(isBusinessDay("2026-07-06")).toBe(true); // Monday
    expect(isBusinessDay("2026-12-24")).toBe(true); // early close
  });

  it("T+1 settlement skips the July 4 close and the weekend", () => {
    expect(settlementDate("2026-07-02")).toBe("2026-07-06");
  });

  it("T+1 settlement skips Veterans Day — the bond market close stocks don't have", () => {
    expect(settlementDate("2026-11-10")).toBe("2026-11-12");
  });

  it("T+1 across a Saturday New Year's Day settles on Dec 31", () => {
    expect(settlementDate("2021-12-30")).toBe("2021-12-31");
  });

  it("walks business days forward, backward, and not at all", () => {
    expect(nextBusinessDay("2026-07-02")).toBe("2026-07-06");
    expect(previousBusinessDay("2026-07-06")).toBe("2026-07-02");
    expect(addBusinessDays("2026-07-06", -1)).toBe("2026-07-02");
    expect(addBusinessDays("2026-07-02", 2)).toBe("2026-07-07");
    expect(addBusinessDays("2026-07-04", 0)).toBe("2026-07-04");
  });

  it("accepts Date objects (read as UTC)", () => {
    expect(isBusinessDay(new Date(Date.UTC(2026, 6, 6)))).toBe(true);
  });
});

describe("validation", () => {
  it("rejects out-of-range years, malformed dates, bad n", () => {
    expect(() => getHolidays(1980)).toThrow(RangeError);
    expect(() => getHolidays(2101)).toThrow(RangeError);
    expect(() => isBusinessDay("2026-7-4")).toThrow(RangeError);
    expect(() => isBusinessDay("2026-02-30")).toThrow(RangeError);
    expect(() => addBusinessDays("2026-07-06", 1.5)).toThrow(RangeError);
    expect(() => settlementDate("2026-07-06", -1)).toThrow(RangeError);
  });

  it("every date-taking function enforces the year range (1.0.0 only checked getHolidays)", () => {
    expect(() => isBusinessDay("1985-07-05")).toThrow(RangeError);
    expect(() => nextBusinessDay("2150-01-01")).toThrow(RangeError);
    expect(() => isHoliday("1989-12-25")).toThrow(RangeError);
  });
});
