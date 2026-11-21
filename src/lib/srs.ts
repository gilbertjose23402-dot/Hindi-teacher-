/**
 * Spaced repetition (a simplified SM-2, like Anki): each answer moves the
 * card's next review further out the better you knew it.
 */
import type { Card } from '../db'

export type Grade = 'again' | 'hard' | 'good' | 'easy'
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy']

const MINUTE = 60_000
export const DAY = 24 * 60 * MINUTE
/** "Again" brings the card back in the same session, a few minutes later. */
export const RELEARN_MS = 10 * MINUTE
const MIN_EASE = 1.3

export type Schedule = Pick<Card, 'interval' | 'ease' | 'reps' | 'due'>

/** The card's next interval (days), ease and due time after answering with `grade`. */
export function schedule(card: Pick<Card, 'interval' | 'ease' | 'reps'>, grade: Grade, now = Date.now()): Schedule {
  const ease = card.ease || 2.5
  const interval = card.interval || 0
  if (grade === 'again') return { interval: 0, ease: Math.max(MIN_EASE, ease - 0.2), reps: 0, due: now + RELEARN_MS }
  let next: number
  let nextEase = ease
  if (grade === 'hard') {
    next = card.reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2))
    nextEase = Math.max(MIN_EASE, ease - 0.15)
  } else if (grade === 'good') {
    next = card.reps === 0 ? 1 : card.reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease))
  } else {
    next = card.reps === 0 ? 4 : Math.max(interval + 2, Math.round(Math.max(interval, 1) * ease * 1.3))
    nextEase = ease + 0.15
  }
  return { interval: next, ease: Math.round(nextEase * 100) / 100, reps: card.reps + 1, due: now + next * DAY }
}

/** Short label for when the card would come back, shown on the grade buttons. */
export function intervalLabel(s: Schedule, now = Date.now()): string {
  const ms = s.due - now
  if (ms < DAY) return `${Math.max(1, Math.round(ms / MINUTE))} min`
  const days = Math.round(ms / DAY)
  if (days < 7) return `${days} d`
  if (days < 30) return `${Math.round(days / 7)} wk`
  if (days < 365) return `${Math.round(days / 30)} mo`
  return `${Math.round(days / 365)} yr`
}

export function isDue(card: Pick<Card, 'due'>, now = Date.now()): boolean {
  return card.due <= now
}

/** Compare a spoken/typed answer with the right one, ignoring punctuation and spacing. */
export function sameSentence(a: string, b: string): boolean {
  const norm = (t: string) =>
    t
      .normalize('NFC')
      .toLowerCase()
      .replace(/[।॥.,!?;:"'“”‘’()\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  return !!norm(a) && norm(a) === norm(b)
}
