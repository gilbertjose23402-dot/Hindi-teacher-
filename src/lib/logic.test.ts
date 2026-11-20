import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '../db'
import { computeStreak, dayKey, lastNDays } from './dates'
import { geminiTtsModels, parseJsonLoose, pickGeminiModel, pickGeminiTtsModel, pickGroqChatModel } from './llm'
import { HINDI_SKILLS, applyEvidence, defaultSkills, levelFromScore, overallScore, pickFocus } from './skills'
import { normalizeTurn } from './tutor'

const entry = (date: string, seconds: number): TimeEntry => ({ id: `${date}|hi`, date, lang: 'hi', seconds })

describe('streak', () => {
  const today = new Date(2026, 10, 19)
  it('counts consecutive qualifying days including today', () => {
    const e = [entry('2026-11-19', 400), entry('2026-11-18', 600), entry('2026-11-17', 300), entry('2026-11-15', 900)]
    expect(computeStreak(e, today)).toBe(3)
  })
  it('stays alive when today has not qualified yet', () => {
    const e = [entry('2026-11-19', 60), entry('2026-11-18', 600), entry('2026-11-17', 600)]
    expect(computeStreak(e, today)).toBe(2)
  })
  it('sums Hindi and Marathi time for a day', () => {
    const e = [entry('2026-11-19', 200), { id: '2026-11-19|mr', date: '2026-11-19', lang: 'mr' as const, seconds: 200 }]
    expect(computeStreak(e, today)).toBe(1)
  })
  it('is zero after a missed day', () => {
    expect(computeStreak([entry('2026-11-17', 600)], today)).toBe(0)
  })
  it('lastNDays ends today', () => {
    const d = lastNDays(7, today)
    expect(d).toHaveLength(7)
    expect(d.at(-1)).toBe(dayKey(today))
    expect(d[0]).toBe('2026-11-13')
  })
})

describe('skills', () => {
  it('mistakes lower and correct uses raise the score', () => {
    const s = { score: 50, correct: 0, wrong: 0 }
    expect(applyEvidence(s, false).score).toBeLessThan(50)
    expect(applyEvidence(s, true).score).toBeGreaterThan(50)
    expect(applyEvidence(s, true).correct).toBe(1)
  })
  it('scores stay within 0..100', () => {
    let s = { score: 3, correct: 0, wrong: 0 }
    for (let i = 0; i < 5; i++) s = applyEvidence(s, false)
    expect(s.score).toBe(0)
    s = { score: 99, correct: 0, wrong: 0 }
    for (let i = 0; i < 5; i++) s = applyEvidence(s, true)
    expect(s.score).toBe(100)
  })
  it('maps scores to levels', () => {
    expect(levelFromScore(10)).toBe('A1')
    expect(levelFromScore(50)).toBe('B1')
    expect(levelFromScore(90)).toBe('C1')
  })
  it('picks the weakest level-appropriate skill and avoids repeating', () => {
    const skills = defaultSkills()
    for (const s of HINDI_SKILLS) skills[s.id].score = 60
    skills.ne_construction.score = 20
    skills.future.score = 25
    expect(pickFocus(skills)).toBe('ne_construction')
    expect(pickFocus(skills, 'ne_construction')).toBe('future')
    skills.future.score = 50
    expect(pickFocus(skills, 'ne_construction')).toBe('ne_construction')
    expect(overallScore(skills)).toBeGreaterThan(0)
  })
})

describe('turn parsing', () => {
  it('keeps a real correction and records it as evidence', () => {
    const t = normalizeTurn({
      correction: { needed: true, you_said: 'मैंने कोर्ट गया', better: 'मैं कोर्ट गया', rule: 'जाना is intransitive: no ने.', tip: '', skill: 'ne_construction' },
      evidence: [{ skill: 'past_intransitive', correct: true }],
      reply: 'अच्छा! आप कोर्ट कब गए?',
      reply_roman: 'achchha',
      reply_english: 'Nice',
      placement_complete: false,
    })
    expect(t.correction?.better).toBe('मैं कोर्ट गया')
    expect(t.correction?.tip).toBeUndefined()
    expect(t.evidence).toContainEqual({ skill: 'ne_construction', correct: false })
  })
  it('drops non-corrections and unknown skills', () => {
    const t = normalizeTurn({
      correction: { needed: true, you_said: 'ठीक है', better: 'ठीक है', rule: '', tip: '', skill: 'other' },
      evidence: [{ skill: 'made_up', correct: true }],
      reply: '',
    })
    expect(t.correction).toBeNull()
    expect(t.evidence).toEqual([])
    expect(t.reply.length).toBeGreaterThan(0)
  })
  it('parses fenced JSON', () => {
    expect(parseJsonLoose<{ a: number }>('```json\n{"a":1}\n```').a).toBe(1)
    expect(parseJsonLoose<{ a: number }>('Sure! {"a":2} done').a).toBe(2)
  })
})

describe('model picking', () => {
  it('prefers the newest stable flash model', () => {
    expect(pickGeminiModel(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-flash-preview'])).toBe('gemini-2.5-flash')
    expect(pickGeminiModel(['gemini-3-flash', 'gemini-2.5-flash'])).toBe('gemini-3-flash')
    expect(pickGeminiModel(['gemini-flash-latest', 'gemini-3-flash-preview'])).toBe('gemini-flash-latest')
  })
  it('never picks a speech model as the brain, and picks the best voice model', () => {
    const all = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash', 'gemini-2.5-pro-preview-tts']
    expect(pickGeminiModel(all)).toBe('gemini-2.5-flash')
    // 2.5 / 3.1 preview voices were shut down on 2026-11-17: never picked.
    expect(pickGeminiTtsModel(all)).toBeUndefined()
    const now = [...all, 'gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']
    expect(pickGeminiTtsModel(now)).toBe('gemini-3.8-flash-lite-tts')
    expect(pickGeminiTtsModel(['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'])).toBe('gemini-3.8-flash-tts')
    expect(geminiTtsModels(now)).toEqual(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'])
    expect(pickGeminiTtsModel(['gemini-2.5-flash'])).toBeUndefined()
  })
  it('picks a Groq chat model that is not whisper', () => {
    expect(pickGroqChatModel(['whisper-large-v3', 'llama-3.3-70b-versatile'])).toBe('llama-3.3-70b-versatile')
    expect(pickGroqChatModel(['whisper-large-v3', 'some-new-model'])).toBe('some-new-model')
  })
})
