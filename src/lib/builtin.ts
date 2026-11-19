/**
 * The phone's built-in AI as exposed to web pages by Chrome (Prompt API /
 * Gemini Nano). Native on-device AI (AICore, Moto AI) is only reachable from
 * Play Store apps, so this is the one route a web app has — when Chrome offers it.
 */
import { parseJsonLoose, type JsonRequest } from './llm'
import { reportBrainProgress, toJsonSchema } from './local'

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface LMSession {
  prompt(input: string, opts?: { responseConstraint?: object }): Promise<string>
  destroy(): void
}

interface LMMonitor {
  addEventListener(type: 'downloadprogress', cb: (e: { loaded: number }) => void): void
}

interface LMStatic {
  availability(opts?: object): Promise<Availability>
  create(opts?: object): Promise<LMSession>
}

function api(): LMStatic | undefined {
  return (globalThis as unknown as { LanguageModel?: LMStatic }).LanguageModel
}

const HINDI_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en', 'hi'] }],
  expectedOutputs: [{ type: 'text', languages: ['hi', 'en'] }],
}

export interface BuiltinStatus {
  /** 'missing' = Chrome on this phone doesn't expose built-in AI to web apps. */
  state: 'missing' | Availability
  /** Whether Chrome says the built-in model supports Hindi. */
  hindi: boolean
}

export async function checkBuiltinAi(): Promise<BuiltinStatus> {
  const lm = api()
  if (!lm) return { state: 'missing', hindi: false }
  try {
    const a = await lm.availability(HINDI_OPTS)
    if (a !== 'unavailable') return { state: a, hindi: true }
  } catch {
    /* language options not supported — try plain */
  }
  try {
    return { state: await lm.availability(), hindi: false }
  } catch {
    return { state: 'unavailable', hindi: false }
  }
}

async function createSession(hindi: boolean, initialPrompts: { role: string; content: string }[]): Promise<LMSession> {
  const lm = api()
  if (!lm) throw new Error("This phone's built-in AI isn't available in Chrome.")
  return lm.create({
    ...(hindi ? HINDI_OPTS : {}),
    initialPrompts,
    monitor(m: LMMonitor) {
      m.addEventListener('downloadprogress', (e) => reportBrainProgress(e.loaded < 1 ? { progress: e.loaded, text: 'Preparing the phone’s built-in AI…' } : null))
    },
  })
}

/** Run one JSON request on the built-in model (a fresh session per request). */
export async function builtinJson<T>(req: JsonRequest, hindi: boolean): Promise<T> {
  const history = req.messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }))
  let last = history.pop()
  if (!last || last.role !== 'user') {
    if (last) history.push(last)
    last = { role: 'user', content: '[Continue]' }
  }
  const session = await createSession(hindi, [{ role: 'system', content: req.system }, ...history])
  try {
    const raw = await session.prompt(last.content, { responseConstraint: toJsonSchema(req.schema) })
    return parseJsonLoose<T>(raw)
  } finally {
    reportBrainProgress(null)
    session.destroy()
  }
}
