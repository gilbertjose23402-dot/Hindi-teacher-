import { describe, expect, it } from 'vitest'
import { DAY, RELEARN_MS, intervalLabel, isDue, sameSentence, schedule } from './srs'

const fresh = { interval: 0, ease: 2.5, reps: 0 }
const now = 1_700_000_000_000

describe('spaced repetition', () => {
  it('a new card: again → minutes, hard/good → 1 day, easy → 4 days', () => {
    expect(schedule(fresh, 'again', now).due).toBe(now + RELEARN_MS)
    expect(schedule(fresh, 'hard', now).interval).toBe(1)
    expect(schedule(fresh, 'good', now).interval).toBe(1)
    expect(schedule(fresh, 'easy', now).interval).toBe(4)
  })

  it('intervals grow with each good answer, faster for easy cards', () => {
    let c = { ...fresh }
    const seen: number[] = []
    for (let i = 0; i < 5; i++) {
      c = schedule(c, 'good', now)
      seen.push(c.interval)
    }
    expect(seen.slice(0, 3)).toEqual([1, 3, 8])
    expect(seen[4]).toBeGreaterThan(seen[3])
    const easy = schedule({ interval: 10, ease: 2.5, reps: 3 }, 'easy', now)
    const good = schedule({ interval: 10, ease: 2.5, reps: 3 }, 'good', now)
    expect(easy.interval).toBeGreaterThan(good.interval)
    expect(easy.ease).toBeGreaterThan(2.5)
  })

  it('forgetting resets the card and lowers its ease (never below 1.3)', () => {
    const lapsed = schedule({ interval: 30, ease: 1.35, reps: 6 }, 'again', now)
    expect(lapsed).toMatchObject({ interval: 0, reps: 0, ease: 1.3 })
    expect(schedule({ interval: 10, ease: 2.5, reps: 3 }, 'hard', now).interval).toBe(12)
  })

  it('labels the next review time', () => {
    expect(intervalLabel(schedule(fresh, 'again', now), now)).toBe('10 min')
    expect(intervalLabel({ interval: 3, ease: 2.5, reps: 1, due: now + 3 * DAY }, now)).toBe('3 d')
    expect(intervalLabel({ interval: 14, ease: 2.5, reps: 1, due: now + 14 * DAY }, now)).toBe('2 wk')
    expect(intervalLabel({ interval: 60, ease: 2.5, reps: 1, due: now + 60 * DAY }, now)).toBe('2 mo')
    expect(isDue({ due: now }, now)).toBe(true)
  })

  it('compares a spoken answer with the right one, ignoring punctuation', () => {
    expect(sameSentence('मी पुण्यात राहतो', 'मी पुण्यात राहतो.')).toBe(true)
    expect(sameSentence('मैं कल कोर्ट गया', 'मैं कल कोर्ट गया।')).toBe(true)
    expect(sameSentence('मैंने कल कोर्ट गया', 'मैं कल कोर्ट गया।')).toBe(false)
    expect(sameSentence('', '')).toBe(false)
  })
})
