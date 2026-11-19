/**
 * Rani's on-phone brain: a small Gemma model running inside Chrome via WebGPU
 * (WebLLM). Downloaded once, then cached on the phone — no account needed.
 */
import { useSyncExternalStore } from 'react'
import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import { parseJsonLoose, type JsonRequest, type Schema } from './llm'

export interface LocalModel {
  /** WebLLM model id using 16-bit shaders (smaller, faster). */
  base: string
  /** Fallback id for GPUs without 16-bit shader support. */
  f32?: string
  label: string
  size: string
  note: string
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    base: 'gemma-4-E2B-it-q4f16_1-MLC',
    f32: 'gemma-4-E2B-it-q4f32_1-MLC',
    label: 'Gemma 4 E2B',
    size: 'about 3 GB',
    note: 'Best Hindi of the three. Needs a recent phone with 8 GB+ RAM.',
  },
  {
    base: 'gemma-2-2b-it-q4f16_1-MLC',
    f32: 'gemma-2-2b-it-q4f32_1-MLC',
    label: 'Gemma 2 2B',
    size: 'about 1.5 GB',
    note: 'Lighter and quicker, but weaker Hindi grammar.',
  },
  {
    base: 'gemma3-1b-it-q4f16_1-MLC',
    label: 'Gemma 3 1B',
    size: 'about 0.7 GB',
    note: 'Smallest and fastest. Corrections will often be wrong.',
  },
]

export function modelLabel(id: string): string {
  return LOCAL_MODELS.find((m) => m.base === id || m.f32 === id)?.label ?? id
}

// ---------- Device checks ----------

export interface GpuStatus {
  ok: boolean
  f16: boolean
  reason?: string
}

let gpuCache: Promise<GpuStatus> | null = null

export function checkWebGpu(): Promise<GpuStatus> {
  if (gpuCache) return gpuCache
  gpuCache = (async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu
    if (!gpu) {
      return { ok: false, f16: false, reason: "This browser can't run AI on the phone (WebGPU is missing). Update Chrome, or add a free Gemini key instead." }
    }
    try {
      const adapter = await gpu.requestAdapter()
      if (!adapter) return { ok: false, f16: false, reason: "Chrome couldn't access this phone's graphics chip for AI. Add a free Gemini key instead." }
      return { ok: true, f16: adapter.features.has('shader-f16') }
    } catch {
      return { ok: false, f16: false, reason: "Chrome couldn't access this phone's graphics chip for AI." }
    }
  })()
  return gpuCache
}

/** Phones reporting 8 GB+ RAM get the stronger model by default. */
export function recommendedModel(): LocalModel {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  return mem >= 8 ? LOCAL_MODELS[0] : LOCAL_MODELS[1]
}

/** Concrete model id for this GPU, or null if the model can't run here. */
export function resolveModelId(m: LocalModel, f16: boolean): string | null {
  return f16 ? m.base : (m.f32 ?? null)
}

// ---------- Load / download progress (observable) ----------

export interface BrainProgress {
  progress: number
  text: string
}

let progressState: BrainProgress | null = null
const listeners = new Set<() => void>()

function emit(p: BrainProgress | null) {
  progressState = p
  listeners.forEach((l) => l())
}

/** Lets other brains (the phone's built-in AI) show their own download progress. */
export const reportBrainProgress = emit

export function useBrainProgress(): BrainProgress | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => progressState,
  )
}

// ---------- Engine lifecycle ----------

let engine: MLCEngineInterface | null = null
let engineModel: string | null = null
let worker: Worker | null = null
let loading: { id: string; promise: Promise<MLCEngineInterface> } | null = null

function friendlyLoadError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  if (/out of memory|device.*lost|allocation|insufficient|OOM/i.test(msg))
    return new Error("This phone ran out of graphics memory for that model. Pick a smaller model in Settings → Rani's brain.")
  if (/quota|storage/i.test(msg)) return new Error('Not enough free storage on the phone for this model. Free some space or pick a smaller model.')
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg))
    return new Error('The download was interrupted. Check your internet connection and tap Download again — it continues where it stopped.')
  return new Error(`Rani's on-phone brain could not start: ${msg}`)
}

export function brainLoadedModel(): string | null {
  return engineModel
}

/** Download (first time) and load a model into the phone's GPU. */
export function loadBrain(modelId: string): Promise<MLCEngineInterface> {
  if (engine && engineModel === modelId) return Promise.resolve(engine)
  if (loading?.id === modelId) return loading.promise
  const promise = (async () => {
    emit({ progress: 0, text: 'Starting Rani’s brain…' })
    try {
      const webllm = await import('@mlc-ai/web-llm')
      if (engine) {
        await engine.reload(modelId)
      } else {
        worker = new Worker(new URL('./brain.worker.ts', import.meta.url), { type: 'module' })
        engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
          initProgressCallback: (r) => emit({ progress: r.progress, text: r.text }),
        })
      }
      engineModel = modelId
      return engine
    } catch (e) {
      worker?.terminate()
      worker = null
      engine = null
      engineModel = null
      throw friendlyLoadError(e)
    } finally {
      emit(null)
      loading = null
    }
  })()
  loading = { id: modelId, promise }
  return promise
}

export async function isModelDownloaded(modelId: string): Promise<boolean> {
  try {
    const webllm = await import('@mlc-ai/web-llm')
    return await webllm.hasModelInCache(modelId)
  } catch {
    return false
  }
}

export async function deleteModel(modelId: string): Promise<void> {
  if (engineModel === modelId) {
    await engine?.unload().catch(() => {})
    worker?.terminate()
    worker = null
    engine = null
    engineModel = null
  }
  const webllm = await import('@mlc-ai/web-llm')
  await webllm.deleteModelAllInfoInCache(modelId)
}

// ---------- JSON generation ----------

/** Convert the app's Gemini-style schema to standard JSON Schema for constrained decoding. */
export function toJsonSchema(s: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: s.type.toLowerCase() }
  if (s.enum) out.enum = s.enum
  if (s.items) out.items = toJsonSchema(s.items)
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toJsonSchema(v)]))
    out.required = s.required ?? Object.keys(s.properties)
  }
  return out
}

/** The model's exact output for each reply, so the next turn can reuse its memory (KV cache). */
const rawByReply = new Map<string, string>()

export interface LocalMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Gemma has no system role: Rani's instructions go at the top of the first
 * user message. Earlier replies are sent back exactly as the model wrote them
 * so WebLLM recognises the conversation and only processes the new message.
 */
export function buildLocalMessages(req: JsonRequest): LocalMessage[] {
  const msgs: LocalMessage[] = []
  for (const m of req.messages) {
    const role = m.role === 'model' ? 'assistant' : 'user'
    const content = role === 'assistant' ? (rawByReply.get(m.text.trim()) ?? m.text) : m.text
    const prev = msgs.at(-1)
    if (prev && prev.role === role) prev.content += '\n\n' + content
    else msgs.push({ role, content })
  }
  if (msgs.length === 0 || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '[Start]' })
  msgs[0] = { role: 'user', content: `${req.system}\n\n${msgs[0].content}` }
  if (msgs.at(-1)!.role !== 'user') msgs.push({ role: 'user', content: '[Continue]' })
  return msgs
}

interface EngineLike {
  chat: { completions: { create(req: unknown): Promise<unknown> } }
}

export async function runLocalJson<T>(eng: EngineLike, req: JsonRequest): Promise<T> {
  const res = (await eng.chat.completions.create({
    messages: buildLocalMessages(req),
    temperature: req.temperature ?? 0.6,
    max_tokens: req.maxTokens ?? 400,
    response_format: { type: 'json_object', schema: JSON.stringify(toJsonSchema(req.schema)) },
  })) as { choices?: { message?: { content?: string }; finish_reason?: string }[] }
  const choice = res.choices?.[0]
  const raw = choice?.message?.content ?? ''
  if (!raw) throw new Error('Rani’s on-phone brain returned nothing. Please try again.')
  let data: T
  try {
    data = parseJsonLoose<T>(raw)
  } catch {
    throw new Error(choice?.finish_reason === 'length' ? 'Rani’s answer was cut off. Please try again.' : 'Rani’s on-phone brain gave an unreadable answer. Please try again.')
  }
  const reply = (data as { reply?: unknown })?.reply
  if (typeof reply === 'string' && reply.trim()) {
    rawByReply.set(reply.trim(), raw)
    if (rawByReply.size > 200) rawByReply.delete(rawByReply.keys().next().value!)
  }
  return data
}

export async function localJson<T>(req: JsonRequest, modelId: string): Promise<T> {
  const eng = await loadBrain(modelId)
  return runLocalJson<T>(eng as unknown as EngineLike, req)
}
