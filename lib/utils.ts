import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a `YYYY-MM-DD` date string (from an <input type="date">) as local midnight.
 * `new Date("2026-05-01")` parses as UTC midnight, which in the Mountain/Pacific tz
 * becomes the previous day — making a bid due *today* look overdue before the workday
 * even starts. Appending `T00:00:00` forces local-time parsing.
 */
export function parseLocalDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

/**
 * Return a local-midnight Date for the start of today, so comparisons with a bid
 * due date (also parsed as local midnight) don't flip based on the current hour.
 */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}