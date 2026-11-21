import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARATHI_UNITS } from '../content/marathi'
import { db, type Session } from '../db'
import { practiceSystem } from './prompts'
import { DEFAULT_SETTINGS, defaultProfile, getProfile, saveSettings } from './store'
import { addLegalDeck, finishLesson, readyToFinish, recordUnitResult, turnRequest, unitCards, UNIT_PASS } from './tutor'

const s = { ...DEFAULT_SETTINGS, learnerName: 'Gilbert', learnerGender: 'm' as const, geminiKey: 'k', llmPrimary: 'gemini' as const }
const lesson = (unitId: string): Session => ({ lang: 'mr', kind: 'lesson', unitId, topic: 'lesson', focus: null, startedAt: 0, activeSeconds: 0, turns: [] })

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => vi.unstubAllGlobals())

describe('Marathi lesson prompts', () => {
  it('builds a lesson request with the unit, the learner\'s own forms and Marathi skill ids', () => {
    const req = turnRequest(lesson('u1'), s, defaultProfile('mr'), 'gemini', 0)
    expect(req.system).toContain('THIS LESSON — Unit 1')
    expect(req.system).toContain('मी पुण्यात राहतो.')
    expect(req.system).not.toContain('मी पुण्यात राहते.')
    expect(req.system).toContain('माझं नाव Gilbert आहे.')
    expect(req.messages[0].text).toBe('[Lesson start]')
    const enumIds = (req.schema.properties!.evidence.items!.properties!.skill.enum ?? []) as string[]
    expect(enumIds.every((id) => id.startsWith('mr_'))).toBe(true)
    const fem = turnRequest(lesson('u1'), { ...s, learnerGender: 'f' }, defaultProfile('mr'), 'gemini', 0)
    expect(fem.system).toContain('मी पुण्यात राहते.')
  })

  it('uses a compact lesson prompt for the on-phone brain', () => {
    const req = turnRequest(lesson('u3'), s, defaultProfile('mr'), 'local', 0)
    expect(req.system).toContain('Unit 3')
    expect(req.maxTokens).toBeLessThanOrEqual(200)
    expect(Object.keys(req.schema.properties!)).toEqual(['reply', 'correction', 'used'])
  })

  it('role-plays stay in character and never invent section numbers', () => {
    const p = practiceSystem(s, defaultProfile('hi'), 'ne_construction', 'law_bail', 'hi')
    expect(p).toContain('ROLE-PLAY: you play the Sessions Judge')
    expect(p).toMatch(/Do NOT invent section numbers/)
    expect(p).toContain('Grammar focus')
    const mr = practiceSystem(s, defaultProfile('mr'), 'mr_vocab', 'mr_clerk', 'mr')
    expect(mr).toContain('FREE CONVERSATION in Marathi')
    expect(mr).toContain('शिरस्तेदार')
  })

  it('a lesson can finish after 6 answers and always does by 10', () => {
    expect(readyToFinish('lesson', true, 5, false)).toBe(false)
    expect(readyToFinish('lesson', true, 6, false)).toBe(true)
    expect(readyToFinish('lesson', false, 9, false)).toBe(false)
    expect(readyToFinish('lesson', false, 10, false)).toBe(true)
    expect(readyToFinish('lesson', false, 8, true)).toBe(true)
    expect(readyToFinish('practice', true, 30, false)).toBe(false)
  })
})

describe('lesson results and cards', () => {
  it('turns a unit into flashcards in the learner\'s forms', () => {
    const cards = unitCards(MARATHI_UNITS[0], { learnerGender: 'f', learnerName: 'Gilbert' })
    expect(cards).toHaveLength(MARATHI_UNITS[0].phrases.length)
    expect(cards.map((c) => c.back)).toContain('मी पुण्यात राहते.')
    expect(cards.every((c) => c.lang === 'mr' && c.deck === 'lesson' && c.unitId === 'u1')).toBe(true)
  })

  it('completes a unit at the pass mark, or when marked complete by hand', async () => {
    await recordUnitResult('u1', UNIT_PASS - 1)
    expect((await getProfile('mr')).units?.u1).toMatchObject({ completed: false, attempts: 1, bestScore: UNIT_PASS - 1 })
    await recordUnitResult('u1', UNIT_PASS)
    expect((await getProfile('mr')).units?.u1).toMatchObject({ completed: true, attempts: 2, bestScore: UNIT_PASS })
    await recordUnitResult('u2', 0, true)
    expect((await getProfile('mr')).units?.u2?.completed).toBe(true)
  })

  it('adds the legal vocabulary deck once', async () => {
    const first = await addLegalDeck()
    expect(first).toBeGreaterThanOrEqual(50)
    expect(await addLegalDeck()).toBe(0)
    const legal = await db.cards.filter((c) => c.deck === 'legal').toArray()
    expect(legal.some((c) => c.lang === 'mr' && c.back === 'जामीन')).toBe(true)
    // Spread out: only the first 5 terms (Hindi + Marathi) are due today.
    expect(legal.filter((c) => c.due <= Date.now())).toHaveLength(10)
  })

  it('finishing a lesson scores mastery, completes the unit and saves phrase cards', async () => {
    await saveSettings(s)
    const id = await db.sessions.add({
      ...lesson('u1'),
      turns: [
        { role: 'rani', text: 'नमस्कार Gilbert!', at: 1 },
        { role: 'user', text: 'नमस्कार, मी वकील आहे', at: 2 },
      ],
    })
    let body: { systemInstruction: { parts: { text: string }[] }; generationConfig: { responseSchema: { properties: Record<string, unknown> } } } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init: { body: string }) => {
        body = JSON.parse(init.body)
        const recap = {
          summary: 'You introduced yourself well.',
          wins: ['मी वकील आहे'],
          mistakes: [],
          patterns: [{ english: 'I am a lawyer.', target: 'मी वकील आहे.', note: 'आहे = हूँ' }],
          tutor_notes: 'Started Marathi.',
          next_focus: 'mr_gender',
          mastery: 72,
        }
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(recap) }] } }] }))
      }),
    )
    const done = await finishLesson(id)
    expect(body!.systemInstruction.parts[0].text).toContain("today's LESSON (Unit 1")
    expect(body!.generationConfig.responseSchema.properties).toHaveProperty('mastery')
    expect(done.recap?.mastery).toBe(72)
    expect((await getProfile('mr')).units?.u1?.completed).toBe(true)
    const cards = await db.cards.toArray()
    // unit phrases (8) + the pattern card is the same sentence as a phrase → kept once
    expect(cards.filter((c) => c.deck === 'lesson')).toHaveLength(MARATHI_UNITS[0].phrases.length)
    expect(cards.filter((c) => c.back === 'मी वकील आहे.')).toHaveLength(1)
  })
})
