import { useEffect, useRef, useState } from 'react'
import { Icon, Spinner } from '../components/ui'
import { MARATHI_UNITS, UNIT_BY_ID, phraseFor, unitUnlocked } from '../content/marathi'
import { hasLlm } from '../lib/llm'
import { newTalkUrl } from '../lib/nav'
import { go } from '../lib/router'
import { speak, stopSpeaking, unlockAudio } from '../lib/speech'
import { useProfile, type Settings } from '../lib/store'
import { addCardsUnique, unitCards } from '../lib/tutor'

/** One Marathi unit: key phrases with audio, the grammar point, then practice with Rani. */
export default function Lesson({ settings, unitId }: { settings: Settings; unitId: string }) {
  const profile = useProfile('mr')
  const unit = UNIT_BY_ID[unitId] ?? MARATHI_UNITS[0]
  const [showRoman, setShowRoman] = useState(true)
  const [playing, setPlaying] = useState<number | 'all' | null>(null)
  const [saved, setSaved] = useState<string>('')
  const stopAll = useRef(false)
  useEffect(
    () => () => {
      stopAll.current = true
      stopSpeaking()
    },
    [],
  )

  if (!profile) return null
  const progress = profile.units?.[unit.id]
  const open = unitUnlocked(unit, profile.units, settings.unlockAllUnits)
  const phrases = unit.phrases.map((p) => phraseFor(p, settings.learnerGender, settings.learnerName))

  const play = async (i: number) => {
    unlockAudio()
    setPlaying(i)
    await speak(phrases[i].mr, 'mr', settings)
    setPlaying((p) => (p === i ? null : p))
  }

  const playAll = async () => {
    unlockAudio()
    if (playing === 'all') {
      stopAll.current = true
      stopSpeaking()
      setPlaying(null)
      return
    }
    stopAll.current = false
    setPlaying('all')
    for (const p of phrases) {
      if (stopAll.current) return
      await speak(p.mr, 'mr', settings)
      if (stopAll.current) return
      await new Promise((r) => setTimeout(r, 500))
    }
    setPlaying(null)
  }

  const saveCards = async () => {
    const n = await addCardsUnique(unitCards(unit, settings))
    setSaved(n ? `Saved ${n} phrases to your flashcards.` : 'These phrases are already in your flashcards.')
  }

  return (
    <div className="screen lesson">
      <header className="sub-head">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => go('/marathi')}>
          <Icon name="back" />
        </button>
        <div>
          <p className="muted small">
            Unit {unit.no} of {MARATHI_UNITS.length}
          </p>
          <h1 lang="mr">{unit.titleMr}</h1>
        </div>
      </header>

      <section className="card stack">
        <h2>{unit.title}</h2>
        <p>{unit.goal}</p>
        {progress && (
          <p className={progress.completed ? 'ok-text' : 'muted'}>
            {progress.completed ? '✓ Completed' : 'In progress'} · best score {progress.bestScore} · {progress.attempts} practice
            {progress.attempts === 1 ? '' : 's'}
          </p>
        )}
      </section>

      {!open ? (
        <section className="card stack">
          <p>
            <Icon name="lock" size={16} /> Finish Unit {unit.no - 1} first — or open all units in Settings.
          </p>
          <button type="button" className="btn" onClick={() => go(`/lesson/${MARATHI_UNITS[unit.no - 2].id}`)}>
            Go to Unit {unit.no - 1}
          </button>
        </section>
      ) : (
        <>
          <section className="card stack">
            <div className="lang-head">
              <h2>Key phrases</h2>
              <div className="button-row">
                <button type="button" className="btn small ghost" aria-pressed={showRoman} onClick={() => setShowRoman(!showRoman)}>
                  Aa
                </button>
                <button type="button" className="btn small" onClick={() => void playAll()}>
                  <Icon name={playing === 'all' ? 'stop' : 'speaker'} size={16} /> {playing === 'all' ? 'Stop' : 'Listen to all'}
                </button>
              </div>
            </div>
            <ul className="phrase-list">
              {phrases.map((p, i) => (
                <li key={i}>
                  <div className="phrase-main">
                    <p className="phrase-mr" lang="mr">
                      {p.mr}
                    </p>
                    {showRoman && <p className="roman">{p.roman}</p>}
                    <p className="phrase-en">{p.en}</p>
                    <p className="phrase-hi muted" lang="hi">
                      Hindi: {p.hi}
                    </p>
                  </div>
                  <button type="button" className="icon-btn" aria-label={`Hear: ${p.mr}`} onClick={() => void play(i)}>
                    {playing === i ? <Spinner /> : <Icon name="speaker" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack">
            <h2>{unit.grammar.title}</h2>
            <ul className="grammar-points">
              {unit.grammar.points.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
            <p className="bridge">
              <strong>From Hindi:</strong> {unit.hindiBridge}
            </p>
            {unit.malayalam && (
              <p className="tip">
                <strong>Malayalam</strong> {unit.malayalam}
              </p>
            )}
          </section>

          <section className="card stack">
            <h2>Practise with Rani</h2>
            <p className="muted">{unit.scenario}</p>
            <button
              type="button"
              className="btn primary big"
              disabled={!hasLlm(settings)}
              onClick={() => {
                unlockAudio()
                stopSpeaking()
                go(newTalkUrl('mr', 'lesson', { unit: unit.id, topic: 'lesson' }))
              }}
            >
              <Icon name="mic" /> Start the lesson conversation
            </button>
            <p className="hint">About 8 short answers. Rani speaks simple Marathi and corrects you gently; finishing with 50+ opens the next unit.</p>
            <button type="button" className="link-btn" onClick={() => void saveCards()}>
              Save these phrases as flashcards
            </button>
            {saved && <p className="ok-text">{saved}</p>}
          </section>
        </>
      )}
    </div>
  )
}
