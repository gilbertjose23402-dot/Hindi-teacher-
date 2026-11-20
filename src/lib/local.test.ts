import { describe, expect, it } from 'vitest'
import type { Session } from '../db'
import { generateJson, type JsonRequest } from './llm'
import { buildLocalMessages, runLocalJson, toJsonSchema } from './local'
import { LOCAL_TURN_SCHEMA, practiceSystemLocal } from './prompts'
import { DEFAULT_SETTINGS, defaultProfile } from './store'
import { toMessages } from './tutor'

describe('on-phone brain', () => {
  it('converts the app schema to standard JSON Schema', () => {
    const js = toJsonSchema(LOCAL_TURN_SCHEMA) as { type: string; properties: Record<string, { type: string }>; required: string[] }
    expect(js.type).toBe('object')
    expect(js.properties.correction.type).toBe('object')
    expect(js.properties.used.type).toBe('string')
    expect(js.required).toContain('reply')
    expect(JSON.stringify(js)).not.toMatch(/OBJECT|STRING|propertyOrdering/)
  })

  it('puts instructions in the first user message and keeps roles alternating', () => {
    const req: JsonRequest = {
      system: 'RULES',
      schema: LOCAL_TURN_SCHEMA,
      messages: [
        { role: 'user', text: '[Session start]' },
        { role: 'model', text: 'नमस्ते!' },
        { role: 'user', text: 'मैं ठीक हूँ' },
      ],
    }
    const msgs = buildLocalMessages(req)
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(msgs[0].content.startsWith('RULES')).toBe(true)
    expect(msgs[0].content).toContain('[Session start]')
  })

  it('sends earlier replies back exactly as generated so the model can reuse its cache', async () => {
    const raw = '{"correction":{"needed":false,"you_said":"","better":"","rule":""},"evidence":[],"reply":"आप कैसे हैं?","reply_english":"How are you?","placement_complete":false}'
    const calls: unknown[] = []
    const fake = {
      chat: {
        completions: {
          create: async (r: unknown) => {
            calls.push(r)
            return { choices: [{ message: { content: raw }, finish_reason: 'stop' }] }
          },
        },
      },
    }
    const first = await runLocalJson<{ reply: string }>(fake, { system: 'S', schema: LOCAL_TURN_SCHEMA, messages: [{ role: 'user', text: '[Session start]' }] })
    expect(first.reply).toBe('आप कैसे हैं?')
    const sent = calls[0] as { response_format: { type: string; schema: string }; max_tokens: number }
    expect(sent.response_format.type).toBe('json_object')
    expect(JSON.parse(sent.response_format.schema).type).toBe('object')
    const again = buildLocalMessages({
      system: 'S',
      schema: LOCAL_TURN_SCHEMA,
      messages: [
        { role: 'user', text: '[Session start]' },
        { role: 'model', text: 'आप कैसे हैं?' },
        { role: 'user', text: 'मैं ठीक हूँ' },
      ],
    })
    expect(again[1].content).toBe(raw)
  })

  it('reports a cut-off answer clearly', async () => {
    const fake = { chat: { completions: { create: async () => ({ choices: [{ message: { content: '{"reply":"अधू' }, finish_reason: 'length' }] }) } } }
    await expect(runLocalJson(fake, { system: 'S', schema: LOCAL_TURN_SCHEMA, messages: [{ role: 'user', text: 'x' }] })).rejects.toThrow(/cut off/)
  })

  it('keeps a stable, alternating window for long sessions', () => {
    const turns = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 === 0 ? 'rani' : 'user', text: `t${i}`, at: i }) as Session['turns'][number])
    const session: Session = { lang: 'hi', kind: 'practice', topic: 'daily', focus: 'future', startedAt: 0, activeSeconds: 0, turns }
    const full = toMessages(session)
    const windowed = toMessages(session, true)
    expect(full).toHaveLength(26)
    expect(windowed.length).toBeLessThan(full.length)
    expect(windowed.map((m) => m.role)).toEqual(windowed.map((_, i) => (i % 2 === 0 ? 'user' : 'model')))
    // Adding one more turn doesn't move the window start (prefix stays cached); it only moves every 8 turns.
    const next = toMessages({ ...session, turns: [...turns, { role: 'user', text: 't25', at: 25 }] }, true)
    expect(next[1]).toEqual(windowed[1])
  })

  it('local prompt is identical across turns and adapts to the learner gender', () => {
    const s = { ...DEFAULT_SETTINGS, learnerName: 'Gilbert', learnerGender: 'f' as const }
    const p = defaultProfile('hi')
    const a = practiceSystemLocal(s, p, 'ne_construction', 'daily')
    expect(a).toBe(practiceSystemLocal(s, p, 'ne_construction', 'daily'))
    expect(a).toContain('मैं बाज़ार गई')
    expect(a.length).toBeLessThan(3500)
  })

  it('without any brain set up, explains how to set one up', async () => {
    await expect(generateJson({ system: '', schema: LOCAL_TURN_SCHEMA, messages: [] }, DEFAULT_SETTINGS)).rejects.toThrow(/brain isn't set up/)
  })
})
