import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Lang, type Session } from '../db'
import { dayKey } from './dates'
import { defaultSkills, type SkillState } from './skills'

export type SttEngine = 'groq' | 'gemini' | 'browser'
export type TtsEngine = 'gemini' | 'browser'
export type LlmProvider = 'builtin' | 'local' | 'gemini' | 'groq'

export interface Settings {
  onboarded: boolean
  learnerName: string
  /** Grammatical gender Rani uses for the learner (मैं गया vs मैं गई). */
  learnerGender: 'm' | 'f'
  geminiKey: string
  groqKey: string
  geminiModel: string
  /** Other Gemini models to try when the main one is overloaded or rate-limited. */
  geminiBackupModels: string[]
  groqModel: string
  whisperModel: string
  llmPrimary: LlmProvider
  /** WebLLM model id of the on-phone brain ('' until one is downloaded). */
  localModel: string
  localModelReady: boolean
  /** Chrome's built-in AI (Gemini Nano) works on this phone. */
  builtinAiReady: boolean
  builtinAiHindi: boolean
  sttEngine: SttEngine
  ttsEngine: TtsEngine
  geminiTtsModel: string
  /** Gemini prebuilt voice name for Rani. */
  geminiVoice: string
  /** Phone (Android) voices — used when Gemini's voice is off or over its free limit. */
  voiceHi: string
  voiceMr: string
  speechRate: number
  autoSpeak: boolean
  showRomanDefault: boolean
  dailyGoalMin: number
  settingsVersion: number
}

const SETTINGS_VERSION = 4

/** Google retired these voice models on Nov 17, 2026. */
const RETIRED_TTS = /^(gemini-2\.5-(flash|pro)-preview-tts|gemini-3\.1-flash-tts-preview)$/

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  learnerName: '',
  learnerGender: 'm',
  geminiKey: '',
  groqKey: '',
  geminiModel: 'gemini-2.5-flash',
  geminiBackupModels: [],
  groqModel: 'llama-3.3-70b-versatile',
  whisperModel: 'whisper-large-v3',
  llmPrimary: 'local',
  localModel: '',
  localModelReady: false,
  builtinAiReady: false,
  builtinAiHindi: false,
  sttEngine: 'browser',
  ttsEngine: 'browser',
  geminiTtsModel: 'gemini-3.8-flash-lite-tts',
  geminiVoice: 'Kore',
  voiceHi: '',
  voiceMr: '',
  speechRate: 0.95,
  autoSpeak: true,
  showRomanDefault: false,
  dailyGoalMin: 15,
  settingsVersion: SETTINGS_VERSION,
}

export interface Profile {
  lang: Lang
  placementDone: boolean
  placedAt?: number
  placementSummary?: string
  skills: Record<string, SkillState>
  strengths: string[]
  weaknesses: string[]
  /** Persistent notes Rani keeps about the learner (recurring errors, interests…). */
  tutorNotes: string
  history: { at: number; summary: string; focus: string | null }[]
  lastFocus?: string | null
}

export function defaultProfile(lang: Lang): Profile {
  return {
    lang,
    placementDone: false,
    skills: defaultSkills(),
    strengths: [],
    weaknesses: [],
    tutorNotes: '',
    history: [],
    lastFocus: null,
  }
}

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  const stored = (row?.value as Partial<Settings>) ?? {}
  // v3: the phone does listening, speaking and the AI brain by default; Gemini and Groq are optional.
  const migrated: Partial<Settings> =
    (stored.settingsVersion ?? 1) < 3 ? { sttEngine: 'browser', ttsEngine: 'browser', llmPrimary: 'local', settingsVersion: SETTINGS_VERSION } : {}
  // v4: move off voice models Google shut down.
  if (stored.geminiTtsModel && RETIRED_TTS.test(stored.geminiTtsModel)) migrated.geminiTtsModel = DEFAULT_SETTINGS.geminiTtsModel
  return { ...DEFAULT_SETTINGS, ...stored, ...migrated }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings()
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } })
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, [])
}

export async function getProfile(lang: Lang): Promise<Profile> {
  const row = await db.kv.get(`profile:${lang}`)
  const stored = (row?.value as Partial<Profile>) ?? {}
  const base = defaultProfile(lang)
  return { ...base, ...stored, skills: { ...base.skills, ...(stored.skills ?? {}) } }
}

export async function saveProfile(p: Profile): Promise<void> {
  await db.kv.put({ key: `profile:${p.lang}`, value: p })
}

export async function updateProfile(lang: Lang, fn: (p: Profile) => Profile | void): Promise<Profile> {
  return db.transaction('rw', db.kv, async () => {
    const p = await getProfile(lang)
    const next = fn(p) ?? p
    await saveProfile(next)
    return next
  })
}

export function useProfile(lang: Lang): Profile | undefined {
  return useLiveQuery(() => getProfile(lang), [lang])
}

/** Add practised seconds to today's log (and the session) atomically. */
export async function logPracticeTime(lang: Lang, seconds: number, sessionId?: number): Promise<void> {
  if (seconds <= 0) return
  const date = dayKey()
  const id = `${date}|${lang}`
  await db.transaction('rw', db.time, db.sessions, async () => {
    const row = await db.time.get(id)
    await db.time.put({ id, date, lang, seconds: (row?.seconds ?? 0) + seconds })
    if (sessionId != null) {
      const s = await db.sessions.get(sessionId)
      if (s) await db.sessions.update(sessionId, { activeSeconds: (s.activeSeconds ?? 0) + seconds })
    }
  })
}

export function useTimeEntries() {
  return useLiveQuery(() => db.time.toArray(), [])
}

/**
 * Sessions closed without "End" (app killed, back gesture…) are marked ended
 * so history stays tidy. Their time and skill evidence were already saved.
 */
/** An unfinished conversation can be continued for this long after its last message. */
export const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000

export function lastActivity(s: Session): number {
  return s.turns.at(-1)?.at ?? s.startedAt
}

/** The most recent conversation that was interrupted (screen off, app closed…) and can be continued. */
export async function findResumableSession(lang?: Lang): Promise<Session | undefined> {
  const cutoff = Date.now() - RESUME_WINDOW_MS
  const open = await db.sessions.filter((s) => !s.endedAt && (!lang || s.lang === lang) && lastActivity(s) > cutoff && s.turns.length > 0).toArray()
  return open.sort((a, b) => lastActivity(b) - lastActivity(a))[0]
}

export function useResumableSession(lang?: Lang): Session | undefined | null {
  return useLiveQuery(async () => (await findResumableSession(lang)) ?? null, [lang])
}

/** Close every other unfinished conversation (when a new one starts). */
export async function closeOpenSessions(exceptId?: number): Promise<void> {
  const open = await db.sessions.filter((s) => !s.endedAt && s.id !== exceptId).toArray()
  for (const s of open) {
    if (s.turns.filter((t) => t.role === 'user').length === 0) await db.sessions.delete(s.id!)
    else await db.sessions.update(s.id!, { endedAt: lastActivity(s) })
  }
}

export async function closeStaleSessions(): Promise<void> {
  const cutoff = Date.now() - RESUME_WINDOW_MS
  const open = await db.sessions.filter((s) => !s.endedAt).toArray()
  for (const s of open) {
    const lastAt = s.turns.at(-1)?.at ?? s.startedAt
    if (lastAt > cutoff) continue
    if (s.turns.filter((t) => t.role === 'user').length === 0) await db.sessions.delete(s.id!)
    else await db.sessions.update(s.id!, { endedAt: lastAt })
  }
}
