// Timestamp helpers for Drizzle integer columns using { mode: 'timestamp_ms' }.
//
// Drizzle's timestamp_ms mode:
//   mapToDriverValue(value) -> value.getTime()   (Date required, returns ms epoch)
//   mapFromDriverValue(value) -> new Date(value)  (DB int -> Date)
//
// So writes MUST pass Date objects (numbers throw). Reads return Date objects.
// For query comparisons (e.g. .where(gt(col, x))) pass a Date — Drizzle will
// call mapToDriverValue to convert it to ms before sending to D1.

export const now = (): Date => new Date()

export const nowMs = (): number => Date.now()

export const fromDate = (ms: number): Date => new Date(ms)
