import { useEffect, useState } from 'react'
import { TopicPicker } from '../components/TopicPicker'
import { Icon, Ring, ScoreBar } from '../components/ui'
import { MARATHI_UNITS, UNIT_BY_ID, nextUnit, unitsCompleted } from '../content/marathi'
import { TOPIC_BY_ID, TRACK_UNLOCK_SCORE, type Track } from '../content/topics'
import { db, type Session } from '../db'
import { computeStreak, dayKey, formatMinutes, lastNDays, secondsByDay } from '../lib/dates'
import { hasLlm } from '../lib/llm'
import { newTalkUrl, resumeTalkUrl } from '../lib/nav'
import { useUpdateReady } from '../lib/pwa'
import { go } from '../lib/router'
import { HINDI_SKILLS, LEVEL_LABEL, SKILL_BY_ID, levelFromScore, overallScore, pickFocus } from '../lib/skills'
import { unlockAudio } from '../lib/speech'
import { lastActivity, useProfile, useResumableSession, useTimeEntries, type Settings } from '../lib/store'
import { useDueCount } from './Review'

function sessionLabel(s: Session): string {
  if (s.kind === 'placement') return 'Placement chat'
  if (s.kind === 'lesson') {
    const u = s.unitId ? UNIT_BY_ID[s.unitId] : undefined
    return u ? `Marathi Unit ${u.no} · ${u.titleMr}` : 'Marathi lesson'
  }
  const topic = TOPIC_BY_ID[s.topic]
  return `${s.lang === 'mr' ? 'Marathi' : 'Hindi'} · ${topic?.label ?? SKILL_BY_ID[s.focus ?? '']?.name ?? 'Conversation'}`
}

export default function Home({ settings }: { settings: Settings }) {
  const profile = useProfile('hi')
  const mrProfile = useProfile('mr')
  const time = useTimeEntries()
  const resumable = useResumableSession()
  const update = useUpdateReady()
  const due = useDueCount()
  const [focus, setFocus] = useState<string>('')
  const [track, setTrack] = useState<Track>('general')
  const [topic, setTopic] = useState('surprise')

  useEffect(() => {
    if (profile && !focus) setFocus(pickFocus(profile.skills, profile.lastFocus))
  }, [profile, focus])

  if (!profile || !mrProfile || !time) return null

  const byDay = secondsByDay(time)
  const today = byDay.get(dayKey()) ?? 0
  const week = lastNDays(7).reduce((a, d) => a + (byDay.get(d) ?? 0), 0)
  const streak = computeStreak(time)
  const goal = settings.dailyGoalMin * 60
  const overall = overallScore(profile.skills)
  const level = levelFromScore(overall)
  const focusDef = SKILL_BY_ID[focus] ?? HINDI_SKILLS[0]
  const tracksOpen = settings.unlockTracks || (profile.placementDone && overall >= TRACK_UNLOCK_SCORE)
  const mrDone = unitsCompleted(mrProfile.units)
  const mrNext = nextUnit(mrProfile.units)

  return (
    <div className="screen">
      <header className="home-head">
        <div>
          <p className="muted">नमस्ते,</p>
          <h1>{settings.learnerName || 'friend'}</h1>
        </div>
        <div className={'streak' + (streak > 0 ? ' on' : '')} title="Days in a row with 5+ minutes">
          <Icon name="flame" size={20} />
          <strong>{streak}</strong>
          <span>day{streak === 1 ? '' : 's'}</span>
        </div>
      </header>

      {update && (
        <div className="banner info">
          <span>A new version of Rani is ready.</span>
          <button type="button" className="btn small primary" onClick={update}>
            Update
          </button>
        </div>
      )}

      {!hasLlm(settings) && (
        <button type="button" className="banner warn" onClick={() => go('/settings')}>
          Set up Rani's brain in Settings (one-time download, no account) to start talking.
        </button>
      )}

      {resumable && (
        <section className="card continue-card">
          <div>
            <h2>Continue your conversation</h2>
            <p className="muted">
              {sessionLabel(resumable)} · {resumable.turns.filter((t) => t.role === 'user').length} answers · last at{' '}
              {new Date(lastActivity(resumable)).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                unlockAudio()
                go(resumeTalkUrl(resumable))
              }}
            >
              <Icon name="mic" /> Continue
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                await db.sessions.update(resumable.id!, { endedAt: lastActivity(resumable) })
                if (resumable.kind !== 'placement') go(`/recap/${resumable.id}`)
              }}
            >
              End it
            </button>
          </div>
        </section>
      )}

      <section className="card today">
        <Ring value={today} max={goal} label={`${Math.floor(today / 60)}`} sub={`of ${settings.dailyGoalMin} min`} />
        <div>
          <h2>Today</h2>
          <p>{today >= goal ? 'Daily goal reached — शाबाश!' : `${Math.max(1, Math.ceil((goal - today) / 60))} min to your daily goal`}</p>
          <p className="muted">This week: {formatMinutes(week)}</p>
        </div>
      </section>

      {due > 0 && (
        <button type="button" className="card review-card" onClick={() => go('/review')}>
          <Icon name="cards" />
          <span>
            <strong>
              {due} flashcard{due === 1 ? '' : 's'} due
            </strong>
            <small className="muted">About {Math.max(1, Math.round(due / 4))} min · your mistakes, lesson phrases and legal terms</small>
          </span>
          <Icon name="back" size={16} />
        </button>
      )}

      <section className="card lang-card">
        <div className="lang-head">
          <div>
            <h2>
              Hindi <span lang="hi">हिंदी</span>
            </h2>
            {profile.placementDone ? (
              <p className="muted">
                Level {level} · {LEVEL_LABEL[level]} · grammar {overall}/100
              </p>
            ) : (
              <p className="muted">Grammar-first conversation practice</p>
            )}
          </div>
          {profile.placementDone && <span className="badge">{level}</span>}
        </div>
        {profile.placementDone && <ScoreBar score={overall} />}

        {!profile.placementDone ? (
          <div className="stack">
            <p>Start with a relaxed ~10 minute chat. Rani will find your level and the grammar points to work on.</p>
            <button type="button" className="btn primary big" disabled={!hasLlm(settings)} onClick={() => {
                unlockAudio()
                go(newTalkUrl('hi', 'placement'))
              }}>
              <Icon name="mic" /> Start placement chat
            </button>
          </div>
        ) : (
          <div className="stack">
            <div className="field">
              <label className="field-label" htmlFor="focus">
                Today's grammar focus
              </label>
              <select id="focus" value={focus} onChange={(e) => setFocus(e.target.value)}>
                {HINDI_SKILLS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {profile.skills[s.id]?.score ?? '?'}
                  </option>
                ))}
              </select>
              <p className="hint" lang="hi">
                {focusDef.example}
              </p>
            </div>
            <TopicPicker
              lang="hi"
              track={track}
              topic={topic}
              onTrack={setTrack}
              onTopic={setTopic}
              unlocked={{ general: true, law: tracksOpen, ai: tracksOpen }}
              lockedHint={`Courtroom and AI conversations open at level B1 (grammar ${TRACK_UNLOCK_SCORE}+; you're at ${overall}). You can open them now in Settings.`}
            />
            <button
              type="button"
              className="btn primary big"
              disabled={!hasLlm(settings)}
              onClick={() => {
                unlockAudio()
                go(newTalkUrl('hi', 'practice', { focus, topic: tracksOpen || track === 'general' ? topic : 'surprise' }))
              }}
            >
              <Icon name="mic" /> Talk with Rani
            </button>
          </div>
        )}
      </section>

      <section className="card lang-card">
        <div className="lang-head">
          <div>
            <h2>
              Marathi <span lang="mr">मराठी</span>
            </h2>
            <p className="muted">
              {mrDone === 0 ? 'From zero, one short unit at a time' : `${mrDone} of ${MARATHI_UNITS.length} units done`}
            </p>
          </div>
          {mrDone > 0 && <span className="badge">{mrDone}/{MARATHI_UNITS.length}</span>}
        </div>
        {mrDone > 0 && <ScoreBar score={Math.round((mrDone / MARATHI_UNITS.length) * 100)} />}
        <button type="button" className="btn primary big" onClick={() => go(`/lesson/${mrNext.id}`)}>
          <Icon name="book" /> {mrDone === 0 ? 'Start' : 'Continue with'} Unit {mrNext.no}: <span lang="mr">{mrNext.titleMr}</span>
        </button>
        <button type="button" className="btn ghost" onClick={() => go('/marathi')}>
          All units & free talk
        </button>
      </section>
    </div>
  )
}
