import { db, type Card, type Correction, type Evidence, type PlacementResult, type Recap, type Session } from '../db'
import { generateJson, type ChatMsg } from './llm'
import {
  ASSESSMENT_SCHEMA,
  RECAP_SCHEMA,
  TURN_SCHEMA,
  assessmentSystem,
  placementSystem,
  practiceSystem,
  recapSystem,
} from './prompts'
import { HINDI_SKILLS, SKILL_BY_ID, applyEvidence, clampScore } from './skills'
import { getProfile, getSettings, updateProfile, type Settings } from './store'

export interface TurnResult {
  reply: string
  roman: string
  english: string
  correction: Correction | null
  evidence: Evidence[]
  placementComplete: boolean
}

interface RawTurn {
  correction?: { needed?: boolean; you_said?: string; better?: string; rule?: string; tip?: string; skill?: string }
  evidence?: { skill?: string; correct?: boolean }[]
  reply?: string
  reply_roman?: string
  reply_english?: string
  placement_complete?: boolean
}

function toMessages(session: Session): ChatMsg[] {
  const start = session.kind === 'placement' ? '[Placement start]' : '[Session start]'
  return [{ role: 'user', text: start }, ...session.turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', text: t.text }) as ChatMsg)]
}

export function normalizeTurn(raw: RawTurn): TurnResult {
  const c = raw.correction
  const correction: Correction | null =
    c?.needed && c.better && c.better.trim() !== (c.you_said ?? '').trim()
      ? {
          you_said: c.you_said ?? '',
          better: c.better,
          rule: c.rule ?? '',
          tip: c.tip || undefined,
          skill: c.skill && SKILL_BY_ID[c.skill] ? c.skill : undefined,
        }
      : null
  const evidence = (raw.evidence ?? [])
    .filter((e): e is Evidence => !!e.skill && !!SKILL_BY_ID[e.skill] && typeof e.correct === 'boolean')
    .slice(0, 6)
  // A correction always counts as a miss for its skill, even if the model forgot the evidence.
  if (correction?.skill && !evidence.some((e) => e.skill === correction.skill && !e.correct)) {
    evidence.push({ skill: correction.skill, correct: false })
  }
  return {
    reply: (raw.reply ?? '').trim() || 'माफ़ कीजिए, क्या आप फिर से बोल सकते हैं?',
    roman: (raw.reply_roman ?? '').trim(),
    english: (raw.reply_english ?? '').trim(),
    correction,
    evidence,
    placementComplete: !!raw.placement_complete,
  }
}

/** Ask Rani for her next turn given the session so far. */
export async function runTurn(session: Session, s: Settings): Promise<TurnResult> {
  const profile = await getProfile(session.lang)
  const learnerMsgs = session.turns.filter((t) => t.role === 'user').length
  const system =
    session.kind === 'placement'
      ? placementSystem(s, learnerMsgs)
      : practiceSystem(s, profile, session.focus ?? HINDI_SKILLS[0].id, session.topic)
  const { data } = await generateJson<RawTurn>({ system, messages: toMessages(session), schema: TURN_SCHEMA, temperature: 0.7 }, s)
  return normalizeTurn(data)
}

/** Apply per-turn skill evidence to the learner profile (practice sessions only). */
export async function applyTurnEvidence(session: Session, evidence: Evidence[]): Promise<void> {
  if (session.kind !== 'practice' || evidence.length === 0) return
  await updateProfile(session.lang, (p) => {
    for (const e of evidence) {
      const cur = p.skills[e.skill]
      if (cur) p.skills[e.skill] = applyEvidence(cur, e.correct)
    }
  })
}

function transcript(session: Session): string {
  return session.turns
    .map((t) => {
      const who = t.role === 'user' ? 'Learner' : 'Rani'
      const corr = t.correction ? `\n   [correction shown: "${t.correction.you_said}" → "${t.correction.better}" — ${t.correction.rule}]` : ''
      return `${who}: ${t.text}${corr}`
    })
    .join('\n')
}

interface RawRecap extends Recap {
  tutor_notes?: string
  next_focus?: string
}

/** End a practice session: recap, flashcards, and memory update. */
export async function finishPractice(sessionId: number): Promise<Session> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  const s = await getSettings()
  const profile = await getProfile(session.lang)
  const { data } = await generateJson<RawRecap>(
    { system: recapSystem(s, profile), messages: [{ role: 'user', text: transcript(session) }], schema: RECAP_SCHEMA, temperature: 0.4 },
    s,
  )
  const recap: Recap = {
    summary: data.summary ?? '',
    wins: (data.wins ?? []).slice(0, 3),
    mistakes: (data.mistakes ?? []).slice(0, 6),
    patterns: (data.patterns ?? []).filter((p) => p.english && p.target).slice(0, 6),
  }
  const now = Date.now()
  const cards: Card[] = recap.patterns.map((p) => ({
    lang: session.lang,
    front: p.english,
    back: p.target,
    note: p.note,
    sessionId,
    createdAt: now,
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
  }))
  await db.transaction('rw', db.sessions, db.cards, db.kv, async () => {
    const skillsAfter = Object.fromEntries(Object.entries(profile.skills).map(([k, v]) => [k, v.score]))
    await db.sessions.update(sessionId, { recap, skillsAfter, endedAt: session.endedAt ?? now })
    if (cards.length) await db.cards.bulkAdd(cards)
    await updateProfile(session.lang, (p) => {
      if (data.tutor_notes) p.tutorNotes = data.tutor_notes
      p.history = [...p.history, { at: now, summary: recap.summary, focus: session.focus }].slice(-12)
      p.lastFocus = session.focus
    })
  })
  return (await db.sessions.get(sessionId))!
}

interface RawAssessment extends PlacementResult {
  tutor_notes?: string
}

/** End the placement conversation: score every skill and initialise the profile. */
export async function finishPlacement(sessionId: number): Promise<Session> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  const s = await getSettings()
  const { data } = await generateJson<RawAssessment>(
    { system: assessmentSystem(s), messages: [{ role: 'user', text: transcript(session) }], schema: ASSESSMENT_SCHEMA, temperature: 0.2 },
    s,
  )
  const byId = new Map((data.skills ?? []).filter((x) => SKILL_BY_ID[x.skill]).map((x) => [x.skill, x]))
  const result: PlacementResult = {
    skills: HINDI_SKILLS.map((sk) => ({
      skill: sk.id,
      score: clampScore(byId.get(sk.id)?.score ?? 30),
      comment: byId.get(sk.id)?.comment ?? 'Estimated',
    })),
    strengths: data.strengths ?? [],
    weaknesses: data.weaknesses ?? [],
    summary: data.summary ?? '',
    listening: data.listening ?? '',
  }
  const now = Date.now()
  await db.transaction('rw', db.sessions, db.kv, async () => {
    await db.sessions.update(sessionId, { placement: result, endedAt: session.endedAt ?? now })
    await updateProfile(session.lang, (p) => {
      p.placementDone = true
      p.placedAt = now
      p.placementSummary = result.summary
      p.strengths = result.strengths
      p.weaknesses = result.weaknesses
      p.tutorNotes = data.tutor_notes ?? p.tutorNotes
      for (const r of result.skills) p.skills[r.skill] = { score: r.score, correct: 0, wrong: 0, last: now }
      p.history = [...p.history, { at: now, summary: `Placement: ${result.summary}`, focus: null }].slice(-12)
    })
  })
  return (await db.sessions.get(sessionId))!
}
