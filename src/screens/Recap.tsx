import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Icon, ScoreBar, Spinner } from '../components/ui'
import { db, type Session } from '../db'
import { formatMinutes } from '../lib/dates'
import { go } from '../lib/router'
import { HINDI_SKILLS, LEVEL_LABEL, SKILL_BY_ID, levelFromScore } from '../lib/skills'
import { finishPractice } from '../lib/tutor'

export default function Recap({ id }: { id: number }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  if (session === undefined) return null
  if (!session) {
    return (
      <div className="screen">
        <p>Session not found.</p>
        <button type="button" className="btn" onClick={() => go('/', true)}>
          Home
        </button>
      </div>
    )
  }
  return (
    <div className="screen recap">
      <header className="sub-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => history.length > 1 ? history.back() : go('/')}>
          <Icon name="back" />
        </button>
        <h1>{session.kind === 'placement' ? 'Your Hindi level' : 'Session recap'}</h1>
      </header>
      {session.kind === 'placement' ? <PlacementReport session={session} /> : <PracticeRecap session={session} />}
      <Transcript session={session} />
    </div>
  )
}

function PlacementReport({ session }: { session: Session }) {
  const r = session.placement
  if (!r) return <p className="muted">This placement chat ended before it could be scored. Start a new one from Home.</p>
  const avg = Math.round(r.skills.reduce((a, s) => a + s.score, 0) / r.skills.length)
  const level = levelFromScore(avg)
  const sorted = [...r.skills].sort((a, b) => a.score - b.score)
  return (
    <div className="stack">
      <section className="card level-card">
        <span className="badge huge">{level}</span>
        <div>
          <h2>{LEVEL_LABEL[level]}</h2>
          <p className="muted">Grammar score {avg}/100</p>
        </div>
      </section>
      <section className="card">
        <p>{r.summary}</p>
        {r.listening && (
          <p className="muted">
            <strong>Listening:</strong> {r.listening}
          </p>
        )}
      </section>
      <div className="two-col">
        <section className="card">
          <h3>Strengths</h3>
          <ul>
            {r.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3>Work on</h3>
          <ul>
            {r.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card">
        <h3>Grammar skills (weakest first)</h3>
        <ul className="skill-list">
          {sorted.map((s) => (
            <li key={s.skill}>
              <div className="skill-row">
                <span>{SKILL_BY_ID[s.skill]?.name ?? s.skill}</span>
                <strong>{s.score}</strong>
              </div>
              <ScoreBar score={s.score} />
              <small className="muted">{s.comment}</small>
            </li>
          ))}
        </ul>
      </section>
      <button type="button" className="btn primary big" onClick={() => go('/', true)}>
        Start practising
      </button>
    </div>
  )
}

function PracticeRecap({ session }: { session: Session }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const r = session.recap
  const before = session.skillsBefore ?? {}
  const after = session.skillsAfter ?? {}
  const changed = HINDI_SKILLS.filter((s) => before[s.id] != null && after[s.id] != null && before[s.id] !== after[s.id])
  const corrections = session.turns.filter((t) => t.correction).length
  const learnerTurns = session.turns.filter((t) => t.role === 'user').length

  const generate = async () => {
    setBusy(true)
    setErr('')
    try {
      await finishPractice(session.id!)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="stack">
      <section className="card stats-row">
        <div>
          <strong>{formatMinutes(session.activeSeconds)}</strong>
          <span>active time</span>
        </div>
        <div>
          <strong>{learnerTurns}</strong>
          <span>{learnerTurns === 1 ? 'thing you said' : 'things you said'}</span>
        </div>
        <div>
          <strong>{corrections}</strong>
          <span>{corrections === 1 ? 'correction' : 'corrections'}</span>
        </div>
      </section>

      {!r ? (
        <section className="card stack">
          <p className="muted">No recap was made for this session.</p>
          <button type="button" className="btn" disabled={busy} onClick={generate}>
            {busy ? <Spinner label="Working…" /> : 'Make recap now'}
          </button>
          {err && <p className="error-text">{err}</p>}
        </section>
      ) : (
        <>
          <section className="card">
            <p>{r.summary}</p>
            {r.wins.length > 0 && (
              <>
                <h3>What went well</h3>
                <ul>
                  {r.wins.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
          {changed.length > 0 && (
            <section className="card">
              <h3>Skill changes</h3>
              <ul className="skill-list">
                {changed.map((s) => {
                  const d = after[s.id] - before[s.id]
                  return (
                    <li key={s.id} className="skill-row">
                      <span>{s.name}</span>
                      <span className={d > 0 ? 'up' : 'down'}>
                        {before[s.id]} → {after[s.id]} ({d > 0 ? '+' : ''}
                        {d})
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {r.mistakes.length > 0 && (
            <section className="card">
              <h3>Mistakes to remember</h3>
              <ul className="mistakes">
                {r.mistakes.map((m, i) => (
                  <li key={i}>
                    <div className="corr-line wrong">
                      <Icon name="x" size={14} />
                      <span lang="hi">{m.wrong}</span>
                    </div>
                    <div className="corr-line right">
                      <Icon name="check" size={14} />
                      <span lang="hi">{m.right}</span>
                    </div>
                    <p className="rule">{m.rule}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.patterns.length > 0 && (
            <section className="card">
              <h3>Saved as flashcards ({r.patterns.length})</h3>
              <ul className="patterns">
                {r.patterns.map((p, i) => (
                  <li key={i}>
                    <span>{p.english}</span>
                    <strong lang="hi">{p.target}</strong>
                    {p.note && <small className="muted">{p.note}</small>}
                  </li>
                ))}
              </ul>
              <p className="hint">The review screen for these arrives in the next update.</p>
            </section>
          )}
        </>
      )}
      <button type="button" className="btn primary big" onClick={() => go('/', true)}>
        Done
      </button>
    </div>
  )
}

function Transcript({ session }: { session: Session }) {
  return (
    <details className="card transcript">
      <summary>Full transcript</summary>
      <ul>
        {session.turns.map((t, i) => (
          <li key={i} className={t.role}>
            <strong>{t.role === 'user' ? 'You' : 'Rani'}:</strong> <span lang="hi">{t.text}</span>
            {t.correction && (
              <div className="muted small">
                ✓ <span lang="hi">{t.correction.better}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
