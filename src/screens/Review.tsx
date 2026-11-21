import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Icon, Spinner } from '../components/ui'
import { db, type Card, type Lang } from '../db'
import { go } from '../lib/router'
import { LANG_NAME, NoSpeechError, speak, startListening, stopSpeaking, unlockAudio, type Listening } from '../lib/speech'
import { GRADES, intervalLabel, sameSentence, schedule, type Grade } from '../lib/srs'
import type { Settings } from '../lib/store'
import { addLegalDeck } from '../lib/tutor'

const DECK_LABEL: Record<NonNullable<Card['deck']>, string> = { mistakes: 'From your mistakes', lesson: 'Lesson phrase', legal: 'Legal term' }
const GRADE_LABEL: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }
const MAX_PER_ROUND = 30

type Filter = Lang | 'all'

/**
 * Number of cards due now. Watches the whole table (a range query on `due`
 * would miss newly added cards, whose due time is later than the query's
 * "now") and re-checks every minute as cards become due.
 */
export function useDueCount(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return (
    useLiveQuery(async () => {
      const now = Date.now()
      return db.cards.filter((c) => c.due <= now).count()
    }, [tick]) ?? 0
  )
}

export default function Review({ settings }: { settings: Settings }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [listen, setListen] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(0)
  const [adding, setAdding] = useState(false)
  const listenRef = useRef<Listening | null>(null)

  const stats = useLiveQuery(async () => {
    const now = Date.now()
    const all = await db.cards.toArray()
    const due = all.filter((c) => c.due <= now)
    const upcoming = all.filter((c) => c.due > now).sort((a, b) => a.due - b.due)[0]
    return {
      total: all.length,
      due: { all: due.length, hi: due.filter((c) => c.lang === 'hi').length, mr: due.filter((c) => c.lang === 'mr').length },
      hasLegal: all.some((c) => c.deck === 'legal'),
      nextDue: upcoming?.due,
    }
  }, [done])

  // Build a round of due cards (oldest first) whenever the filter changes.
  useEffect(() => {
    let alive = true
    void (async () => {
      const now = Date.now()
      const due = await db.cards.where('due').belowOrEqual(now).sortBy('due')
      if (!alive) return
      setQueue(due.filter((c) => filter === 'all' || c.lang === filter).slice(0, MAX_PER_ROUND))
      setIndex(0)
      setShown(false)
      setSaid(null)
    })()
    return () => {
      alive = false
    }
  }, [filter])

  useEffect(
    () => () => {
      listenRef.current?.cancel()
      stopSpeaking()
    },
    [],
  )

  const card = queue?.[index]

  const reveal = () => {
    if (!card) return
    setShown(true)
    if (settings.autoSpeak) void speak(card.back, card.lang, settings)
  }

  const onMic = async () => {
    if (!card) return
    unlockAudio()
    setNote('')
    if (listen === 'recording') {
      const h = listenRef.current
      listenRef.current = null
      if (!h) return
      setListen('transcribing')
      try {
        setSaid((await h.finish()).trim())
        reveal()
      } catch (e) {
        setNote(e instanceof NoSpeechError ? e.message : (e as Error).message)
      }
      setListen('idle')
      return
    }
    stopSpeaking()
    try {
      listenRef.current = await startListening(settings, card.lang)
      setListen('recording')
    } catch (e) {
      setNote((e as Error).message)
    }
  }

  const grade = async (g: Grade) => {
    if (!card?.id) return
    const next = schedule(card, g)
    await db.cards.update(card.id, next)
    setDone((d) => d + 1)
    // "Again" comes back at the end of this round.
    if (g === 'again' && queue) setQueue([...queue, { ...card, ...next }])
    setIndex((i) => i + 1)
    setShown(false)
    setSaid(null)
    stopSpeaking()
  }

  const remove = async () => {
    if (!card?.id || !queue || !confirm('Delete this card?')) return
    await db.cards.delete(card.id)
    setQueue(queue.filter((_, i) => i !== index))
    setShown(false)
    setSaid(null)
  }

  const addLegal = async () => {
    setAdding(true)
    const n = await addLegalDeck()
    setAdding(false)
    setNote(`Added ${n} legal vocabulary cards.`)
    setDone((d) => d + 1)
    const now = Date.now()
    const due = await db.cards.where('due').belowOrEqual(now).sortBy('due')
    setQueue(due.filter((c) => filter === 'all' || c.lang === filter).slice(0, MAX_PER_ROUND))
    setIndex(0)
  }

  const chip = (f: Filter, label: string, n: number) => (
    <button key={f} type="button" className={'chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>
      {label} · {n}
    </button>
  )

  return (
    <div className="screen review">
      <header className="sub-head">
        <h1>Review</h1>
      </header>

      {stats && (
        <div className="chips">
          {chip('all', 'All', stats.due.all)}
          {chip('hi', 'Hindi', stats.due.hi)}
          {chip('mr', 'Marathi', stats.due.mr)}
        </div>
      )}

      {queue === null ? (
        <Spinner label="Loading cards…" />
      ) : !card ? (
        <section className="card stack center-text">
          <h2>{done > 0 ? `Done — ${done} card${done === 1 ? '' : 's'} reviewed` : 'All caught up'}</h2>
          <p className="muted">
            {stats?.total
              ? stats.nextDue
                ? `Next card is due ${new Date(stats.nextDue).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`
                : 'Nothing is waiting.'
              : 'Cards appear here from your conversations, Marathi lessons and the legal vocabulary deck.'}
          </p>
          <p className="hint">{stats?.total ?? 0} cards in total.</p>
          <button type="button" className="btn ghost" onClick={() => go('/')}>
            Back to Home
          </button>
        </section>
      ) : (
        <section className="card flashcard">
          <div className="flash-meta">
            <span className="tag-soft">
              {LANG_NAME[card.lang]} · {DECK_LABEL[card.deck ?? 'mistakes']}
            </span>
            <span className="muted small">
              {index + 1} / {queue.length}
            </span>
          </div>
          <p className="flash-front">{card.front}</p>
          <p className="hint">Say it in {LANG_NAME[card.lang]}, then check.</p>

          {said !== null && (
            <div className={'said ' + (sameSentence(said, card.back) ? 'ok' : '')}>
              <span className="muted small">You said</span>
              <p lang={card.lang}>{said || '—'}</p>
              {shown && sameSentence(said, card.back) && (
                <p className="ok-text">
                  <Icon name="check" size={14} /> Exactly right!
                </p>
              )}
            </div>
          )}

          {shown ? (
            <>
              <div className="flash-back">
                <p lang={card.lang}>{card.back}</p>
                <button type="button" className="icon-btn" aria-label="Hear the answer" onClick={() => void speak(card.back, card.lang, settings)}>
                  <Icon name="speaker" />
                </button>
              </div>
              {card.note && <p className="rule">{card.note}</p>}
              <div className="grade-row">
                {GRADES.map((g) => (
                  <button key={g} type="button" className={'btn grade ' + g} onClick={() => void grade(g)}>
                    <strong>{GRADE_LABEL[g]}</strong>
                    <small>{intervalLabel(schedule(card, g))}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="button-row center-row">
              <button type="button" className={'btn' + (listen === 'recording' ? ' danger' : '')} disabled={listen === 'transcribing'} onClick={() => void onMic()}>
                {listen === 'transcribing' ? (
                  <Spinner label="Listening…" />
                ) : (
                  <>
                    <Icon name={listen === 'recording' ? 'stop' : 'mic'} size={18} /> {listen === 'recording' ? 'Stop' : 'Say it'}
                  </>
                )}
              </button>
              <button type="button" className="btn primary" disabled={listen !== 'idle'} onClick={reveal}>
                Show answer
              </button>
            </div>
          )}
          {note && <p className="hint">{note}</p>}
          <button type="button" className="link-btn delete-card" onClick={() => void remove()}>
            Delete card
          </button>
        </section>
      )}

      {stats && !stats.hasLegal && (
        <section className="card stack">
          <h2>Legal vocabulary deck</h2>
          <p className="muted">28 criminal-court terms in Hindi and Marathi — ज़मानत / जामीन, जिरह / उलटतपासणी, मुवक्किल / अशील… Five new terms a day.</p>
          <button type="button" className="btn" disabled={adding} onClick={() => void addLegal()}>
            {adding ? <Spinner /> : 'Add the legal deck'}
          </button>
        </section>
      )}
    </div>
  )
}
