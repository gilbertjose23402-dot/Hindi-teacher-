import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon, Spinner } from '../components/ui'
import { db, type Correction, type Lang, type Session, type Turn } from '../db'
import { isOnDevice } from '../lib/llm'
import { useBrainProgress } from '../lib/local'
import { TOPIC_BY_ID } from '../lib/prompts'
import { go } from '../lib/router'
import { SKILL_BY_ID } from '../lib/skills'
import { NoSpeechError, speak, startListening, stopSpeaking, unlockAudio, type Listening } from '../lib/speech'
import { getProfile, logPracticeTime, type Settings } from '../lib/store'
import { applyTurnEvidence, finishPlacement, finishPractice, runTurn } from '../lib/tutor'

type Phase = 'starting' | 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'ending'

/** Seconds without any activity after which the clock stops counting. */
const IDLE_MS = 90_000

const STATUS: Record<Phase, string> = {
  starting: 'Rani is getting ready…',
  idle: 'Tap the mic and speak',
  recording: 'Listening… tap again to send',
  transcribing: 'Writing down what you said…',
  thinking: 'Rani is thinking…',
  speaking: 'Rani is speaking — tap the mic to interrupt',
  ending: 'Preparing your recap…',
}

interface ErrorState {
  msg: string
  retry?: () => void
  alt?: { label: string; fn: () => void }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Counts active practice time: screen visible and either busy or touched in the last 90 s. */
function useActiveTime(lang: Lang, sessionId: number | undefined, isBusy: () => boolean) {
  const last = useRef(Date.now())
  const pending = useRef(0)
  const flushRef = useRef<() => void>(() => {})
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (sessionId == null) return
    const flush = () => {
      const n = pending.current
      pending.current = 0
      if (n > 0) void logPracticeTime(lang, n, sessionId)
    }
    flushRef.current = flush
    const iv = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (isBusy() || Date.now() - last.current < IDLE_MS) {
        pending.current++
        setSeconds((s) => s + 1)
        if (pending.current >= 15) flush()
      }
    }, 1000)
    const onVis = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [lang, sessionId, isBusy])
  return {
    seconds,
    touch: () => {
      last.current = Date.now()
    },
    flush: () => flushRef.current(),
  }
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null
      } catch {
        /* not supported / denied — fine */
      }
    }
    void request()
    const onVis = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [])
}

export default function Conversation({
  settings,
  lang,
  kind,
  focus,
  topic,
}: {
  settings: Settings
  lang: Lang
  kind: 'placement' | 'practice'
  focus: string | null
  topic: string
}) {
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const [phase, setPhaseState] = useState<Phase>('starting')
  const phaseRef = useRef<Phase>('starting')
  const [error, setError] = useState<ErrorState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [hideText, setHideText] = useState(false)
  const [reveal, setReveal] = useState<Record<number, { text?: boolean; roman?: boolean; english?: boolean }>>({})
  const [placementReady, setPlacementReady] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const listenRef = useRef<Listening | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const started = useRef(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const brain = useBrainProgress()

  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const isBusy = useCallback(() => phaseRef.current !== 'idle' && phaseRef.current !== 'starting', [])
  const timer = useActiveTime(lang, session?.id, isBusy)
  useWakeLock()

  const persist = async (next: Session) => {
    sessionRef.current = next
    setSession(next)
    if (next.id != null) await db.sessions.update(next.id, { turns: next.turns })
  }

  const raniTurn = async (sess: Session): Promise<void> => {
    setPhase('thinking')
    setError(null)
    let res
    try {
      res = await runTurn(sess, settingsRef.current)
    } catch (e) {
      setPhase('idle')
      setError({ msg: errMsg(e), retry: () => void raniTurn(sess) })
      return
    }
    const turns = [...sess.turns]
    const last = turns.at(-1)
    if (last?.role === 'user') turns[turns.length - 1] = { ...last, correction: res.correction, evidence: res.evidence }
    turns.push({ role: 'rani', text: res.reply, roman: res.roman, english: res.english, at: Date.now() })
    const next = { ...sess, turns }
    await persist(next)
    await applyTurnEvidence(next, res.evidence)
    timer.touch()
    if (res.placementComplete) setPlacementReady(true)
    if (settingsRef.current.autoSpeak) {
      setPhase('speaking')
      const ttsNotice = await speak(res.reply, lang, settingsRef.current)
      if (ttsNotice) setNotice(ttsNotice)
    }
    if (phaseRef.current === 'speaking' || phaseRef.current === 'thinking') setPhase('idle')
    timer.touch()
  }

  const userSays = async (text: string, via: 'voice' | 'text') => {
    const sess = sessionRef.current
    if (!sess) return
    const next = { ...sess, turns: [...sess.turns, { role: 'user', text, via, at: Date.now() } as Turn] }
    await persist(next)
    await raniTurn(next)
  }

  // Create the session and let Rani open the conversation.
  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const profile = await getProfile(lang)
      const base: Session = {
        lang,
        kind,
        topic,
        focus: kind === 'practice' ? focus : null,
        startedAt: Date.now(),
        activeSeconds: 0,
        turns: [],
        skillsBefore: Object.fromEntries(Object.entries(profile.skills).map(([k, v]) => [k, v.score])),
      }
      const id = await db.sessions.add(base)
      const sess = { ...base, id }
      sessionRef.current = sess
      setSession(sess)
      await raniTurn(sess)
    })()
    return () => {
      stopSpeaking()
      listenRef.current?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [session?.turns.length, phase])

  // Microphone level meter.
  useEffect(() => {
    if (phase !== 'recording') return setMicLevel(0)
    let raf = 0
    const loop = () => {
      setMicLevel(listenRef.current?.level() ?? 0)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const onMic = async () => {
    timer.touch()
    if (phaseRef.current === 'recording') {
      const h = listenRef.current
      listenRef.current = null
      if (!h) return
      setPhase('transcribing')
      try {
        const text = (await h.finish()).trim()
        if (!text) throw new NoSpeechError("I didn't catch that — tap the mic and try again.")
        await userSays(text, 'voice')
      } catch (e) {
        setPhase('idle')
        if (e instanceof NoSpeechError) setNotice(e.message)
        else setError({ msg: errMsg(e) })
      }
      return
    }
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'speaking') return
    stopSpeaking()
    setError(null)
    setNotice(null)
    try {
      listenRef.current = await startListening(settingsRef.current, lang)
      setPhase('recording')
    } catch (e) {
      setPhase('idle')
      setError({ msg: errMsg(e) })
    }
  }

  const cancelRecording = () => {
    listenRef.current?.cancel()
    listenRef.current = null
    setPhase('idle')
  }

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || phaseRef.current !== 'idle') return
    timer.touch()
    setDraft('')
    stopSpeaking()
    await userSays(text, 'text')
  }

  const endSession = async () => {
    const sess = sessionRef.current
    stopSpeaking()
    listenRef.current?.cancel()
    listenRef.current = null
    timer.flush()
    if (!sess?.id) return go('/', true)
    const learnerTurns = sess.turns.filter((t) => t.role === 'user').length
    if (learnerTurns === 0) {
      await db.sessions.delete(sess.id)
      return go('/', true)
    }
    if (sess.kind === 'placement' && !placementReady && learnerTurns < 5) {
      if (!confirm('Leave the placement chat? Rani needs at least 5 answers to estimate your level, so this one won’t be scored.')) return
      await db.sessions.update(sess.id, { endedAt: Date.now() })
      return go('/', true)
    }
    setPhase('ending')
    setError(null)
    await db.sessions.update(sess.id, { endedAt: Date.now() })
    try {
      if (sess.kind === 'placement') await finishPlacement(sess.id)
      else await finishPractice(sess.id)
      go(`/recap/${sess.id}`, true)
    } catch (e) {
      setPhase('idle')
      setError({
        msg: `Couldn't create the recap: ${errMsg(e)}`,
        retry: () => void endSession(),
        alt: sess.kind === 'practice' ? { label: 'Skip recap', fn: () => go(`/recap/${sess.id}`, true) } : undefined,
      })
    }
  }

  const toggle = (i: number, key: 'text' | 'roman' | 'english') => setReveal((r) => ({ ...r, [i]: { ...r[i], [key]: !r[i]?.[key] } }))

  const turns = session?.turns ?? []
  const learnerCount = turns.filter((t) => t.role === 'user').length
  const subtitle =
    kind === 'placement'
      ? `Placement chat · ${learnerCount}/~12 answers`
      : `${SKILL_BY_ID[focus ?? '']?.name ?? 'Free talk'} · ${TOPIC_BY_ID[topic]?.label ?? ''}`
  const mins = Math.floor(timer.seconds / 60)
  const secs = String(timer.seconds % 60).padStart(2, '0')
  const canEnd = phase === 'idle' || phase === 'speaking' || phase === 'recording'
  const endLabel = kind === 'placement' ? (placementReady || learnerCount >= 5 ? 'Finish' : 'Quit') : 'End'

  return (
    <div
      className="talk"
      onPointerDown={() => {
        timer.touch()
        unlockAudio()
      }}
    >
      <header className="talk-head">
        <div className="avatar" aria-hidden>
          रा
        </div>
        <div className="talk-title">
          <strong>Rani</strong>
          <span>{subtitle}</span>
        </div>
        <span className="timer" aria-label="Active time this session">
          {mins}:{secs}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={hideText}
          aria-label={hideText ? 'Show Rani’s text' : 'Listening practice: hide Rani’s text'}
          onClick={() => setHideText(!hideText)}
        >
          <Icon name={hideText ? 'eyeOff' : 'eye'} />
        </button>
        <button type="button" className="btn small" disabled={!canEnd} onClick={() => void endSession()}>
          {endLabel}
        </button>
      </header>

      <main className="chat" aria-live="polite">
        {turns.map((t, i) =>
          t.role === 'rani' ? (
            <RaniBubble
              key={i}
              turn={t}
              hidden={hideText && !reveal[i]?.text}
              showRoman={settings.showRomanDefault !== !!reveal[i]?.roman}
              showEnglish={!!reveal[i]?.english}
              onToggle={(k) => toggle(i, k)}
              onReplay={() => {
                timer.touch()
                void speak(t.text, lang, settings)
              }}
            />
          ) : (
            <UserBubble key={i} turn={t} evaluated={i < turns.length - 1} lang={lang} settings={settings} />
          ),
        )}
        {(phase === 'thinking' || phase === 'starting') && (
          <div className="bubble rani typing" aria-label="Rani is typing">
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={chatEnd} />
      </main>

      <footer className="dock">
        {error && (
          <div className="banner error" role="alert">
            <span>{error.msg}</span>
            <span className="banner-actions">
              {error.retry && (
                <button type="button" className="btn small" onClick={error.retry}>
                  Retry
                </button>
              )}
              {error.alt && (
                <button type="button" className="btn ghost small" onClick={error.alt.fn}>
                  {error.alt.label}
                </button>
              )}
            </span>
          </div>
        )}
        {notice && !error && <div className="banner info">{notice}</div>}
        {placementReady && phase !== 'ending' && (
          <button type="button" className="btn primary big" onClick={() => void endSession()}>
            See my results
          </button>
        )}
        {typing ? (
          <form className="type-row" onSubmit={onSend}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="हिंदी में लिखिए… (or Hinglish)"
              lang="hi"
              aria-label="Type your message"
            />
            <button type="submit" className="icon-btn primary" aria-label="Send" disabled={!draft.trim() || phase !== 'idle'}>
              <Icon name="send" />
            </button>
            <button type="button" className="icon-btn" aria-label="Switch to voice" onClick={() => setTyping(false)}>
              <Icon name="mic" />
            </button>
          </form>
        ) : (
          <div className="dock-row">
            <button type="button" className="icon-btn" aria-label="Type instead" disabled={phase === 'recording'} onClick={() => setTyping(true)}>
              <Icon name="keyboard" />
            </button>
            <button
              type="button"
              className={'mic ' + phase}
              onClick={() => void onMic()}
              disabled={!(phase === 'idle' || phase === 'speaking' || phase === 'recording')}
              aria-label={phase === 'recording' ? 'Stop and send' : 'Start speaking'}
            >
              <span className="mic-level" style={{ transform: `scale(${1 + micLevel * 0.7})` }} />
              {phase === 'transcribing' || phase === 'thinking' || phase === 'starting' ? <Spinner /> : <Icon name={phase === 'recording' ? 'stop' : 'mic'} size={34} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cancel recording"
              style={{ visibility: phase === 'recording' ? 'visible' : 'hidden' }}
              onClick={cancelRecording}
            >
              <Icon name="x" />
            </button>
          </div>
        )}
        {brain && (phase === 'thinking' || phase === 'starting' || phase === 'ending') ? (
          <div className="dl" role="status">
            <progress max={1} value={brain.progress} />
            <p className="status">Loading Rani's brain… {Math.round(brain.progress * 100)}%</p>
          </div>
        ) : (
          <p className="status">{STATUS[phase]}</p>
        )}
      </footer>

      {phase === 'ending' && (
        <div className="overlay" role="status">
          <Spinner />
          <p>{kind === 'placement' ? 'Rani is assessing your Hindi…' : 'Rani is preparing your recap…'}</p>
          {isOnDevice(settings.llmPrimary) && <p className="hint">On the phone this can take a minute.</p>}
        </div>
      )}
    </div>
  )
}

function RaniBubble({
  turn,
  hidden,
  showRoman,
  showEnglish,
  onToggle,
  onReplay,
}: {
  turn: Turn
  hidden: boolean
  showRoman: boolean
  showEnglish: boolean
  onToggle: (k: 'text' | 'roman' | 'english') => void
  onReplay: () => void
}) {
  return (
    <div className="bubble rani">
      <p className={'devanagari' + (hidden ? ' blurred' : '')} lang="hi" onClick={() => hidden && onToggle('text')}>
        {turn.text}
      </p>
      {!hidden && showRoman && turn.roman && <p className="roman">{turn.roman}</p>}
      {!hidden && showEnglish && turn.english && <p className="english">{turn.english}</p>}
      <div className="bubble-tools">
        <button type="button" onClick={onReplay} aria-label="Play again">
          <Icon name="speaker" size={16} />
        </button>
        {hidden ? (
          <button type="button" onClick={() => onToggle('text')}>
            Show text
          </button>
        ) : (
          <>
            {turn.roman && (
              <button type="button" aria-pressed={showRoman} onClick={() => onToggle('roman')}>
                Aa
              </button>
            )}
            <button type="button" aria-pressed={showEnglish} onClick={() => onToggle('english')}>
              EN
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function UserBubble({ turn, evaluated, lang, settings }: { turn: Turn; evaluated: boolean; lang: Lang; settings: Settings }) {
  return (
    <div className="user-wrap">
      <div className="bubble user">
        <p lang="hi">{turn.text}</p>
      </div>
      {turn.correction ? (
        <CorrectionCard c={turn.correction} onHear={() => void speak(turn.correction!.better, lang, settings)} />
      ) : (
        evaluated && (
          <p className="ok-chip">
            <Icon name="check" size={14} /> Looks good
          </p>
        )
      )}
    </div>
  )
}

export function CorrectionCard({ c, onHear }: { c: Correction; onHear?: () => void }) {
  return (
    <div className="correction">
      <div className="corr-line wrong">
        <Icon name="x" size={16} />
        <span lang="hi">{c.you_said}</span>
      </div>
      <div className="corr-line right">
        <Icon name="check" size={16} />
        <span lang="hi">{c.better}</span>
        {onHear && (
          <button type="button" className="hear" aria-label="Hear the correct sentence" onClick={onHear}>
            <Icon name="speaker" size={16} />
          </button>
        )}
      </div>
      {c.rule && <p className="rule">{c.rule}</p>}
      {c.tip && (
        <p className="tip">
          <strong>Tip</strong> {c.tip}
        </p>
      )}
      {c.skill && SKILL_BY_ID[c.skill] && <span className="skill-tag">{SKILL_BY_ID[c.skill].name}</span>}
    </div>
  )
}
