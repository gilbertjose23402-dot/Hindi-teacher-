import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Icon, ScoreBar } from '../components/ui'
import { db, type TimeEntry } from '../db'
import { computeStreak, dayKey, formatMinutes, lastNDays, secondsByDay, shortDayName } from '../lib/dates'
import { go } from '../lib/router'
import { HINDI_SKILLS, LEVEL_LABEL, SKILL_BY_ID, levelFromScore, overallScore } from '../lib/skills'
import { updateProfile, useProfile, useTimeEntries, type Settings } from '../lib/store'

function WeekChart({ entries, goalMin }: { entries: TimeEntry[]; goalMin: number }) {
  const days = lastNDays(7)
  const byDay = secondsByDay(entries)
  const secs = days.map((d) => byDay.get(d) ?? 0)
  const mins = secs.map((s) => s / 60)
  const max = Math.max(goalMin * 1.25, ...mins, 1)
  const [sel, setSel] = useState(days.length - 1)
  const goalPct = (goalMin / max) * 100
  return (
    <div className="week">
      <p className="week-caption" aria-live="polite">
        <strong>{formatMinutes(secs[sel])}</strong>{' '}
        <span className="muted">
          {sel === days.length - 1 ? 'today' : new Date(days[sel] + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </span>
      </p>
      <div className="week-plot">
        <div className="goal-line" style={{ bottom: `${goalPct}%` }}>
          <span>goal {goalMin}</span>
        </div>
        {days.map((d, i) => (
          <button
            key={d}
            type="button"
            className={'week-col' + (i === sel ? ' sel' : '')}
            aria-label={`${shortDayName(d)}: ${formatMinutes(secs[i])}`}
            onClick={() => setSel(i)}
          >
            <span className="week-bar" style={{ height: `${(mins[i] / max) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="week-axis" aria-hidden>
        {days.map((d) => (
          <span key={d}>{d === dayKey() ? 'Today' : shortDayName(d)}</span>
        ))}
      </div>
    </div>
  )
}

export default function Progress({ settings }: { settings: Settings }) {
  const profile = useProfile('hi')
  const time = useTimeEntries()
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().limit(40).toArray(), [])
  const cardCount = useLiveQuery(() => db.cards.count(), [])
  if (!profile || !time || !sessions) return null

  const total = time.reduce((a, e) => a + e.seconds, 0)
  const byDay = secondsByDay(time)
  const week = lastNDays(7).reduce((a, d) => a + (byDay.get(d) ?? 0), 0)
  const today = byDay.get(dayKey()) ?? 0
  const streak = computeStreak(time)
  const overall = overallScore(profile.skills)
  const level = levelFromScore(overall)
  const skills = [...HINDI_SKILLS].sort((a, b) => (profile.skills[a.id]?.score ?? 0) - (profile.skills[b.id]?.score ?? 0))

  return (
    <div className="screen">
      <header className="sub-head">
        <h1>Progress</h1>
      </header>

      <section className="card">
        <h2>Practice time</h2>
        <div className="stats-row">
          <div>
            <strong>{formatMinutes(today)}</strong>
            <span>today</span>
          </div>
          <div>
            <strong>{formatMinutes(week)}</strong>
            <span>last 7 days</span>
          </div>
          <div>
            <strong>{formatMinutes(total)}</strong>
            <span>all time</span>
          </div>
          <div>
            <strong>
              <Icon name="flame" size={16} /> {streak}
            </strong>
            <span>day streak</span>
          </div>
        </div>
        <WeekChart entries={time} goalMin={settings.dailyGoalMin} />
        <p className="hint">Only active conversation time counts. A day joins your streak after 5 minutes.</p>
      </section>

      <section className="card">
        <div className="lang-head">
          <div>
            <h2>Hindi grammar</h2>
            <p className="muted">
              {profile.placementDone ? `Level ${level} · ${LEVEL_LABEL[level]} · ${overall}/100` : 'Take the placement chat to set your level'}
            </p>
          </div>
          {profile.placementDone && <span className="badge">{level}</span>}
        </div>
        <ul className="skill-list">
          {skills.map((s) => {
            const st = profile.skills[s.id]
            return (
              <li key={s.id}>
                <div className="skill-row">
                  <span>
                    {s.name} <small className="muted" lang="hi">{s.example.split(',')[0]}</small>
                  </span>
                  <strong>{st?.score ?? '?'}</strong>
                </div>
                <ScoreBar score={st?.score ?? 0} />
                <div className="skill-meta">
                  <small className="muted">
                    {st && st.correct + st.wrong > 0 ? `${st.correct} right · ${st.wrong} to fix` : 'Not practised yet'}
                  </small>
                  {profile.placementDone && (
                    <button type="button" className="link-btn" onClick={() => go(`/talk/hi/practice?focus=${s.id}&topic=surprise&new=${Date.now()}`)}>
                      Practise
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="hint">{cardCount ?? 0} flashcards collected from your sessions.</p>
      </section>

      {profile.tutorNotes && (
        <section className="card">
          <h2>What Rani remembers about you</h2>
          <p>{profile.tutorNotes}</p>
        </section>
      )}

      <section className="card">
        <h2>Sessions</h2>
        {sessions.length === 0 ? (
          <p className="muted">No conversations yet.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => go(`/recap/${s.id}`)}>
                  <span>
                    <strong>{s.kind === 'placement' ? 'Placement chat' : (SKILL_BY_ID[s.focus ?? '']?.name ?? 'Conversation')}</strong>
                    <small className="muted">
                      {new Date(s.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} ·{' '}
                      {formatMinutes(s.activeSeconds)}
                    </small>
                  </span>
                  <Icon name="back" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.placementDone && (
        <button
          type="button"
          className="btn ghost"
          onClick={async () => {
            if (!confirm('Retake the placement chat? Your skill scores will be replaced by the new results.')) return
            await updateProfile('hi', (p) => {
              p.placementDone = false
            })
            go(`/talk/hi/placement?new=${Date.now()}`)
          }}
        >
          Retake placement chat
        </button>
      )}
    </div>
  )
}
