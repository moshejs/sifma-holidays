# sifma-holidays

The **US bond-market calendar** — holidays, 2:00 p.m. early closes, and settlement-date math per [SIFMA's recommendations](https://www.sifma.org/resources/general/holiday-schedule/). Zero dependencies.

```
npm install sifma-holidays
```

## Why

The bond market does not keep the stock market's calendar. Fixed income closes on **Columbus Day** and **Veterans Day** while equities trade; it observes **early closes** around holidays; and whether Good Friday is a full close or an early close varies year by year (2026: a 12:00 p.m. early close). Every existing npm calendar package models NYSE. If you compute Treasury settlement dates (T+1) with a stock-market calendar, you will be wrong several times a year.

```ts
import { settlementDate, isBusinessDay, getEarlyCloses } from "sifma-holidays";

settlementDate("2026-11-10");  // "2026-11-12" — skips Veterans Day (stocks trade that day)
settlementDate("2026-07-02");  // "2026-07-06" — skips the July 3 close + weekend

isBusinessDay("2026-10-12");   // false — Columbus Day (bond market closed, NYSE open)
isBusinessDay("2026-12-24");   // true  — early close is still a trading day

getEarlyCloses(2026);
// [{ date: "2026-04-03", name: "Good Friday", closeTimeET: "12:00" }, … 14:00 closes]

isBusinessDay("2021-12-31");   // true  — Jan 1, 2022 was a Saturday: SIFMA recommended a 2pm close, not a holiday
isHoliday("2012-10-30");       // { date: "2012-10-30", name: "Hurricane Sandy" }
```

## API

- **`getHolidays(year)`** → `{ date, name }[]` — recommended full closes
- **`getEarlyCloses(year)`** → `{ date, name, closeTimeET }[]` — usually `"14:00"` ET; `"12:00"` for jobs-report Good Fridays and Hurricane Sandy, `"11:00"` (Good Friday 2007) and `"13:00"` (1999-12-31) once each
- **`isHoliday(date)`** / **`isEarlyClose(date)`** → the matching entry or `null`
- **`isBusinessDay(date)`** → weekday and not a full close
- **`nextBusinessDay(date)`** / **`previousBusinessDay(date)`** → `"YYYY-MM-DD"`
- **`addBusinessDays(date, n)`** — `n` may be negative
- **`settlementDate(tradeDate, days = 1)`** — regular-way settlement (US Treasuries are T+1)
- **`PUBLISHED_YEARS`** / **`isPublishedYear(year)`** — years backed by SIFMA's published recommendations (1996–2027)

Dates are `"YYYY-MM-DD"` strings (recommended) or `Date` objects read as UTC calendar dates. Impossible dates, and years outside 1990–2100, throw `RangeError` from every function.

## Published data vs. projections

**1996–2027 are SIFMA's own recommendations, transcribed verbatim** (see the source list at the top of [`src/published.ts`](src/published.ts)):

- 1996–2014 from SIFMA's *Holiday Recommendations 1996–2019* PDF, corrected for amendments SIFMA announced after the original schedule (early closes added on 2010-12-31, 2012-07-03 and 2013-07-03);
- 2015–2025 from SIFMA's US holiday archive, and 2026–2027 from its current schedule. The test suite checks the table against a fixture parsed by script from those pages;
- unscheduled closures: 9/11 (2001-09-11/12 closed; 2pm closes on 09-13 and 09-17), President Reagan's funeral (2004-06-11), President Ford (2007-01-02, 2pm), Hurricane Sandy (2012-10-29 noon close, 2012-10-30 closed), President G. H. W. Bush (2018-12-05), and President Carter (2025-01-09, 2pm).

The history is less regular than you might think. Until April 2009 SIFMA recommended **twelve** early closes a year, including the day before MLK, Presidents, Labor, Columbus and Veterans Day and the day before Thanksgiving. Good Friday becomes a **noon early close** instead of a holiday when the BLS jobs report comes out that morning (1999, 2007 at 11:00, 2010, 2012, 2015, 2021, 2023, 2026). **New Year's Day and Veterans Day are not observed when they fall on a Saturday**: the bond market trades that Friday, with a 2pm close on Dec 31.

**Other years are rule-derived projections**, not recommendations:

- full closes: the eleven holidays plus Juneteenth from 2022; Sunday holidays move to Monday; Saturday holidays move to Friday, except New Year's Day and Veterans Day;
- early closes (2pm): the business day before Good Friday, Memorial Day, Independence Day and Christmas; the day after Thanksgiving; the last business day of the year;
- Good Friday on April 1–7 (since 2007) is projected as a noon early close, because the jobs report usually lands on the first Friday. SIFMA confirms this each year;
- before 1996, the pre-2009 twelve-early-close set.

These rules reproduce every published year from 2016 to 2027 exactly, apart from the unscheduled closures; the test suite checks this. Unscheduled closures can't be projected.

This package covers the **US** recommendations only (not SIFMA's UK/Japan calendars).

## Related

Part of a small fixed-income toolkit: [`32nds`](https://github.com/moshejs/32nds) (Treasury quote notation) · [`day-count-conventions`](https://github.com/moshejs/day-count) · [`accrued-interest`](https://github.com/moshejs/accrued-interest) · [`treasurydirect`](https://github.com/moshejs/treasurydirect) (auction data client).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
