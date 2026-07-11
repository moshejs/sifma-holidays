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
```

## API

- **`getHolidays(year)`** → `{ date, name }[]` — recommended full closes
- **`getEarlyCloses(year)`** → `{ date, name, closeTimeET }[]` — `"14:00"` or `"12:00"` ET
- **`isHoliday(date)`** / **`isEarlyClose(date)`** → the matching entry or `null`
- **`isBusinessDay(date)`** → weekday and not a full close
- **`nextBusinessDay(date)`** / **`previousBusinessDay(date)`** → `"YYYY-MM-DD"`
- **`addBusinessDays(date, n)`** — `n` may be negative
- **`settlementDate(tradeDate, days = 1)`** — regular-way settlement (US Treasuries are T+1)
- **`PUBLISHED_YEARS`** — years backed by official SIFMA data

Dates are `"YYYY-MM-DD"` strings (recommended) or `Date` objects read as UTC calendar dates; impossible dates throw.

## Published data vs. projections

Years in `PUBLISHED_YEARS` (currently **2026**) use SIFMA's official recommendations verbatim. Other years are **rule-derived projections**: fixed rules (third-Monday holidays, Saturday→Friday / Sunday→Monday observance, Easter computus for Good Friday, business-day-before early closes) that reproduce SIFMA's published dates — the 2025 test suite confirms the projection matches SIFMA's published 2025-12-31 early close. The known wobble is Good Friday: projections treat it as a full close, but in some years (like 2026) SIFMA recommends an early close instead. The data table is updated as SIFMA publishes new years.

This package covers the **US** recommendations only (not SIFMA's UK/Japan calendars).

## Related

Part of a small fixed-income toolkit: [`32nds`](https://github.com/moshejs/32nds) (Treasury quote notation) · [`day-count`](https://github.com/moshejs/day-count) · [`accrued-interest`](https://github.com/moshejs/accrued-interest) · [`treasurydirect`](https://github.com/moshejs/treasurydirect) (auction data client).

## Author

Built by **[Moshe Malka](https://moshemalka.com)** — engineering leader in New York City. Studio work at [Quentin.Code](https://www.quentin.software/).

MIT © Moshe Malka
