import type { Lang } from '../db'

export type Track = 'general' | 'law' | 'ai'

export interface Topic {
  id: string
  label: string
  /** What the conversation is about (goes into Rani's instructions). */
  prompt: string
  track: Track
  /** Which language the topic is for ('any' = both). */
  lang: Lang | 'any'
  /** Role-plays: who Rani plays. */
  role?: string
}

export const TOPICS: Topic[] = [
  // Everyday conversation
  { id: 'surprise', label: 'Surprise me', track: 'general', lang: 'any', prompt: 'Pick any everyday topic that suits the grammar focus.' },
  { id: 'daily', label: 'Daily life', track: 'general', lang: 'any', prompt: 'Daily routine, home, errands, weekends.' },
  { id: 'food', label: 'Food & cooking', track: 'general', lang: 'any', prompt: 'Food, cooking, restaurants, Kerala vs North Indian vs Maharashtrian food.' },
  { id: 'movies', label: 'Movies & music', track: 'general', lang: 'any', prompt: 'Hindi, Marathi and Malayalam films, songs, actors, OTT shows.' },
  { id: 'travel', label: 'Travel & Pune', track: 'general', lang: 'any', prompt: 'Life in Pune, travel, trips home to Kerala, places to visit.' },
  { id: 'family', label: 'Family & friends', track: 'general', lang: 'any', prompt: 'Family, friends, festivals, celebrations.' },
  { id: 'work', label: 'Work (general)', track: 'general', lang: 'any', prompt: 'A normal working day, colleagues, commute, office life — keep legal jargon light.' },
  { id: 'news', label: 'News & opinions', track: 'general', lang: 'hi', prompt: 'Current events, technology in daily life, opinions.' },

  // Courtroom & criminal law — Hindi role-plays
  {
    id: 'law_bail',
    label: 'Bail hearing',
    track: 'law',
    lang: 'hi',
    role: 'the Sessions Judge at the Pune Sessions Court — strict but fair',
    prompt:
      'The learner is defence counsel arguing a regular bail application for a client arrested in a theft case. As the judge, ask about the period of custody, criminal antecedents, whether the chargesheet is filed, the risk of tampering with evidence and the sureties offered. Push back on weak arguments, then decide.',
  },
  {
    id: 'law_client',
    label: 'Client interview',
    track: 'law',
    lang: 'hi',
    role: 'a worried client from a small town near Pune who speaks simple Hindi',
    prompt:
      'Your younger brother was arrested last night after a fight outside a hotel and an FIR was registered. The learner interviews you to find out what happened and explains the next steps. Be emotional, give details only when asked.',
  },
  {
    id: 'law_police',
    label: 'At the police station',
    track: 'law',
    lang: 'hi',
    role: 'the duty officer at a Pune police station',
    prompt: 'The learner wants a copy of the FIR and to meet their client who is in police custody. Be procedural and a little unhelpful at first, then cooperate if they are polite and firm.',
  },
  {
    id: 'law_cross',
    label: 'Cross-examination',
    track: 'law',
    lang: 'hi',
    role: 'a prosecution eyewitness',
    prompt:
      'You told the police you saw the accused near the shop at night. The learner cross-examines you (जिरह). Answer realistically, sometimes evasively, and let small inconsistencies appear (lighting, distance, time).',
  },
  {
    id: 'law_explain',
    label: 'Explaining to family',
    track: 'law',
    lang: 'hi',
    role: "the accused's mother — anxious, unfamiliar with courts",
    prompt: 'The learner explains in simple Hindi what bail, the chargesheet and the next hearing date mean, and what she should bring and do.',
  },
  {
    id: 'law_news',
    label: 'Legal news',
    track: 'law',
    lang: 'hi',
    prompt:
      'Discuss legal developments the learner cares about: the new criminal codes (भारतीय न्याय संहिता, भारतीय नागरिक सुरक्षा संहिता, भारतीय साक्ष्य अधिनियम) replacing the IPC, CrPC and Evidence Act, court backlogs, e-courts and bail reform.',
  },

  // AI — Hindi
  { id: 'ai_daily', label: 'AI in daily life', track: 'ai', lang: 'hi', prompt: 'How the learner uses AI tools (including this app) in daily life and work; benefits and worries.' },
  {
    id: 'ai_law',
    label: 'AI & the legal profession',
    track: 'ai',
    lang: 'hi',
    prompt: 'AI for legal research, drafting and translating judgments; risks like invented case citations and confidentiality; should courts allow it?',
  },
  { id: 'ai_deepfake', label: 'Deepfakes as evidence', track: 'ai', lang: 'hi', prompt: 'Debate: can video evidence still be trusted? How should courts and police handle deepfakes?' },
  {
    id: 'ai_explain',
    label: 'Explain AI to a senior',
    track: 'ai',
    lang: 'hi',
    role: 'a senior advocate in his sixties who distrusts technology',
    prompt: 'The learner explains what AI tools can and cannot do for a law practice, convincingly and respectfully. Raise objections.',
  },

  // Court Marathi — role-plays after the last unit
  {
    id: 'mr_clerk',
    label: 'Court clerk',
    track: 'law',
    lang: 'mr',
    role: 'the court clerk (शिरस्तेदार) at the Pune Sessions Court, who speaks only Marathi',
    prompt: 'The learner asks for the next date of their matter and whether it will be heard today. Use short, simple Marathi.',
  },
  {
    id: 'mr_client',
    label: 'Marathi-speaking client',
    track: 'law',
    lang: 'mr',
    role: 'a client from a village near Pune who speaks only Marathi',
    prompt: 'Your son was arrested yesterday. You want to know about bail (जामीन) and what happens next. Speak simple, slow Marathi.',
  },
  {
    id: 'mr_police',
    label: 'Police station (Marathi)',
    track: 'law',
    lang: 'mr',
    role: 'a Marathi-speaking police constable at the station',
    prompt: 'The learner asks where their client is and when they can meet him. Use simple Marathi.',
  },
]

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]))

export const TRACK_LABEL: Record<Track, string> = { general: 'Everyday', law: 'Courtroom & law', ai: 'AI' }

export function topicsFor(lang: Lang, track: Track): Topic[] {
  return TOPICS.filter((t) => t.track === track && (t.lang === 'any' || t.lang === lang))
}

/** Hindi law & AI topics open at level B1 (overall grammar 45+). */
export const TRACK_UNLOCK_SCORE = 45
/** Marathi free conversation opens after this many units. */
export const MARATHI_FREE_TALK_AFTER = 6
