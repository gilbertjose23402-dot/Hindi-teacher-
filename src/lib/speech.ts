import type { Lang } from '../db'
import { ApiError, geminiTranscribe, groqTranscribe } from './llm'
import type { Settings, SttEngine } from './store'

export const LANG_TAG: Record<Lang, string> = { hi: 'hi-IN', mr: 'mr-IN' }
export const LANG_NAME: Record<Lang, string> = { hi: 'Hindi', mr: 'Marathi' }

export interface Listening {
  /** Stop listening and return the transcript ('' if nothing was heard). */
  finish(): Promise<string>
  cancel(): void
  /** 0..1 microphone level for the meter. */
  level(): number
}

export class NoSpeechError extends Error {}

/** Which engine will actually be used given the keys that exist. */
export function effectiveStt(s: Settings): SttEngine {
  if (s.sttEngine === 'groq' && s.groqKey) return 'groq'
  if (s.sttEngine === 'gemini' && s.geminiKey) return 'gemini'
  if (s.sttEngine === 'browser' && browserRecognitionAvailable()) return 'browser'
  if (s.groqKey) return 'groq'
  if (s.geminiKey) return 'gemini'
  return 'browser'
}

export async function startListening(s: Settings, lang: Lang): Promise<Listening> {
  const engine = effectiveStt(s)
  if (engine === 'browser') return startBrowserRecognition(lang)
  const rec = await startRecording()
  return {
    level: rec.level,
    cancel: rec.cancel,
    async finish() {
      const { blob, durationMs, peak } = await rec.stop()
      if (durationMs < 600 || peak < 0.02) throw new NoSpeechError("I didn't hear anything — tap the mic and speak.")
      if (engine === 'groq') return groqTranscribe(blob, lang, s.groqKey, s.whisperModel)
      const wav = await blobToWavBase64(blob)
      return geminiTranscribe(wav, LANG_NAME[lang], s.geminiKey, s.geminiModel)
    },
  }
}

// ---------- MediaRecorder ----------

interface Recording {
  stop(): Promise<{ blob: Blob; durationMs: number; peak: number }>
  cancel(): void
  level(): number
}

function pickMime(): string | undefined {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))
}

async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia) throw new ApiError('mic', 'This browser cannot record audio.')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  } catch {
    throw new ApiError('mic', 'Microphone permission was denied. Allow it in your browser/app settings.')
  }
  const mime = pickMime()
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  src.connect(analyser)
  const buf = new Uint8Array(analyser.fftSize)
  let peak = 0
  let current = 0
  const sample = () => {
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += ((v - 128) / 128) ** 2
    current = Math.min(1, Math.sqrt(sum / buf.length) * 4)
    peak = Math.max(peak, current)
  }
  const timer = window.setInterval(sample, 60)
  const started = performance.now()
  recorder.start(250)

  const cleanup = () => {
    window.clearInterval(timer)
    stream.getTracks().forEach((t) => t.stop())
    ctx.close().catch(() => {})
  }

  return {
    level: () => current,
    cancel() {
      try {
        recorder.stop()
      } catch {
        /* already stopped */
      }
      cleanup()
    },
    stop() {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup()
          resolve({ blob: new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' }), durationMs: performance.now() - started, peak })
        }
        recorder.stop()
      })
    },
  }
}

/** Decode any recorded audio and re-encode as 16 kHz mono WAV (base64) for Gemini. */
async function blobToWavBase64(blob: Blob): Promise<string> {
  const arr = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(arr)
  ctx.close().catch(() => {})
  const rate = 16000
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  const pcm = rendered.getChannelData(0)
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  out.setUint32(4, 36 + pcm.length * 2, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, 1, true)
  out.setUint32(24, rate, true)
  out.setUint32(28, rate * 2, true)
  out.setUint16(32, 2, true)
  out.setUint16(34, 16, true)
  w(36, 'data')
  out.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]))
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  const bytes = new Uint8Array(out.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// ---------- Phone's built-in speech recognition (Web Speech API) ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any

function recognitionCtor(): (new () => AnyRecognition) | undefined {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => AnyRecognition) | undefined
}

export function browserRecognitionAvailable(): boolean {
  return !!recognitionCtor()
}

function startBrowserRecognition(lang: Lang): Promise<Listening> {
  const Ctor = recognitionCtor()
  if (!Ctor) return Promise.reject(new ApiError('mic', "This phone's speech recognition is not available. Add a Groq key in Settings."))
  const finals: string[] = []
  let interim = ''
  let stopped = false
  let resolveEnd: (() => void) | null = null
  let error: string | null = null
  let rec: AnyRecognition

  const begin = () => {
    rec = new Ctor()
    rec.lang = LANG_TAG[lang]
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 1
    rec.onresult = (e: AnyRecognition) => {
      interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finals.push(r[0].transcript)
        else interim += r[0].transcript
      }
    }
    rec.onerror = (e: AnyRecognition) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') error = 'Microphone permission was denied.'
      else if (e.error !== 'no-speech' && e.error !== 'aborted') error = `Speech recognition error: ${e.error}`
    }
    rec.onend = () => {
      // Android ends recognition after a pause; keep listening until the user taps stop.
      if (!stopped && !error) {
        try {
          begin()
          return
        } catch {
          /* fall through */
        }
      }
      resolveEnd?.()
    }
    rec.start()
  }
  begin()

  return Promise.resolve({
    level: () => (interim ? 0.6 : 0.25),
    cancel() {
      stopped = true
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    },
    finish() {
      stopped = true
      return new Promise<string>((resolve, reject) => {
        const done = () => {
          if (error) return reject(new ApiError('mic', error))
          const text = [...finals, interim].join(' ').replace(/\s+/g, ' ').trim()
          if (!text) return reject(new NoSpeechError("I didn't catch that — tap the mic and try again."))
          resolve(text)
        }
        resolveEnd = done
        try {
          rec.stop()
        } catch {
          done()
        }
        setTimeout(done, 2500)
      })
    },
  })
}

// ---------- Text to speech ----------

let voicesCache: SpeechSynthesisVoice[] = []

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsAvailable()) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve((voicesCache = now))
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve((voicesCache = speechSynthesis.getVoices())), 2000)
    speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearTimeout(t)
        resolve((voicesCache = speechSynthesis.getVoices()))
      },
      { once: true },
    )
  })
}

export function voicesFor(lang: Lang, all = voicesCache): SpeechSynthesisVoice[] {
  return all.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang))
}

function chooseVoice(lang: Lang, uri: string): SpeechSynthesisVoice | undefined {
  const list = voicesFor(lang)
  return list.find((v) => v.voiceURI === uri) ?? list.find((v) => /female/i.test(v.name)) ?? list.find((v) => /google/i.test(v.name)) ?? list[0]
}

/** Strip things a voice shouldn't read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/[*_#`>~]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunks(text: string): string[] {
  const parts = text.split(/(?<=[।॥?!.])\s+/)
  const out: string[] = []
  for (const p of parts) {
    if (p.length <= 220) out.push(p)
    else out.push(...(p.match(/.{1,220}(\s|$)/g) ?? [p]))
  }
  return out.filter((p) => p.trim())
}

let speakToken = 0

export function stopSpeaking(): void {
  speakToken++
  if (ttsAvailable()) speechSynthesis.cancel()
}

export async function speak(text: string, lang: Lang, s: Pick<Settings, 'voiceHi' | 'voiceMr' | 'speechRate'>): Promise<void> {
  if (!ttsAvailable()) return
  stopSpeaking()
  const token = speakToken
  if (!voicesCache.length) await loadVoices()
  const voice = chooseVoice(lang, lang === 'hi' ? s.voiceHi : s.voiceMr)
  for (const part of chunks(speakable(text))) {
    if (token !== speakToken) return
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part)
      u.lang = voice?.lang ?? LANG_TAG[lang]
      if (voice) u.voice = voice
      u.rate = s.speechRate
      // Some Android builds never fire onend — don't hang the conversation.
      const guard = setTimeout(resolve, 1500 + part.length * 140)
      u.onend = u.onerror = () => {
        clearTimeout(guard)
        resolve()
      }
      speechSynthesis.speak(u)
    })
  }
}
