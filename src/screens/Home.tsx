import { useEffect, useState } from 'react'
import { Icon, Ring, ScoreBar } from '../components/ui'
import { computeStreak, dayKey, formatMinutes, lastNDays, secondsByDay } from '../lib/dates'
import { hasLlm } from '../lib/llm'
import { TOPICS } from '../lib/prompts'
import { go } from '../lib/router'
import { HINDI_SKILLS, LEVEL_LABEL, SKILL_BY_ID, levelFromScore, overallScore, pickFocus } from '../lib/skills'
import { useProfile, useTimeEntries, type Settings } from '../lib/store'

export default function Home({ settings }: { settings: Settings }) {
  const profile = useProfile('hi')
  const time = useTimeEntries()
  const [focus, setFocus] = useState<string>('')
  const [topic, setTopic] = useState('surprise')

  useEffect(() => {
    if (profile && !focus) setFocus(pickFocus(profile.skills, profile.lastFocus))
  }, [profile, focus])

  if (!profile || !time) return null

  const byDay = secondsByDay(time)
  const today = byDay.get(dayKey()) ?? 0
  const week = lastNDays(7).reduce((a, d) => a + (byDay.get(d) ?? 0), 0)
  const streak = computeStreak(time)
  const goal = settings.dailyGoalMin * 60
  const overall = overallScore(profile.skills)
  const level = levelFromScore(overall)
  const focusDef = SKILL_BY_ID[focus] ?? HINDI_SKILLS[0]

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

      {!hasLlm(settings) && (
        <button type="button" className="banner warn" onClick={() => go('/settings')}>
          Add your Gemini API key in Settings to start talking.
        </button>
      )}

      <section className="card today">
        <Ring value={today} max={goal} label={`${Math.floor(today / 60)}`} sub={`of ${settings.dailyGoalMin} min`} />
        <div>
          <h2>Today</h2>
          <p>{today >= goal ? 'Daily goal reached — शाबाश!' : `${Math.max(1, Math.ceil((goal - today) / 60))} min to your daily goal`}</p>
          <p className="muted">This week: {formatMinutes(week)}</p>
        </div>
      </section>

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
            <button type="button" className="btn primary big" disabled={!hasLlm(settings)} onClick={() => go('/talk/hi/placement')}>
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
            <div className="field">
              <span className="field-label">Topic</span>
              <div className="chips">
                {TOPICS.map((t) => (
                  <button key={t.id} type="button" className={'chip' + (topic === t.id ? ' on' : '')} onClick={() => setTopic(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn primary big"
              disabled={!hasLlm(settings)}
              onClick={() => go(`/talk/hi/practice?focus=${focus}&topic=${topic}`)}
            >
              <Icon name="mic" /> Talk with Rani
            </button>
          </div>
        )}
      </section>

      <section className="card lang-card disabled-card">
        <div className="lang-head">
          <div>
            <h2>
              Marathi <span lang="mr">मराठी</span>
            </h2>
            <p className="muted">Structured beginner lessons — arriving in the next update</p>
          </div>
          <Icon name="lock" />
        </div>
      </section>
    </div>
  )
}
