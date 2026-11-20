import { builtinJson } from './builtin'
import { localJson } from './local'
import type { LlmProvider, Settings } from './store'

/** Subset of the Gemini/OpenAPI schema format, also shown to Groq as text. */
export interface Schema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'BOOLEAN' | 'INTEGER' | 'NUMBER'
  description?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  enum?: string[]
  /** Gemini emits properties in this order (so the correction is decided before the reply). */
  propertyOrdering?: string[]
}

export interface ChatMsg {
  role: 'user' | 'model'
  text: string
}

export interface JsonRequest {
  system: string
  messages: ChatMsg[]
  schema: Schema
  temperature?: number
  /** Output token cap (used by the on-phone model). */
  maxTokens?: number
}

/** A request, or a function building one per provider (the on-phone model gets shorter prompts). */
export type JsonRequestSource = JsonRequest | ((provider: LlmProvider) => JsonRequest)

export class ApiError extends Error {
  status?: number
  provider: string
  retriable: boolean
  constructor(provider: string, message: string, status?: number, retriable = false) {
    super(message)
    this.provider = provider
    this.status = status
    this.retriable = retriable
  }
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GROQ_BASE = 'https://api.groq.com/openai/v1'

function friendly(provider: string, status: number, body: string): ApiError {
  const name = provider === 'gemini' ? 'Gemini' : 'Groq'
  if (status === 400 && /api[_ ]key/i.test(body)) return new ApiError(provider, `${name} API key is not valid. Check it in Settings.`, status)
  if (status === 401 || status === 403) return new ApiError(provider, `${name} rejected the API key. Check it in Settings.`, status)
  if (status === 404) return new ApiError(provider, `${name} model not found. Pick another model in Settings.`, status, true)
  if (status === 429) return new ApiError(provider, `${name} free-tier limit reached. Wait a minute and try again.`, status, true)
  if (status >= 500) return new ApiError(provider, `${name} is having trouble right now (${status}).`, status, true)
  return new ApiError(provider, `${name} error ${status}: ${body.slice(0, 200)}`, status)
}

async function doFetch(provider: string, url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError(provider, 'Could not reach the server. Check your internet connection.', undefined, true)
  }
  if (!res.ok) throw friendly(provider, res.status, await res.text().catch(() => ''))
  return res
}

export function parseJsonLoose<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t) as T
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1)) as T
    throw new Error('The AI returned an unreadable answer. Please try again.')
  }
}

/** Gemini rejects consecutive messages with the same role in some models — merge them. */
function mergeRoles(msgs: ChatMsg[]): ChatMsg[] {
  const out: ChatMsg[] = []
  for (const m of msgs) {
    const prev = out.at(-1)
    if (prev && prev.role === m.role) prev.text += '\n\n' + m.text
    else out.push({ ...m })
  }
  if (out.length === 0 || out[0].role !== 'user') out.unshift({ role: 'user', text: '[Start]' })
  return out
}

async function geminiJson<T>(req: JsonRequest, key: string, model: string): Promise<T> {
  const res = await doFetch('gemini', `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: mergeRoles(req.messages).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: req.schema,
        temperature: req.temperature ?? 0.7,
      },
    }),
  })
  const data = await res.json()
  const cand = data.candidates?.[0]
  const text: string = (cand?.content?.parts ?? [])
    .filter((p: { thought?: boolean; text?: string }) => !p.thought && p.text)
    .map((p: { text: string }) => p.text)
    .join('')
  if (!text) {
    const reason = cand?.finishReason || data.promptFeedback?.blockReason || 'empty response'
    throw new ApiError('gemini', `Gemini returned no answer (${reason}).`, undefined, true)
  }
  return parseJsonLoose<T>(text)
}

async function groqJson<T>(req: JsonRequest, key: string, model: string): Promise<T> {
  const system =
    req.system +
    '\n\nRespond ONLY with a single JSON object (no markdown) that matches this JSON schema:\n' +
    JSON.stringify(req.schema)
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: system },
      ...mergeRoles(req.messages).map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
    ],
    response_format: { type: 'json_object' },
    temperature: req.temperature ?? 0.7,
  }
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low'
  const res = await doFetch('groq', `${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new ApiError('groq', 'Groq returned no answer.', undefined, true)
  return parseJsonLoose<T>(text)
}

export function providerAvailable(s: Settings, p: LlmProvider): boolean {
  if (p === 'builtin') return s.builtinAiReady
  if (p === 'local') return s.localModelReady && !!s.localModel
  return p === 'gemini' ? !!s.geminiKey : !!s.groqKey
}

export function hasLlm(s: Settings): boolean {
  return (['builtin', 'local', 'gemini', 'groq'] as LlmProvider[]).some((p) => providerAvailable(s, p))
}

export const PROVIDER_NAME: Record<LlmProvider, string> = { builtin: 'Built-in AI', local: 'On phone', gemini: 'Gemini', groq: 'Groq' }

/** Small on-device models get the compact prompts. */
export function isOnDevice(p: LlmProvider): boolean {
  return p === 'local' || p === 'builtin'
}

/**
 * Ask the primary brain for JSON; if it fails, try the other configured ones
 * (on-phone model, Gemini, Groq — whichever are set up).
 */
export async function generateJson<T>(source: JsonRequestSource, s: Settings): Promise<{ data: T; provider: LlmProvider }> {
  const all: LlmProvider[] = ['builtin', 'local', 'gemini', 'groq']
  const order = [s.llmPrimary, ...all.filter((p) => p !== s.llmPrimary)]
  const usable = order.filter((p) => providerAvailable(s, p))
  if (usable.length === 0) throw new ApiError('none', "Rani's brain isn't set up yet. Download it in Settings → Rani's brain (or add a Gemini key).")
  let lastErr: unknown
  for (const p of usable) {
    const req = typeof source === 'function' ? source(p) : source
    try {
      const data =
        p === 'builtin'
          ? await builtinJson<T>(req, s.builtinAiHindi)
          : p === 'local'
          ? await localJson<T>(req, s.localModel)
          : p === 'gemini'
            ? await geminiJson<T>(req, s.geminiKey, s.geminiModel)
            : await groqJson<T>(req, s.groqKey, s.groqModel)
      return { data, provider: p }
    } catch (e) {
      lastErr = e
      // Bad key / bad request on primary: still try the fallback, it may be fine.
    }
  }
  throw lastErr
}

// ---------- Model discovery ----------

/** All Gemini models usable with generateContent (chat and speech models). */
export async function listGeminiModels(key: string): Promise<string[]> {
  const res = await doFetch('gemini', `${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } })
  const data = await res.json()
  return (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace(/^models\//, ''))
    .filter((n: string) => /^gemini/.test(n))
}

export function geminiChatModels(models: string[]): string[] {
  return models.filter((n) => !/(tts|image|embed|live|audio|vision|robotics|computer)/i.test(n))
}

/** Voice models Google has shut down (Nov 17, 2026) — never offer or use these. */
export const RETIRED_TTS = /^(gemini-2\.5-(flash|pro)-preview-tts|gemini-3\.1-flash-tts-preview)$/

export function isRetiredTts(model: string): boolean {
  return RETIRED_TTS.test(model)
}

export function geminiTtsModels(models: string[]): string[] {
  return models.filter((n) => /tts/i.test(n) && !isRetiredTts(n))
}

function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

/** Prefer the newest stable "flash" model (fast + generous free tier). */
export function pickGeminiModel(all: string[]): string | undefined {
  const models = geminiChatModels(all)
  const flash = models.filter((n) => /flash/.test(n) && !/lite/.test(n))
  const stable = flash.filter((n) => /^gemini-\d+(\.\d+)?-flash$/.test(n))
  const rank = (list: string[]) => [...list].sort((a, b) => versionOf(b) - versionOf(a))[0]
  return rank(stable) ?? (models.includes('gemini-flash-latest') ? 'gemini-flash-latest' : undefined) ?? rank(flash) ?? models[0]
}

/**
 * Rani is a live conversation, so prefer the newest stable Flash-Lite voice
 * (built for real-time agents), then the newest stable Flash voice, then
 * previews. Retired models are never picked.
 */
export function pickGeminiTtsModel(all: string[]): string | undefined {
  const tts = geminiTtsModels(all)
  const newest = (list: string[]) => [...list].sort((a, b) => versionOf(b) - versionOf(a))[0]
  const stable = tts.filter((n) => !/preview|exp/.test(n))
  return (
    newest(stable.filter((n) => /flash-lite/.test(n))) ??
    newest(stable.filter((n) => /flash/.test(n))) ??
    newest(tts.filter((n) => /flash/.test(n))) ??
    newest(tts)
  )
}

export async function listGroqModels(key: string): Promise<string[]> {
  const res = await doFetch('groq', `${GROQ_BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })
  const data = await res.json()
  return (data.data ?? []).filter((m: { active?: boolean }) => m.active !== false).map((m: { id: string }) => m.id)
}

const GROQ_CHAT_PREFS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']

export function pickGroqChatModel(models: string[]): string | undefined {
  return GROQ_CHAT_PREFS.find((m) => models.includes(m)) ?? models.find((m) => !/whisper|tts|guard|playai|orpheus|compound/i.test(m))
}

export function pickWhisperModel(models: string[]): string {
  return ['whisper-large-v3', 'whisper-large-v3-turbo'].find((m) => models.includes(m)) ?? 'whisper-large-v3'
}

// ---------- Gemini audio transcription (no Groq key needed) ----------

export async function geminiTranscribe(wavBase64: string, langName: string, key: string, model: string): Promise<string> {
  const res = await doFetch('gemini', `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: wavBase64 } },
            {
              text:
                `Transcribe this ${langName} speech verbatim in Devanagari script. ` +
                'The speaker is a language learner: keep every grammatical mistake exactly as spoken — do NOT correct gender, verb endings or postpositions. ' +
                'English words may stay in Latin script. Output only the transcript. If there is no speech, output an empty string.',
            },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    }),
  })
  const data = await res.json()
  return ((data.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
}

export async function groqTranscribe(blob: Blob, lang: 'hi' | 'mr', key: string, model: string): Promise<string> {
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : 'webm'
  const form = new FormData()
  form.append('file', blob, `speech.${ext}`)
  form.append('model', model)
  form.append('language', lang)
  form.append('response_format', 'json')
  form.append('temperature', '0')
  // Neutral prompt nudges Devanagari output without biasing gendered verb forms.
  form.append('prompt', lang === 'hi' ? 'नमस्ते। आज हम हिंदी में बात करेंगे।' : 'नमस्कार. आज आपण मराठीत बोलूया.')
  const res = await doFetch('groq', `${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  const data = await res.json()
  return String(data.text ?? '').trim()
}

// ---------- Gemini text-to-speech ----------

export interface GeminiAudio {
  data: string
  mimeType: string
}

export async function geminiSpeech(text: string, key: string, model: string, voice: string, style: string): Promise<GeminiAudio> {
  const res = await doFetch('gemini', `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${style}: ${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  })
  const data = await res.json()
  const part = ((data.candidates?.[0]?.content?.parts ?? []) as { inlineData?: GeminiAudio }[]).find((p) => p.inlineData?.data)
  if (!part?.inlineData) throw new ApiError('gemini', 'Gemini returned no audio.', undefined, true)
  return part.inlineData
}
