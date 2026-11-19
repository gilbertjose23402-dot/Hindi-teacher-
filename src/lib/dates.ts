import type { TimeEntry } from '../db'

/** Local-calendar date key, e.g. 2026-11-19. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

/** Day keys for the last n days, oldest first, ending today. */
export function lastNDays(n: number, today: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(addDays(today, -i)))
  return out
}

export function secondsByDay(entries: TimeEntry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + e.seconds)
  return m
}

/** A day counts toward the streak when at least `minSeconds` were practised. */
export const STREAK_MIN_SECONDS = 5 * 60

/**
 * Consecutive practice days ending today. If today doesn't qualify yet,
 * the streak is still alive if yesterday qualified.
 */
export function computeStreak(entries: TimeEntry[], today: Date = new Date(), minSeconds = STREAK_MIN_SECONDS): number {
  const byDay = secondsByDay(entries)
  const ok = (d: Date) => (byDay.get(dayKey(d)) ?? 0) >= minSeconds
  let cursor = ok(today) ? today : addDays(today, -1)
  let streak = 0
  while (ok(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function formatMinutes(seconds: number): string {
  if (seconds > 0 && seconds < 60) return '<1 min'
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}

export function shortDayName(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)
}
