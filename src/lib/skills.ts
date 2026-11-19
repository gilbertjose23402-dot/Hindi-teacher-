export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1']

export const LEVEL_LABEL: Record<Level, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-intermediate',
  C1: 'Advanced',
}

export interface SkillDef {
  id: string
  name: string
  example: string
  /** What the tutor should look for / elicit. Goes into the prompt. */
  description: string
  minLevel: Level
}

/** Hindi grammar skills for sentence framing, roughly in teaching order. */
export const HINDI_SKILLS: SkillDef[] = [
  { id: 'gender_agreement', name: 'Noun gender & agreement', example: 'मेरा भाई / मेरी बहन, अच्छी किताब', minLevel: 'A1',
    description: 'Knowing the gender of nouns and making adjectives, possessives and verbs agree with it.' },
  { id: 'present_tense', name: 'Present tense', example: 'मैं रोज़ कोर्ट जाता/जाती हूँ', minLevel: 'A1',
    description: 'Habitual present: verb stem + ता/ती/ते + हूँ/है/हैं, agreeing with the subject in gender and number.' },
  { id: 'pronoun_respect', name: 'तू / तुम / आप forms', example: 'आप कहाँ रहते हैं? तुम क्या करते हो?', minLevel: 'A1',
    description: 'Choosing the right level of respect and matching verb endings (आप…हैं, तुम…हो, तू…है).' },
  { id: 'postpositions', name: 'Postpositions को, से, में, पर', example: 'मैं कोर्ट में हूँ, उससे पूछो', minLevel: 'A1',
    description: 'Picking the right postposition for location, direction, instrument, source and indirect objects.' },
  { id: 'possessives', name: 'का / के / की', example: 'अदालत का फ़ैसला, वकील की फ़ीस', minLevel: 'A1',
    description: 'Possessive का/के/की agreeing with the possessed noun, not the owner.' },
  { id: 'oblique_case', name: 'Oblique case', example: 'लड़के को, कमरे में, इन लोगों से', minLevel: 'A2',
    description: 'Nouns and pronouns changing form before postpositions (लड़का → लड़के को, वह → उसको).' },
  { id: 'continuous', name: 'Continuous tense (रहा)', example: 'मैं पढ़ रहा/रही हूँ', minLevel: 'A2',
    description: 'Ongoing actions with रहा/रही/रहे + हूँ/है/था.' },
  { id: 'future', name: 'Future tense', example: 'मैं कल जाऊँगा/जाऊँगी', minLevel: 'A2',
    description: 'Future endings ऊँगा/ेगा/ेंगे with gender agreement.' },
  { id: 'past_intransitive', name: 'Simple past (intransitive)', example: 'मैं गया/गई, वे आए', minLevel: 'A2',
    description: 'Past tense of intransitive verbs (जाना, आना, बैठना…) agreeing with the subject.' },
  { id: 'ne_construction', name: 'ने construction', example: 'मैंने चाय पी, उसने किताबें पढ़ीं', minLevel: 'A2',
    description: 'Transitive verbs in perfective past take ने on the subject and the verb agrees with the object (or defaults to masculine singular when the object has को).' },
  { id: 'dative_subject', name: 'मुझे… constructions', example: 'मुझे पसंद है, मुझे जाना है, मुझे पता है', minLevel: 'A2',
    description: 'Dative subjects with को/मुझे for liking, needing, knowing, feeling and obligation (मुझे जाना है).' },
  { id: 'modals', name: 'चाहिए, सकना, पाना', example: 'मुझे जाना चाहिए, मैं बोल सकता हूँ', minLevel: 'A2',
    description: 'Advice/necessity with चाहिए and ability with सकना/पाना.' },
  { id: 'perfect_tenses', name: 'Present & past perfect', example: 'मैंने खाना खाया है, वह जा चुका था', minLevel: 'B1',
    description: 'Perfective with है/था for completed actions relevant now or earlier in the past.' },
  { id: 'imperatives_subjunctive', name: 'Requests & subjunctive', example: 'बैठिए, अगर आप चाहें तो…, ताकि वह आए', minLevel: 'B1',
    description: 'Polite imperatives (-इए), subjunctive forms after अगर, ताकि, शायद, चाहता हूँ कि.' },
  { id: 'compound_verbs', name: 'Compound verbs', example: 'कर लिया, बता दो, गिर गया', minLevel: 'B1',
    description: 'Vector verbs लेना/देना/जाना/डालना that add completion or benefit nuance.' },
  { id: 'participles_clauses', name: '-कर & relative clauses', example: 'खाना खाकर, जो वकील आया था वह…', minLevel: 'B1',
    description: 'Conjunctive participle (-कर) and relative-correlative sentences (जो…वह, जब…तब).' },
  { id: 'passive_causative', name: 'Passive & causative', example: 'फ़ैसला सुनाया गया, काम करवाना', minLevel: 'B2',
    description: 'Passive with जाना and causatives (-वाना) — common in legal and formal Hindi.' },
]

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(HINDI_SKILLS.map((s) => [s.id, s]))

export interface SkillState {
  score: number
  correct: number
  wrong: number
  last?: number
}

export const DEFAULT_SKILL_SCORE = 35

export function defaultSkills(): Record<string, SkillState> {
  return Object.fromEntries(HINDI_SKILLS.map((s) => [s.id, { score: DEFAULT_SKILL_SCORE, correct: 0, wrong: 0 }]))
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SKILL_SCORE
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Update a skill score from one piece of evidence. Correct uses move the score
 * up towards 100 gently; mistakes pull it down a bit faster, so repeated
 * errors quickly bring a skill back into focus.
 */
export function applyEvidence(state: SkillState, correct: boolean, now = Date.now()): SkillState {
  const s = state.score
  const next = correct ? s + Math.max(1, (100 - s) * 0.08) : s - Math.max(2, s * 0.12)
  return {
    score: clampScore(next),
    correct: state.correct + (correct ? 1 : 0),
    wrong: state.wrong + (correct ? 0 : 1),
    last: now,
  }
}

export function overallScore(skills: Record<string, SkillState>): number {
  const vals = HINDI_SKILLS.map((s) => skills[s.id]?.score ?? DEFAULT_SKILL_SCORE)
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function levelFromScore(score: number): Level {
  if (score < 25) return 'A1'
  if (score < 45) return 'A2'
  if (score < 62) return 'B1'
  if (score < 78) return 'B2'
  return 'C1'
}

/**
 * Choose the grammar focus for a session: the weakest skill that is
 * appropriate for the learner's level, avoiding repeating the last focus
 * unless it is clearly the weakest.
 */
export function pickFocus(skills: Record<string, SkillState>, lastFocus?: string | null): string {
  const level = levelFromScore(overallScore(skills))
  const maxIdx = LEVELS.indexOf(level) + 1
  const candidates = HINDI_SKILLS.filter((s) => LEVELS.indexOf(s.minLevel) <= maxIdx)
    .map((s) => ({ id: s.id, score: skills[s.id]?.score ?? DEFAULT_SKILL_SCORE, last: skills[s.id]?.last ?? 0 }))
    .sort((a, b) => a.score - b.score || a.last - b.last)
  if (candidates.length === 0) return HINDI_SKILLS[0].id
  const [first, second] = candidates
  if (first.id === lastFocus && second && second.score - first.score <= 10) return second.id
  return first.id
}
