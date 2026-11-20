import Dexie, { type Table } from 'dexie'

export type Lang = 'hi' | 'mr'

export interface Correction {
  you_said: string
  better: string
  rule: string
  tip?: string
  skill?: string
}

export interface Evidence {
  skill: string
  correct: boolean
}

export interface Turn {
  role: 'user' | 'rani'
  text: string
  roman?: string
  english?: string
  correction?: Correction | null
  evidence?: Evidence[]
  via?: 'voice' | 'text'
  at: number
}

export interface Recap {
  summary: string
  wins: string[]
  mistakes: { wrong: string; right: string; rule: string; skill?: string }[]
  patterns: { english: string; target: string; note?: string }[]
}

export interface PlacementResult {
  skills: { skill: string; score: number; comment: string }[]
  strengths: string[]
  weaknesses: string[]
  summary: string
  listening: string
}

export interface Session {
  id?: number
  lang: Lang
  kind: 'placement' | 'practice'
  topic: string
  focus: string | null
  startedAt: number
  endedAt?: number
  activeSeconds: number
  turns: Turn[]
  skillsBefore?: Record<string, number>
  skillsAfter?: Record<string, number>
  /** Placement chat has gathered enough answers to be scored. */
  placementReady?: boolean
  recap?: Recap | null
  placement?: PlacementResult | null
}

/** Active practice seconds per local day per language. id = `${date}|${lang}` */
export interface TimeEntry {
  id: string
  date: string
  lang: Lang
  seconds: number
}

/** Flashcard (review UI arrives in milestone 2; cards are collected from day one). */
export interface Card {
  id?: number
  lang: Lang
  front: string
  back: string
  note?: string
  skill?: string
  sessionId?: number
  createdAt: number
  due: number
  interval: number
  ease: number
  reps: number
}

export interface KV {
  key: string
  value: unknown
}

class RaniDB extends Dexie {
  kv!: Table<KV, string>
  sessions!: Table<Session, number>
  time!: Table<TimeEntry, string>
  cards!: Table<Card, number>

  constructor() {
    super('rani-tutor')
    this.version(1).stores({
      kv: 'key',
      sessions: '++id, lang, kind, startedAt',
      time: 'id, date, lang',
      cards: '++id, lang, due',
    })
  }
}

export const db = new RaniDB()
