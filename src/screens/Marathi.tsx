import { useEffect, useState } from 'react'
import { TopicPicker } from '../components/TopicPicker'
import { Icon, ScoreBar } from '../components/ui'
import { MARATHI_UNITS, nextUnit, unitUnlocked, unitsCompleted } from '../content/marathi'
import { MARATHI_FREE_TALK_AFTER, type Track } from '../content/topics'
import { hasLlm } from '../lib/llm'
import { newTalkUrl } from '../lib/nav'
import { go } from '../lib/router'
import { SKILL_BY_ID, pickFocus, skillsFor } from '../lib/skills'
import { unlockAudio } from '../lib/speech'
import { useProfile, type Settings } from '../lib/store'

/** Marathi home: the units in order, plus free conversation once the basics are done. */
export default function Marathi({ settings }: { settings: Settings }) {
  const profile = useProfile('mr')
  const [focus, setFocus] = useState('')
  const [track, setTrack] = useState<Track>('general')
  const [topic, setTopic] = useState('daily')

  useEffect(() => {
    if (profile && !focus) setFocus(pickFocus(profile.skills, profile.lastFocus, 'mr'))
  }, [profile, focus])

  if (!profile) return null
  const units = profile.units
  const done = unitsCompleted(units)
  const next = nextUnit(units)
  const freeTalk = settings.unlockAllUnits || done >= MARATHI_FREE_TALK_AFTER
  const courtOpen = settings.unlockAllUnits || !!units?.u14?.completed

  return (
    <div className="screen">
      <header className="sub-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => go('/')}>
          <Icon name="back" />
        </button>
        <h1>
          Marathi <span lang="mr">मराठी</span>
        </h1>
      </header>

      <section className="card stack">
        <div className="lang-head">
          <div>
            <h2>
              {done} of {MARATHI_UNITS.length} units done
            </h2>
            <p className="muted">Short lessons, each with key phrases and a conversation with Rani.</p>
          </div>
        </div>
        <ScoreBar score={Math.round((done / MARATHI_UNITS.length) * 100)} />
        <button type="button" className="btn primary big" onClick={() => go(`/lesson/${next.id}`)}>
          <Icon name="book" /> {done === MARATHI_UNITS.length ? 'Revisit' : 'Next:'} Unit {next.no} — {next.titleMr}
        </button>
      </section>

      <section className="card">
        <h2>Units</h2>
        <ul className="unit-list">
          {MARATHI_UNITS.map((u) => {
            const p = units?.[u.id]
            const open = unitUnlocked(u, units, settings.unlockAllUnits)
            return (
              <li key={u.id}>
                <button type="button" disabled={!open} className={'unit-row' + (u.id === next.id ? ' next' : '')} onClick={() => go(`/lesson/${u.id}`)}>
                  <span className={'unit-no' + (p?.completed ? ' done' : '')}>{p?.completed ? <Icon name="check" size={16} /> : u.no}</span>
                  <span className="unit-text">
                    <strong lang="mr">{u.titleMr}</strong>
                    <small className="muted">{u.title}</small>
                  </span>
                  <span className="unit-status">
                    {!open ? <Icon name="lock" size={16} /> : p ? <small className="muted">best {p.bestScore}</small> : u.id === next.id ? <small>Next</small> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {!settings.unlockAllUnits && <p className="hint">Each unit opens when you finish the one before it (or open them all in Settings).</p>}
      </section>

      <section className="card stack">
        <h2>Free conversation</h2>
        {!freeTalk ? (
          <p className="hint locked-hint">
            <Icon name="lock" size={14} /> Opens after {MARATHI_FREE_TALK_AFTER} units ({done} done so far) — or open everything in Settings.
          </p>
        ) : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="mr-focus">
                Grammar focus
              </label>
              <select id="mr-focus" value={focus} onChange={(e) => setFocus(e.target.value)}>
                {skillsFor('mr').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {profile.skills[s.id]?.score ?? '?'}
                  </option>
                ))}
              </select>
              <p className="hint" lang="mr">
                {SKILL_BY_ID[focus]?.example}
              </p>
            </div>
            <TopicPicker
              lang="mr"
              track={track}
              topic={topic}
              onTrack={setTrack}
              onTopic={setTopic}
              unlocked={{ general: true, law: courtOpen, ai: false }}
              lockedHint="Court Marathi role-plays open after Unit 14 (At the court)."
            />
            <button
              type="button"
              className="btn primary big"
              disabled={!hasLlm(settings)}
              onClick={() => {
                unlockAudio()
                go(newTalkUrl('mr', 'practice', { focus, topic }))
              }}
            >
              <Icon name="mic" /> Talk with Rani in Marathi
            </button>
          </>
        )}
      </section>
    </div>
  )
}
