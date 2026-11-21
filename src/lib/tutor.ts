import { LEGAL_TERMS } from '../content/legal'
import { UNIT_BY_ID, phraseFor, type Unit } from '../content/marathi'
import { db, type Card, type Correction, type Evidence, type Lang, type PlacementResult, type Recap, type Session } from '../db'
import {
  extractPartialField,
  extractPartialReply,
  generateJson,
  geminiJson,
  isOnDevice,
  withGeminiModel,
  type ChatMsg,
  type JsonRequest,
} from './llm'
import {
  ASSESSMENT_SCHEMA,
  LOCAL_ASSESSMENT_SCHEMA,
  TRANSLATE_SCHEMA,
  assessmentSystem,
  assessmentSystemLocal,
  fastAudioRules,
  fastTurnSchema,
  lessonSystem,
  lessonSystemLocal,
  localRecapSchema,
  localTurnSchema,
  placementSystem,
  placementSystemLocal,
  practiceSystem,
  practiceSystemLocal,
  recapSchema,
  recapSystem,
  recapSystemLocal,
  translateSystem,
  turnSchema,
} from './prompts'
import { HINDI_SKILLS, SKILL_BY_ID, applyEvidence, clampScore, skillsFor } from './skills'
import { getProfile, getSettings, updateProfile, type LlmProvider, type Profile, type Settings } from './store'

export interface TurnResult {
  reply: string
  roman: string
  english: string
  correction: Correction | null
  evidence: Evidence[]
  /** The conversation can be finished: placement scored / lesson complete. */
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
/** A lesson can finish after 6 learner messages and always does by 10. */
export const LESSON_MIN = 6
export const LESSON_MAX = 10
/** Lesson mastery needed to open the next unit. */
export const UNIT_PASS = 50

const SORRY: Record<Lang, string> = { hi: 'माफ़ कीजिए, क्या आप फिर से बोल सकते हैं?', mr: 'माफ करा, पुन्हा सांगाल का?' }

function startMessage(session: Session): string {
  if (session.kind === 'placement') return '[Placement start]'
  if (session.kind === 'lesson') return '[Lesson start]'
  return '[Session start]'
}

/**
 * Conversation history for the model. The on-phone model has a small memory,
 * so it sees a sliding window of recent turns; the window start only moves
 * every 8 turns so most turns can reuse what the model already processed.
 */
export function toMessages(session: Session, windowed = false): ChatMsg[] {
  let turns = session.turns
  if (windowed && turns.length > 16) {
    const from = Math.floor((turns.length - 8) / 8) * 8 // even index → a Rani turn, keeps user/model alternation
    turns = turns.slice(from)
  }
  return [{ role: 'user', text: startMessage(session) }, ...turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', text: t.text }) as ChatMsg)]
}

/** The profile as it was when the session began, so the prompt stays identical across turns. */
function sessionProfile(p: Profile, session: Session): Profile {
  if (!session.skillsBefore) return p
  const skills = { ...p.skills }
  for (const [k, score] of Object.entries(session.skillsBefore)) if (skills[k]) skills[k] = { ...skills[k], score }
  return { ...p, skills }
}

function unitOf(session: Session): Unit | undefined {
  return session.unitId ? UNIT_BY_ID[session.unitId] : undefined
}

export function normalizeTurn(raw: RawTurn, lang: Lang = 'hi'): TurnResult {
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
    reply: (raw.reply ?? '').trim() || SORRY[lang],
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

/** Rani's instructions + history for the next turn, for a given brain. */
export function turnRequest(session: Session, s: Settings, profile: Profile, provider: LlmProvider, learnerMsgs: number): JsonRequest {
  const lang = session.lang
  const unit = unitOf(session)
  const focus = session.focus ?? skillsFor(lang)[0].id
  if (isOnDevice(provider)) {
    const system =
      session.kind === 'placement'
        ? placementSystemLocal(s)
        : session.kind === 'lesson' && unit
          ? lessonSystemLocal(s, unit)
          : practiceSystemLocal(s, profile, focus, session.topic, lang)
    return { system, messages: toMessages(session, true), schema: localTurnSchema(lang), temperature: 0.6, maxTokens: 160 }
  }
  const system =
    session.kind === 'placement'
      ? placementSystem(s, learnerMsgs)
      : session.kind === 'lesson' && unit
        ? lessonSystem(s, profile, unit, learnerMsgs)
        : practiceSystem(s, profile, focus, session.topic, lang)
  return { system, messages: toMessages(session), schema: turnSchema(lang), temperature: 0.7 }
}

/** Whether the conversation may now be finished (placement scored / lesson complete). */
export function readyToFinish(kind: Session['kind'], modelSaysDone: boolean, learnerMsgs: number, onDevice: boolean): boolean {
  if (kind === 'placement') return (!onDevice && modelSaysDone && learnerMsgs >= PLACEMENT_MIN) || learnerMsgs >= (onDevice ? 10 : PLACEMENT_MAX)
  if (kind === 'lesson') return (!onDevice && modelSaysDone && learnerMsgs >= LESSON_MIN) || learnerMsgs >= (onDevice ? 8 : LESSON_MAX)
  return false
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
  const { data, provider } = await generateJson<RawTurn | RawLocalTurn>((p) => turnRequest(session, s, profile, p, learnerMsgs), s, { onPartial })
  const onDevice = isOnDevice(provider)
  const turn = normalizeTurn(onDevice ? fromLocalTurn(data, lastLearner) : (data as RawTurn), session.lang)
  turn.placementComplete = readyToFinish(session.kind, turn.placementComplete, learnerMsgs, onDevice)
  return turn
}

/** Apply per-turn skill evidence to the learner profile (not during the placement, which scores everything at the end). */
export async function applyTurnEvidence(session: Session, evidence: Evidence[]): Promise<void> {
  if (session.kind === 'placement' || evidence.length === 0) return
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

function newCard(lang: Lang, front: string, back: string, extra: Partial<Card>, now = Date.now()): Card {
  return { lang, front, back, createdAt: now, due: now, interval: 0, ease: 2.5, reps: 0, ...extra }
}

/** Add cards, skipping ones whose answer is already in the deck for that language. */
export async function addCardsUnique(cards: Card[]): Promise<number> {
  if (!cards.length) return 0
  const existing = await db.cards.toArray()
  const seen = new Set(existing.map((c) => `${c.lang}|${c.back.trim()}`))
  const fresh = cards.filter((c) => {
    const k = `${c.lang}|${c.back.trim()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (fresh.length) await db.cards.bulkAdd(fresh)
  return fresh.length
}

/** Ask for the end-of-session recap (practice or lesson). */
async function makeRecap(session: Session, s: Settings, profile: Profile, unit?: Unit): Promise<{ data: RawRecap; recap: Recap }> {
  const messages: ChatMsg[] = [{ role: 'user', text: transcript(session) }]
  const lang = session.lang
  const lesson = !!unit
  const { data } = await generateJson<RawRecap>(
    (p) =>
      isOnDevice(p)
        ? { system: recapSystemLocal(s, profile, lang, unit), messages, schema: localRecapSchema(lang, lesson), temperature: 0.3, maxTokens: 700 }
        : { system: recapSystem(s, profile, lang, unit), messages, schema: recapSchema(lang, lesson), temperature: 0.4 },
    s,
  )
  const recap: Recap = {
    summary: data.summary ?? '',
    wins: (data.wins ?? []).slice(0, 3),
    mistakes: (data.mistakes ?? []).slice(0, 6),
    patterns: (data.patterns ?? []).filter((p) => p.english && p.target).slice(0, 6),
    ...(lesson ? { mastery: clampScore(Number(data.mastery ?? 0)) } : {}),
  }
  return { data, recap }
}

/** End a practice conversation: recap, flashcards, and memory update. */
export async function finishPractice(sessionId: number): Promise<Session> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  const s = await getSettings()
  const profile = await getProfile(session.lang)
  const { data, recap } = await makeRecap(session, s, profile)
  const now = Date.now()
  const cards = recap.patterns.map((p) => newCard(session.lang, p.english, p.target, { note: p.note, sessionId, deck: 'mistakes' }, now))
  await db.transaction('rw', db.sessions, db.cards, db.kv, async () => {
    const skillsAfter = Object.fromEntries(Object.entries(profile.skills).map(([k, v]) => [k, v.score]))
    await db.sessions.update(sessionId, { recap, skillsAfter, endedAt: session.endedAt ?? now })
    await addCardsUnique(cards)
    await updateProfile(session.lang, (p) => {
      if (data.tutor_notes) p.tutorNotes = data.tutor_notes
      p.history = [...p.history, { at: now, summary: recap.summary, focus: session.focus }].slice(-12)
      p.lastFocus = session.focus
    })
  })
  return (await db.sessions.get(sessionId))!
}

/** The unit's key phrases as flashcards (English → Marathi in the learner's own forms). */
export function unitCards(unit: Unit, s: Pick<Settings, 'learnerGender' | 'learnerName'>, now = Date.now()): Card[] {
  return unit.phrases.map((ph) => {
    const p = phraseFor(ph, s.learnerGender, s.learnerName)
    return newCard('mr', p.en, p.mr, { note: `${p.roman} · Hindi: ${p.hi}`, deck: 'lesson', unitId: unit.id }, now)
  })
}

/** Record a lesson result: best score, attempts, and whether the unit is now complete. */
export async function recordUnitResult(unitId: string, mastery: number, forceComplete = false): Promise<void> {
  await updateProfile('mr', (p) => {
    const cur = p.units?.[unitId]
    p.units = {
      ...p.units,
      [unitId]: {
        completed: !!cur?.completed || forceComplete || mastery >= UNIT_PASS,
        bestScore: Math.max(cur?.bestScore ?? 0, mastery),
        attempts: (cur?.attempts ?? 0) + (forceComplete ? 0 : 1),
        lastAt: Date.now(),
      },
    }
  })
}

/** End a Marathi lesson: recap with mastery, unit progress, and the unit's phrases as flashcards. */
export async function finishLesson(sessionId: number): Promise<Session> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  const unit = unitOf(session)
  if (!unit) return finishPractice(sessionId)
  const s = await getSettings()
  const profile = await getProfile('mr')
  const { data, recap } = await makeRecap(session, s, profile, unit)
  const now = Date.now()
  const cards = [
    ...unitCards(unit, s, now),
    ...recap.patterns.map((p) => newCard('mr', p.english, p.target, { note: p.note, sessionId, deck: 'mistakes', unitId: unit.id }, now)),
  ]
  await db.transaction('rw', db.sessions, db.cards, db.kv, async () => {
    const after = await getProfile('mr')
    const skillsAfter = Object.fromEntries(Object.entries(after.skills).map(([k, v]) => [k, v.score]))
    await db.sessions.update(sessionId, { recap, skillsAfter, endedAt: session.endedAt ?? now })
    await addCardsUnique(cards)
    await recordUnitResult(unit.id, recap.mastery ?? 0)
    await updateProfile('mr', (p) => {
      if (data.tutor_notes) p.tutorNotes = data.tutor_notes
      p.history = [...p.history, { at: now, summary: `Unit ${unit.no}: ${recap.summary}`, focus: data.next_focus ?? null }].slice(-12)
      p.lastFocus = data.next_focus ?? p.lastFocus
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

/** End any conversation the right way for its kind. */
export function finishSession(session: Session): Promise<Session> {
  if (session.kind === 'placement') return finishPlacement(session.id!)
  if (session.kind === 'lesson') return finishLesson(session.id!)
  return finishPractice(session.id!)
}

/** New legal terms introduced per day, so the deck doesn't arrive all at once. */
export const LEGAL_TERMS_PER_DAY = 5
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Add the Hindi/Marathi criminal-court vocabulary as flashcards (skips ones
 * already there). Five terms (Hindi + Marathi) become due each day.
 */
export async function addLegalDeck(): Promise<number> {
  const now = Date.now()
  const cards: Card[] = LEGAL_TERMS.flatMap((t, i) => {
    const due = now + Math.floor(i / LEGAL_TERMS_PER_DAY) * DAY_MS
    return [
      { ...newCard('hi', `Legal Hindi: ${t.en}`, t.hi, { note: `Marathi: ${t.mr}`, deck: 'legal' }, now), due },
      { ...newCard('mr', `Legal Marathi: ${t.en}`, t.mr, { note: `Hindi: ${t.hi}`, deck: 'legal' }, now), due },
    ]
  })
  return addCardsUnique(cards)
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
  const base = turnRequest(session, s, profile, 'gemini', learnerMsgs)
  const messages: ChatMsg[] = [
    ...base.messages,
    { role: 'user', text: '[The learner spoke — see the attached recording.]', audio: { mimeType: 'audio/wav', data: wavBase64 } },
  ]
  let sentTranscript = false
  let sentReply = false
  const data = await withGeminiModel(s, (model) =>
    geminiJson<RawTurn & { transcript?: string }>(
      { system: `${base.system}\n\n${fastAudioRules(session.lang)}`, messages, schema: fastTurnSchema(session.lang), temperature: 0.6 },
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
  const turn = normalizeTurn(data, session.lang)
  turn.placementComplete = readyToFinish(session.kind, turn.placementComplete, learnerMsgs, false)
  return { ...turn, transcript: (data.transcript ?? '').trim() }
}
