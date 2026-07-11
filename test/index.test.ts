import { describe, expect, it } from "vitest";
import {
  PUBLISHED_YEARS,
  addBusinessDays,
  getEarlyCloses,
  getHolidays,
  isBusinessDay,
  isEarlyClose,
  isHoliday,
  nextBusinessDay,
  previousBusinessDay,
  settlementDate,
} from "../src/index.js";

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

describe("rule-derived projection years", () => {
  it("2025 holidays land on the right dates", () => {
    const dates = Object.fromEntries(getHolidays(2025).map((h) => [h.name, h.date]));
    expect(dates["Martin Luther King Jr. Day"]).toBe("2025-01-20");
    expect(dates["Good Friday"]).toBe("2025-04-18"); // Easter 2025-04-20
    expect(dates["Memorial Day"]).toBe("2025-05-26");
    expect(dates["Independence Day"]).toBe("2025-07-04"); // Friday, unshifted
    expect(dates["Thanksgiving Day"]).toBe("2025-11-27");
    expect(dates["Christmas Day"]).toBe("2025-12-25");
  });

  it("2025 early closes include the published 2025-12-31 New Year's close", () => {
    const dates = getEarlyCloses(2025).map((e) => e.date);
    expect(dates).toEqual([
      "2025-05-23",
      "2025-07-03",
      "2025-11-28",
      "2025-12-24",
      "2025-12-31", // matches SIFMA's published recommendation
    ]);
  });

  it("computes Easter correctly across years", () => {
    const gf = (y: number) =>
      getHolidays(y).find((h) => h.name === "Good Friday")?.date;
    expect(gf(2024)).toBe("2024-03-29");
    expect(gf(2025)).toBe("2025-04-18");
  });

  it("handles the 2027→2028 year boundary (both observances fall in 2027)", () => {
    const h27 = Object.fromEntries(getHolidays(2027).map((h) => [h.name, h.date]));
    expect(h27["Independence Day (observed)"]).toBe("2027-07-05"); // July 4 = Sunday
    expect(h27["Christmas Day (observed)"]).toBe("2027-12-24"); // Dec 25 = Saturday
    expect(h27["New Year's Day (observed)"]).toBe("2027-12-31"); // Jan 1 2028 = Saturday

    const closes = Object.fromEntries(getEarlyCloses(2027).map((e) => [e.name, e.date]));
    expect(closes["Christmas (early close)"]).toBe("2027-12-23");
    expect(closes["New Year's Day (early close)"]).toBe("2027-12-30");
    // and 2028 must NOT double-count a New Year's holiday
    expect(getHolidays(2028).some((h) => h.name.startsWith("New Year's"))).toBe(false);
  });

  it("has no Juneteenth before 2022", () => {
    expect(getHolidays(2021).some((h) => h.name === "Juneteenth")).toBe(false);
    expect(getHolidays(2022).some((h) => h.name.startsWith("Juneteenth"))).toBe(true);
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
});
