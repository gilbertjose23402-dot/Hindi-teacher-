import type { Lang } from '../db'

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

/** Marathi grammar skills for an absolute beginner, in teaching order. Ids start with mr_. */
export const MARATHI_SKILLS: SkillDef[] = [
  { id: 'mr_be', name: 'आहे — "to be"', example: 'मी वकील आहे, तुम्ही कुठे आहात?', minLevel: 'A1',
    description: 'Forms of आहे with each pronoun: मी आहे, तू आहेस, तो/ती आहे, आम्ही आहोत, तुम्ही आहात, ते आहेत.' },
  { id: 'mr_gender', name: 'Three genders & agreement', example: 'माझा भाऊ, माझी बहीण, माझं घर', minLevel: 'A1',
    description: 'Masculine, feminine and NEUTER nouns; possessives, adjectives and verbs agree with them (माझा/माझी/माझं/माझे).' },
  { id: 'mr_present', name: 'Present tense', example: 'मी काम करतो/करते, ते करतात', minLevel: 'A1',
    description: 'One-word present tense with person and gender endings (करतो, करते, करतोस, करता, करतात) — no separate आहे.' },
  { id: 'mr_questions', name: 'Questions', example: 'कुठे? कधी? तुम्ही वकील आहात का?', minLevel: 'A1',
    description: 'Question words (काय, कुठे, कधी, का, कोण, किती, कसा) and yes/no questions with का at the END.' },
  { id: 'mr_case_endings', name: 'Case endings (-त, -ला, -वर…)', example: 'कोर्टात, पुण्याला, टेबलावर, घरातून', minLevel: 'A1',
    description: 'Endings attached to the noun (-त in, -ला to, -वर on, -तून from, -साठी for, -बरोबर with) and the stem changes before them.' },
  { id: 'mr_possession', name: 'Having (-कडे) & possessives', example: 'माझ्याकडे गाडी आहे, तुमचं नाव', minLevel: 'A1',
    description: '"I have" with माझ्याकडे/तुमच्याकडे and possessive forms agreeing with the possessed noun.' },
  { id: 'mr_dative', name: 'मला… (like, want, know)', example: 'मला चहा आवडतो, मला पाणी हवं आहे', minLevel: 'A2',
    description: 'Dative subject (मला, तुम्हाला, त्याला…) with आवडणे, हवा/हवी/हवं, पाहिजे, माहीत असणे; the verb agrees with the thing.' },
  { id: 'mr_time', name: 'Time & daily routine', example: 'सकाळी सात वाजता, किती वाजले?', minLevel: 'A1',
    description: 'Numbers, X वाजता (at X o\'clock) and time-of-day words सकाळी, दुपारी, संध्याकाळी, रात्री.' },
  { id: 'mr_past_intr', name: 'Past tense: गेलो / गेले', example: 'मी काल कोर्टात गेलो/गेले', minLevel: 'A2',
    description: 'Past tense of intransitive verbs agreeing with the subject (गेलो, गेले, गेलास, गेला, गेली, गेलात).' },
  { id: 'mr_past_tr', name: 'Past tense: केलं (like ने)', example: 'मी काम केलं, त्याने फाईल वाचली', minLevel: 'A2',
    description: 'Transitive past agreeing with the OBJECT, like Hindi ने; त्याने/तिने/त्यांनी in the 3rd person, -स/-त endings for तू/तुम्ही.' },
  { id: 'mr_future', name: 'Future tense', example: 'मी उद्या येईन, तुम्ही कधी याल?', minLevel: 'A2',
    description: 'Future endings (-ईन, -शील, -ईल, -ऊ, -आल, -तील) — not gendered, unlike Hindi.' },
  { id: 'mr_requests', name: 'Polite requests', example: 'बसा, या, मला मदत कराल का?', minLevel: 'A1',
    description: 'Polite imperatives (stem + आ: बसा, सांगा, द्या) and polite questions with …ाल का?' },
  { id: 'mr_vocab', name: 'Marathi words (not Hindi)', example: 'कुठे not कहाँ, आहे not है, खूप not बहुत', minLevel: 'A1',
    description: 'Using the Marathi word instead of slipping into Hindi (कुठे/कहाँ, काय/क्या, खूप/बहुत, आता/अभी, पण/लेकिन).' },
]

export const SKILLS: Record<Lang, SkillDef[]> = { hi: HINDI_SKILLS, mr: MARATHI_SKILLS }

export function skillsFor(lang: Lang): SkillDef[] {
  return SKILLS[lang]
}

export function skillIdsFor(lang: Lang): string[] {
  return SKILLS[lang].map((s) => s.id)
}

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries([...HINDI_SKILLS, ...MARATHI_SKILLS].map((s) => [s.id, s]))

export interface SkillState {
  score: number
  correct: number
  wrong: number
  last?: number
}

export const DEFAULT_SKILL_SCORE = 35

/** Starting score per language: Hindi is set properly by the placement chat; Marathi starts from zero knowledge. */
export const START_SCORE: Record<Lang, number> = { hi: DEFAULT_SKILL_SCORE, mr: 10 }

export function defaultSkills(lang: Lang = 'hi'): Record<string, SkillState> {
  return Object.fromEntries(SKILLS[lang].map((s) => [s.id, { score: START_SCORE[lang], correct: 0, wrong: 0 }]))
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

export function overallScore(skills: Record<string, SkillState>, lang: Lang = 'hi'): number {
  const vals = SKILLS[lang].map((s) => skills[s.id]?.score ?? START_SCORE[lang])
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
export function pickFocus(skills: Record<string, SkillState>, lastFocus?: string | null, lang: Lang = 'hi'): string {
  const level = levelFromScore(overallScore(skills, lang))
  const maxIdx = LEVELS.indexOf(level) + 1
  const catalogue = SKILLS[lang]
  const candidates = catalogue
    .filter((s) => LEVELS.indexOf(s.minLevel) <= maxIdx)
    .map((s) => ({ id: s.id, score: skills[s.id]?.score ?? START_SCORE[lang], last: skills[s.id]?.last ?? 0 }))
    .sort((a, b) => a.score - b.score || a.last - b.last)
  if (candidates.length === 0) return catalogue[0].id
  const [first, second] = candidates
  if (first.id === lastFocus && second && second.score - first.score <= 10) return second.id
  return first.id
}
