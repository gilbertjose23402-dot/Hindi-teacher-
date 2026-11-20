import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractPartialReply, generateJson } from './llm'
import { runLocalJson } from './local'
import { LOCAL_TURN_SCHEMA, TURN_SCHEMA } from './prompts'
import { pcmToWav } from './speech'
import { DEFAULT_SETTINGS } from './store'
import { fromLocalTurn, normalizeTurn } from './tutor'

afterEach(() => vi.unstubAllGlobals())

describe('reply-first streaming', () => {
  it('finds the reply only once its text is complete', () => {
    expect(extractPartialReply('{"reply":"अच्छा, आप कल')).toBeNull()
    expect(extractPartialReply('{"reply":"अच्छा! आप \\"कोर्ट\\" गए?","correction":{"bet')).toBe('अच्छा! आप "कोर्ट" गए?')
    expect(extractPartialReply('{"reply":"","corr')).toBeNull()
  })

  it('streams the on-phone answer and reports partial text', async () => {
    const pieces = ['{"reply":"नमस्ते', '! आप कैसे हैं?"', ',"correction":{"better":"","rule":"","skill":"none"},"used":"none"}']
    const seen: string[] = []
    const fake = {
      chat: {
        completions: {
          create: async (r: { stream?: boolean; max_tokens?: number }) => {
            expect(r.stream).toBe(true)
            return (async function* () {
              for (const p of pieces) yield { choices: [{ delta: { content: p }, finish_reason: null }] }
              yield { choices: [{ delta: {}, finish_reason: 'stop' }] }
            })()
          },
        },
      },
    }
    const out = await runLocalJson<{ reply: string }>(fake, { system: 'S', schema: LOCAL_TURN_SCHEMA, messages: [{ role: 'user', text: 'x' }] }, (raw) =>
      seen.push(raw),
    )
    expect(out.reply).toBe('नमस्ते! आप कैसे हैं?')
    expect(extractPartialReply(seen[1])).toBe('नमस्ते! आप कैसे हैं?')
  })

  it('keeps the on-phone answer short: reply first, no translation or bookkeeping', () => {
    expect(Object.keys(LOCAL_TURN_SCHEMA.properties!)).toEqual(['reply', 'correction', 'used'])
  })
})

describe('short on-phone answers become full turns', () => {
  it('a mistake becomes a correction card and a miss for that skill', () => {
    const t = normalizeTurn(
      fromLocalTurn(
        { reply: 'अच्छा!', correction: { better: 'मैं कोर्ट गया।', rule: 'No ने with जाना.', skill: 'ne_construction' }, used: 'present_tense' },
        'मैंने कोर्ट गया।',
      ),
    )
    expect(t.correction).toMatchObject({ you_said: 'मैंने कोर्ट गया।', better: 'मैं कोर्ट गया।', skill: 'ne_construction' })
    expect(t.evidence).toEqual([
      { skill: 'ne_construction', correct: false },
      { skill: 'present_tense', correct: true },
    ])
  })

  it('a correct sentence gives credit to the skill used and no card', () => {
    const t = normalizeTurn(fromLocalTurn({ reply: 'बढ़िया!', correction: { better: '', rule: '', skill: 'none' }, used: 'future' }, 'मैं कल जाऊँगा।'))
    expect(t.correction).toBeNull()
    expect(t.evidence).toEqual([{ skill: 'future', correct: true }])
  })

  it('a "correction" identical to what was said is ignored', () => {
    const t = normalizeTurn(fromLocalTurn({ reply: 'ठीक है', correction: { better: 'मैं ठीक हूँ', rule: 'x', skill: 'present_tense' }, used: 'none' }, 'मैं ठीक हूँ'))
    expect(t.correction).toBeNull()
  })
})

describe('Gemini without thinking', () => {
  it('asks for minimal thinking, and retries without it if the model refuses', async () => {
    const bodies: Record<string, unknown>[] = []
    const ok = { candidates: [{ content: { parts: [{ text: '{"reply":"हाँ"}' }] } }] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body))
        if (bodies.length === 1) return new Response('thinking_level not supported', { status: 400 })
        return new Response(JSON.stringify(ok), { status: 200 })
      }),
    )
    const s = { ...DEFAULT_SETTINGS, geminiKey: 'k', geminiModel: 'gemini-3.8-flash', llmPrimary: 'gemini' as const }
    const { data } = await generateJson<{ reply: string }>({ system: 'S', schema: TURN_SCHEMA, messages: [{ role: 'user', text: 'x' }] }, s)
    expect(data.reply).toBe('हाँ')
    const gc = (b: Record<string, unknown>) => b.generationConfig as Record<string, unknown>
    expect(gc(bodies[0]).thinkingConfig).toEqual({ thinkingLevel: 'minimal' })
    expect(gc(bodies[1]).thinkingConfig).toBeUndefined()
    // Remembered: the next call goes straight to the plain request.
    await generateJson({ system: 'S', schema: TURN_SCHEMA, messages: [{ role: 'user', text: 'y' }] }, s)
    expect(gc(bodies[2]).thinkingConfig).toBeUndefined()
  })

  it('turns thinking fully off for 2.5 Flash', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body))
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"x"}' }] } }] }))
      }),
    )
    const s = { ...DEFAULT_SETTINGS, geminiKey: 'k', geminiModel: 'gemini-2.5-flash', llmPrimary: 'gemini' as const }
    await generateJson({ system: 'S', schema: TURN_SCHEMA, messages: [{ role: 'user', text: 'x' }] }, s)
    expect((bodies[0].generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingBudget: 0 })
  })
})

describe('voice audio', () => {
  it('wraps Gemini PCM in a valid WAV header', async () => {
    const wav = pcmToWav(new Uint8Array(480), 24000)
    expect(wav.type).toBe('audio/wav')
    expect(wav.size).toBe(44 + 480)
    const head = new DataView(await wav.arrayBuffer())
    expect(String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3))).toBe('RIFF')
    expect(head.getUint32(24, true)).toBe(24000)
  })
})
