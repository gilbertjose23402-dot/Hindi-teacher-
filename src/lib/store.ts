import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Lang } from '../db'
import { dayKey } from './dates'
import { defaultSkills, type SkillState } from './skills'

export type SttEngine = 'groq' | 'gemini' | 'browser'
export type TtsEngine = 'gemini' | 'browser'
export type LlmProvider = 'gemini' | 'groq'

export interface Settings {
  onboarded: boolean
  learnerName: string
  /** Grammatical gender Rani uses for the learner (मैं गया vs मैं गई). */
  learnerGender: 'm' | 'f'
  geminiKey: string
  groqKey: string
  geminiModel: string
  groqModel: string
  whisperModel: string
  llmPrimary: LlmProvider
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

const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  learnerName: '',
  learnerGender: 'm',
  geminiKey: '',
  groqKey: '',
  geminiModel: 'gemini-2.5-flash',
  groqModel: 'llama-3.3-70b-versatile',
  whisperModel: 'whisper-large-v3',
  llmPrimary: 'gemini',
  sttEngine: 'gemini',
  ttsEngine: 'gemini',
  geminiTtsModel: 'gemini-2.5-flash-preview-tts',
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
  // v2: Gemini does speech recognition, the tutor and the voice by default; Groq is optional.
  const migrated: Partial<Settings> = (stored.settingsVersion ?? 1) < 2 ? { sttEngine: 'gemini', ttsEngine: 'gemini', settingsVersion: SETTINGS_VERSION } : {}
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
export async function closeStaleSessions(): Promise<void> {
  const cutoff = Date.now() - 30 * 60 * 1000
  const open = await db.sessions.filter((s) => !s.endedAt).toArray()
  for (const s of open) {
    const lastAt = s.turns.at(-1)?.at ?? s.startedAt
    if (lastAt > cutoff) continue
    if (s.turns.filter((t) => t.role === 'user').length === 0) await db.sessions.delete(s.id!)
    else await db.sessions.update(s.id!, { endedAt: lastAt })
  }
}
