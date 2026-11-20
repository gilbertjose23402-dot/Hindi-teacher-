import { db, type Card, type Correction, type Evidence, type PlacementResult, type Recap, type Session } from '../db'
import { extractPartialField, extractPartialReply, generateJson, geminiJson, isOnDevice, withGeminiModel, type ChatMsg, type JsonRequest } from './llm'
import {
  ASSESSMENT_SCHEMA,
  FAST_AUDIO_RULES,
  FAST_TURN_SCHEMA,
  LOCAL_ASSESSMENT_SCHEMA,
  LOCAL_RECAP_SCHEMA,
  LOCAL_TURN_SCHEMA,
  RECAP_SCHEMA,
  TRANSLATE_SCHEMA,
  TURN_SCHEMA,
  assessmentSystem,
  assessmentSystemLocal,
  placementSystem,
  placementSystemLocal,
  practiceSystem,
  practiceSystemLocal,
  recapSystem,
  recapSystemLocal,
  translateSystem,
} from './prompts'
import { HINDI_SKILLS, SKILL_BY_ID, applyEvidence, clampScore } from './skills'
import { getProfile, getSettings, updateProfile, type Profile, type Settings } from './store'

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

/** Placement always ends between learner answers 8 and 12, whatever the model says. */
export const PLACEMENT_MIN = 8
export const PLACEMENT_MAX = 12

/**
 * Conversation history for the model. The on-phone model has a small memory,
 * so it sees a sliding window of recent turns; the window start only moves
 * every 8 turns so most turns can reuse what the model already processed.
 */
export function toMessages(session: Session, windowed = false): ChatMsg[] {
  const start = session.kind === 'placement' ? '[Placement start]' : '[Session start]'
  let turns = session.turns
  if (windowed && turns.length > 16) {
    const from = Math.floor((turns.length - 8) / 8) * 8 // even index → a Rani turn, keeps user/model alternation
    turns = turns.slice(from)
  }
  return [{ role: 'user', text: start }, ...turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', text: t.text }) as ChatMsg)]
}

/** The profile as it was when the session began, so the prompt stays identical across turns. */
function sessionProfile(p: Profile, session: Session): Profile {
  if (!session.skillsBefore) return p
  const skills = { ...p.skills }
  for (const [k, score] of Object.entries(session.skillsBefore)) if (skills[k]) skills[k] = { ...skills[k], score }
  return { ...p, skills }
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
  // The on-phone model doesn't label the correction's skill; take it from its evidence.
  if (correction && !correction.skill) correction.skill = evidence.find((e) => !e.correct)?.skill
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

/** The on-phone model's short answer: reply first, correction only when needed. */
interface RawLocalTurn {
  reply?: string
  correction?: { better?: string; rule?: string; skill?: string }
  used?: string
}

/** Expand the on-phone model's short answer into the full turn format. */
export function fromLocalTurn(raw: RawLocalTurn | RawTurn, learnerSaid: string): RawTurn {
  if (!('used' in raw) && 'evidence' in raw) return raw as RawTurn // already full format (cloud fallback)
  const r = raw as RawLocalTurn
  const better = (r.correction?.better ?? '').trim()
  const skill = r.correction?.skill && r.correction.skill !== 'none' ? r.correction.skill : undefined
  const needed = !!better && better !== learnerSaid.trim()
  const evidence: { skill: string; correct: boolean }[] = []
  if (needed && skill) evidence.push({ skill, correct: false })
  // The skill they mainly used counts as correct, unless it is the one the mistake was in
  // (or the mistake wasn't labelled, so we can't tell).
  if (r.used && r.used !== 'none' && !(needed && r.used === skill)) evidence.push({ skill: r.used, correct: !(needed && !skill) })
  return {
    reply: r.reply,
    correction: { needed, you_said: learnerSaid, better, rule: r.correction?.rule ?? '', tip: '', skill },
    evidence,
    placement_complete: false,
  }
}

export interface TurnOptions {
  /** Fires as soon as Rani's reply text is known — before the correction is finished. */
  onReply?: (reply: string) => void
}

/** Ask Rani for her next turn given the session so far. */
export async function runTurn(session: Session, s: Settings, opts: TurnOptions = {}): Promise<TurnResult> {
  const profile = sessionProfile(await getProfile(session.lang), session)
  const learnerMsgs = session.turns.filter((t) => t.role === 'user').length
  const lastLearner = [...session.turns].reverse().find((t) => t.role === 'user')?.text ?? ''
  const focus = session.focus ?? HINDI_SKILLS[0].id
  let announced = false
  const onPartial = opts.onReply
    ? (raw: string) => {
        if (announced) return
        const reply = extractPartialReply(raw)
        if (reply) {
          announced = true
          opts.onReply!(reply)
        }
      }
    : undefined
  const { data, provider } = await generateJson<RawTurn | RawLocalTurn>(
    (p): JsonRequest => {
      if (isOnDevice(p)) {
        const system = session.kind === 'placement' ? placementSystemLocal(s) : practiceSystemLocal(s, profile, focus, session.topic)
        return { system, messages: toMessages(session, true), schema: LOCAL_TURN_SCHEMA, temperature: 0.6, maxTokens: 160 }
      }
      const system = session.kind === 'placement' ? placementSystem(s, learnerMsgs) : practiceSystem(s, profile, focus, session.topic)
      return { system, messages: toMessages(session), schema: TURN_SCHEMA, temperature: 0.7 }
    },
    s,
    { onPartial },
  )
  const turn = normalizeTurn(isOnDevice(provider) ? fromLocalTurn(data, lastLearner) : (data as RawTurn))
  if (session.kind === 'placement') {
    const modelSaysDone = !isOnDevice(provider) && turn.placementComplete
    turn.placementComplete = (modelSaysDone && learnerMsgs >= PLACEMENT_MIN) || learnerMsgs >= (isOnDevice(provider) ? 10 : PLACEMENT_MAX)
  } else {
    turn.placementComplete = false
  }
  return turn
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
  const messages: ChatMsg[] = [{ role: 'user', text: transcript(session) }]
  const { data } = await generateJson<RawRecap>(
    (p) =>
      isOnDevice(p)
        ? { system: recapSystemLocal(s, profile), messages, schema: LOCAL_RECAP_SCHEMA, temperature: 0.3, maxTokens: 700 }
        : { system: recapSystem(s, profile), messages, schema: RECAP_SCHEMA, temperature: 0.4 },
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
  const messages: ChatMsg[] = [{ role: 'user', text: transcript(session) }]
  const { data } = await generateJson<RawAssessment>(
    (p) =>
      isOnDevice(p)
        ? { system: assessmentSystemLocal(s), messages, schema: LOCAL_ASSESSMENT_SCHEMA, temperature: 0.2, maxTokens: 800 }
        : { system: assessmentSystem(s), messages, schema: ASSESSMENT_SCHEMA, temperature: 0.2 },
    s,
  )
  const byId = new Map((data.skills ?? []).filter((x) => SKILL_BY_ID[x.skill]).map((x) => [x.skill, x]))
  const result: PlacementResult = {
    skills: HINDI_SKILLS.map((sk) => ({
      skill: sk.id,
      score: clampScore(byId.get(sk.id)?.score ?? 30),
      comment: byId.has(sk.id) ? (byId.get(sk.id)!.comment ?? '') : 'Estimated',
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

/** English translation + romanisation for one of Rani's lines (the EN / Aa buttons). Uses a cloud key first when available. */
export async function translateLine(text: string, s: Settings): Promise<{ english: string; roman: string }> {
  const { data } = await generateJson<{ english?: string; roman?: string }>(
    { system: translateSystem(), messages: [{ role: 'user', text }], schema: TRANSLATE_SCHEMA, temperature: 0.2, maxTokens: 200 },
    s,
    { preferCloud: true },
  )
  return { english: (data.english ?? '').trim(), roman: (data.roman ?? '').trim() }
}

/** Fast mode: Gemini is the brain AND the listener, so one call can hear and answer. */
export function isFastMode(s: Settings): boolean {
  return !!s.geminiKey && s.llmPrimary === 'gemini' && s.sttEngine === 'gemini'
}

export interface FastTurnOptions extends TurnOptions {
  /** Fires as soon as Gemini has written down what the learner said. */
  onTranscript?: (text: string) => void
}

/**
 * Fast mode turn: the learner's recording goes straight to Gemini, which
 * transcribes it (mistakes kept), corrects it and replies — streamed, so the
 * transcript and reply can be shown/spoken before the answer is complete.
 */
export async function runFastTurn(
  session: Session,
  wavBase64: string,
  s: Settings,
  opts: FastTurnOptions = {},
): Promise<TurnResult & { transcript: string }> {
  const profile = sessionProfile(await getProfile(session.lang), session)
  const learnerMsgs = session.turns.filter((t) => t.role === 'user').length + 1
  const focus = session.focus ?? HINDI_SKILLS[0].id
  const base = session.kind === 'placement' ? placementSystem(s, learnerMsgs) : practiceSystem(s, profile, focus, session.topic)
  const messages: ChatMsg[] = [
    ...toMessages(session),
    { role: 'user', text: '[The learner spoke — see the attached recording.]', audio: { mimeType: 'audio/wav', data: wavBase64 } },
  ]
  let sentTranscript = false
  let sentReply = false
  const data = await withGeminiModel(s, (model) =>
    geminiJson<RawTurn & { transcript?: string }>(
    { system: `${base}\n\n${FAST_AUDIO_RULES}`, messages, schema: FAST_TURN_SCHEMA, temperature: 0.6 },
    s.geminiKey,
    model,
    (raw) => {
      if (!sentTranscript && opts.onTranscript) {
        const t = extractPartialField(raw, 'transcript')
        if (t) {
          sentTranscript = true
          opts.onTranscript(t)
        }
      }
      if (!sentReply && opts.onReply) {
        const r = extractPartialReply(raw)
        if (r) {
          sentReply = true
          opts.onReply(r)
        }
      }
    },
  ),
  )
  const turn = normalizeTurn(data)
  if (session.kind === 'placement') {
    turn.placementComplete = (turn.placementComplete && learnerMsgs >= PLACEMENT_MIN) || learnerMsgs >= PLACEMENT_MAX
  } else {
    turn.placementComplete = false
  }
  return { ...turn, transcript: (data.transcript ?? '').trim() }
}
