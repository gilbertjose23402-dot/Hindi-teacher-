import { describe, expect, it } from 'vitest'
import { SKILL_BY_ID } from '../lib/skills'
import { LEGAL_TERMS } from './legal'
import { MARATHI_UNITS, NAME_SLOT, nextUnit, phraseFor, unitUnlocked, unitsCompleted } from './marathi'
import { TOPICS, topicsFor } from './topics'

// Hindi-only words that must never appear in Marathi phrases (common slips).
const HINDI_ONLY = [/(^|\s)है(\s|।|\.|\?|$)/, /हूँ/, /(^|\s)क्या(\s|$)/, /कहाँ/, /बहुत/, /(^|\s)मेरा(\s|$)/, /(^|\s)नहीं(\s|$)/]

describe('Marathi curriculum', () => {
  it('has 14 units in order with unique ids', () => {
    expect(MARATHI_UNITS).toHaveLength(14)
    MARATHI_UNITS.forEach((u, i) => {
      expect(u.no).toBe(i + 1)
      expect(u.id).toBe(`u${i + 1}`)
    })
  })

  it('every unit is complete and uses real Marathi skill ids', () => {
    for (const u of MARATHI_UNITS) {
      expect(u.phrases.length, u.id).toBeGreaterThanOrEqual(7)
      expect(u.grammar.points.length, u.id).toBeGreaterThanOrEqual(3)
      expect(u.goal && u.scenario && u.hindiBridge && u.titleMr, u.id).toBeTruthy()
      for (const sk of u.skills) expect(SKILL_BY_ID[sk]?.id, `${u.id} ${sk}`).toMatch(/^mr_/)
      for (const p of u.phrases) {
        expect(p.mr && p.roman && p.en && p.hi, `${u.id} ${p.mr}`).toBeTruthy()
        expect(!!p.mrF, `${u.id} ${p.mr} feminine pairs`).toBe(!!p.romanF)
        for (const t of [p.mr, p.mrF ?? '']) for (const re of HINDI_ONLY) expect(re.test(t), `${u.id}: "${t}" looks like Hindi (${re})`).toBe(false)
      }
    }
  })

  it('chooses feminine forms and fills in the name', () => {
    const p = MARATHI_UNITS[0].phrases.find((x) => x.mrF)!
    expect(phraseFor(p, 'f', 'Gilbert').mr).toBe('मी पुण्यात राहते.')
    expect(phraseFor(p, 'm', 'Gilbert').mr).toBe('मी पुण्यात राहतो.')
    const named = MARATHI_UNITS[0].phrases.find((x) => x.mr.includes(NAME_SLOT))!
    expect(phraseFor(named, 'm', 'Gilbert').mr).toBe('माझं नाव Gilbert आहे.')
  })

  it('opens units in order unless everything is unlocked', () => {
    const [u1, u2, u3] = MARATHI_UNITS
    expect(unitUnlocked(u1, {}, false)).toBe(true)
    expect(unitUnlocked(u2, {}, false)).toBe(false)
    expect(unitUnlocked(u2, { u1: { completed: true } }, false)).toBe(true)
    expect(unitUnlocked(u3, {}, true)).toBe(true)
    expect(nextUnit({ u1: { completed: true } }).id).toBe('u2')
    expect(unitsCompleted({ u1: { completed: true }, u2: { completed: false } })).toBe(1)
  })
})

describe('legal vocabulary and topics', () => {
  it('every legal term has English, Hindi and Marathi', () => {
    expect(LEGAL_TERMS.length).toBeGreaterThanOrEqual(25)
    for (const t of LEGAL_TERMS) expect(t.en && t.hi && t.mr).toBeTruthy()
    expect(new Set(LEGAL_TERMS.map((t) => t.en)).size).toBe(LEGAL_TERMS.length)
  })

  it('topics have unique ids and sensible tracks per language', () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length)
    expect(topicsFor('hi', 'law').length).toBeGreaterThanOrEqual(5)
    expect(topicsFor('hi', 'ai').length).toBeGreaterThanOrEqual(3)
    expect(topicsFor('mr', 'law').every((t) => t.lang === 'mr')).toBe(true)
    expect(topicsFor('mr', 'general').some((t) => t.id === 'news')).toBe(false)
  })
})
