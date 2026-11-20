import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { RETRY_DELAYS_MS, clearRestingModels, generateJson, geminiModelChain, pickGeminiBackups } from './llm'
import { TURN_SCHEMA } from './prompts'
import { DEFAULT_SETTINGS } from './store'

beforeAll(() => {
  RETRY_DELAYS_MS[0] = 1
  RETRY_DELAYS_MS[1] = 1
})
afterEach(() => {
  vi.unstubAllGlobals()
  clearRestingModels()
})

const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"हाँ"}' }] } }] }))
const s = { ...DEFAULT_SETTINGS, geminiKey: 'k', geminiModel: 'gemini-3.8-flash', geminiBackupModels: ['gemini-2.5-flash'], llmPrimary: 'gemini' as const }
const req = { system: 'S', schema: TURN_SCHEMA, messages: [{ role: 'user' as const, text: 'x' }] }
const modelOf = (url: string) => url.split('/models/')[1].split(':')[0]

describe('Gemini resilience', () => {
  it('retries a busy (503) model and succeeds without the learner noticing', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        urls.push(u)
        return urls.length === 1 ? new Response('overloaded', { status: 503 }) : ok()
      }),
    )
    const { data } = await generateJson<{ reply: string }>(req, s)
    expect(data.reply).toBe('हाँ')
    expect(urls.map(modelOf)).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash'])
  })

  it('moves to a backup model when the main one stays busy or hits its limit', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        urls.push(u)
        return modelOf(u) === 'gemini-3.8-flash' ? new Response('busy', { status: 503 }) : ok()
      }),
    )
    const { data } = await generateJson<{ reply: string }>(req, s)
    expect(data.reply).toBe('हाँ')
    expect(urls.map(modelOf)).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-2.5-flash'])

    urls.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        urls.push(u)
        return modelOf(u) === 'gemini-3.8-flash' ? new Response('quota', { status: 429 }) : ok()
      }),
    )
    clearRestingModels()
    await generateJson(req, s)
    expect(urls.map(modelOf)).toEqual(['gemini-3.8-flash', 'gemini-2.5-flash']) // 429 isn't retried on the same model
  })

  it('remembers a busy model for a while and goes straight to the backup', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        urls.push(u)
        return modelOf(u) === 'gemini-3.8-flash' ? new Response('busy', { status: 503 }) : ok()
      }),
    )
    await generateJson(req, s)
    urls.length = 0
    await generateJson(req, s)
    expect(urls.map(modelOf)).toEqual(['gemini-2.5-flash'])
  })

  it('explains clearly when every model is busy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })))
    await expect(generateJson(req, s)).rejects.toThrow(/busy right now \(tried 2 models\).*Google's side/)
  })

  it('does not retry or switch models for a wrong key', async () => {
    const f = vi.fn(async (_u: string) => new Response('API key not valid', { status: 400 }))
    vi.stubGlobal('fetch', f)
    await expect(generateJson(req, s)).rejects.toThrow(/API key is not valid/)
    // one attempt with the fast-thinking setting, one plain retry (400 might mean the setting was refused)
    expect(f.mock.calls.length).toBeLessThanOrEqual(2)
    expect(new Set(f.mock.calls.map((c) => modelOf(c[0])))).toEqual(new Set(['gemini-3.8-flash']))
  })

  it('picks sensible backups and a default chain for keys tested before this update', () => {
    const all = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.8-flash-tts', 'gemini-3.9-flash-preview']
    expect(pickGeminiBackups(all, 'gemini-3.8-flash')).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash-lite'])
    expect(geminiModelChain({ geminiModel: 'gemini-3.8-flash', geminiBackupModels: [] })).toEqual([
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
    ])
  })
})

describe('Gemini main brain with Gemma downloaded', () => {
  it('never starts loading the slow on-phone model by itself when Gemini fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })))
    const withGemma = { ...s, localModel: 'gemma-4-E2B-it-q4f16_1-MLC', localModelReady: true }
    // If it tried Gemma, the error would come from the on-phone loader instead.
    await expect(generateJson(req, withGemma)).rejects.toThrow(/Gemini servers are busy/)
  })
})
