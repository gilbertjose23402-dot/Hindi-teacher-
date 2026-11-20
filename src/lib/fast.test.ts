import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../db'
import { DEFAULT_SETTINGS } from './store'
import { isFastMode, runFastTurn } from './tutor'

afterEach(() => vi.unstubAllGlobals())

/** A fetch Response whose body arrives as Gemini SSE events, split into awkward chunks. */
function sseResponse(texts: string[]): Response {
  const events = texts.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`).join('')
  const bytes = new TextEncoder().encode(events)
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37))
      c.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const answer = JSON.stringify({
  transcript: 'कल मैंने कोर्ट गया',
  correction: { needed: true, you_said: 'कल मैंने कोर्ट गया', better: 'कल मैं कोर्ट गया', rule: 'No ने with जाना.', tip: '', skill: 'ne_construction' },
  reply: 'अच्छा! फिर क्या हुआ?',
  evidence: [{ skill: 'ne_construction', correct: false }],
  reply_roman: 'achchha! phir kya hua?',
  reply_english: 'Nice! Then what happened?',
  placement_complete: false,
})

describe('fast mode', () => {
  it('is on only when Gemini both listens and thinks', () => {
    const base = { ...DEFAULT_SETTINGS, geminiKey: 'k' }
    expect(isFastMode({ ...base, llmPrimary: 'gemini', sttEngine: 'gemini' })).toBe(true)
    expect(isFastMode({ ...base, llmPrimary: 'local', sttEngine: 'gemini' })).toBe(false)
    expect(isFastMode({ ...base, llmPrimary: 'gemini', sttEngine: 'browser' })).toBe(false)
    expect(isFastMode({ ...DEFAULT_SETTINGS, llmPrimary: 'gemini', sttEngine: 'gemini' })).toBe(false)
  })

  it('sends the recording in one streamed call and reports transcript before reply', async () => {
    let url = ''
    let body: { systemInstruction: { parts: { text: string }[] }; contents: { role: string; parts: Record<string, unknown>[] }[]; generationConfig: { responseSchema: { propertyOrdering: string[] } } } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string, init: { body: string }) => {
        url = u
        body = JSON.parse(init.body)
        const third = Math.ceil(answer.length / 3)
        return sseResponse([answer.slice(0, third), answer.slice(third, 2 * third), answer.slice(2 * third)])
      }),
    )
    const session: Session = {
      lang: 'hi',
      kind: 'practice',
      topic: 'daily',
      focus: 'ne_construction',
      startedAt: 0,
      activeSeconds: 0,
      turns: [{ role: 'rani', text: 'नमस्ते! कल आपने क्या किया?', at: 1 }],
    }
    const events: string[] = []
    const res = await runFastTurn(session, 'UklGRg==', { ...DEFAULT_SETTINGS, geminiKey: 'k', geminiModel: 'gemini-2.5-flash', llmPrimary: 'gemini', sttEngine: 'gemini' }, {
      onTranscript: (t) => events.push('transcript:' + t),
      onReply: (r) => events.push('reply:' + r),
    })
    expect(url).toContain(':streamGenerateContent?alt=sse')
    const last = body!.contents.at(-1)!
    expect(last.role).toBe('user')
    expect(last.parts[0]).toEqual({ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } })
    expect(body!.systemInstruction.parts[0].text).toContain('FAST MODE')
    expect(body!.generationConfig.responseSchema.propertyOrdering[0]).toBe('transcript')
    expect(events).toEqual(['transcript:कल मैंने कोर्ट गया', 'reply:अच्छा! फिर क्या हुआ?'])
    expect(res.transcript).toBe('कल मैंने कोर्ट गया')
    expect(res.correction?.better).toBe('कल मैं कोर्ट गया')
    expect(res.english).toBe('Nice! Then what happened?')
  })

  it('keeps an empty transcript empty (nothing was heard)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([JSON.stringify({ transcript: '', correction: { needed: false }, reply: 'फिर से बोलिए?', evidence: [] })])))
    const session: Session = { lang: 'hi', kind: 'practice', topic: 'daily', focus: 'future', startedAt: 0, activeSeconds: 0, turns: [] }
    const res = await runFastTurn(session, 'x', { ...DEFAULT_SETTINGS, geminiKey: 'k', llmPrimary: 'gemini', sttEngine: 'gemini' })
    expect(res.transcript).toBe('')
  })
})
