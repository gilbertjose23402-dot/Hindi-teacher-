import type { Lang, Session } from '../db'

/** Link that starts a brand-new conversation. */
export function newTalkUrl(lang: Lang, kind: Session['kind'], opts: { focus?: string | null; topic?: string; unit?: string } = {}): string {
  const q = new URLSearchParams()
  if (opts.focus) q.set('focus', opts.focus)
  if (opts.topic) q.set('topic', opts.topic)
  if (opts.unit) q.set('unit', opts.unit)
  q.set('new', String(Date.now()))
  return `/talk/${lang}/${kind}?${q.toString()}`
}

/** Link that reopens a saved (interrupted) conversation. */
export function resumeTalkUrl(s: Session): string {
  const q = new URLSearchParams()
  if (s.focus) q.set('focus', s.focus)
  q.set('topic', s.topic)
  if (s.unitId) q.set('unit', s.unitId)
  q.set('s', String(s.id))
  q.set('resume', '1')
  return `/talk/${s.lang}/${s.kind}?${q.toString()}`
}
