import { useEffect } from 'react'
import { Icon } from './components/ui'
import type { Lang } from './db'
import { go, useRoute } from './lib/router'
import { skillsFor } from './lib/skills'
import { UNIT_BY_ID } from './content/marathi'
import { loadVoices } from './lib/speech'
import { closeStaleSessions, useSettings } from './lib/store'
import Conversation from './screens/Conversation'
import Home from './screens/Home'
import Onboarding from './screens/Onboarding'
import Progress from './screens/Progress'
import Recap from './screens/Recap'
import Lesson from './screens/Lesson'
import Marathi from './screens/Marathi'
import Review, { useDueCount } from './screens/Review'
import Settings from './screens/Settings'

const TABS = [
  { path: '', label: 'Home', icon: 'home' },
  { path: 'review', label: 'Review', icon: 'cards' },
  { path: 'progress', label: 'Progress', icon: 'chart' },
  { path: 'settings', label: 'Settings', icon: 'gear' },
]

export default function App() {
  const settings = useSettings()
  const route = useRoute()
  const dueCount = useDueCount()

  useEffect(() => {
    void closeStaleSessions()
    void loadVoices()
  }, [])

  if (!settings) return <div className="splash" aria-busy="true" />
  if (!settings.onboarded) return <Onboarding settings={settings} />

  const [screen = '', ...rest] = route.path

  if (screen === 'talk') {
    const lang: Lang = rest[0] === 'mr' ? 'mr' : 'hi'
    const kind = rest[1] === 'placement' ? 'placement' : rest[1] === 'lesson' ? 'lesson' : 'practice'
    const focusParam = route.query.get('focus')
    const catalogue = skillsFor(lang)
    const focus = catalogue.some((s) => s.id === focusParam) ? focusParam : catalogue[0].id
    const topic = route.query.get('topic') ?? (kind === 'lesson' ? 'lesson' : 'surprise')
    const unitParam = route.query.get('unit')
    const unitId = unitParam && UNIT_BY_ID[unitParam] ? unitParam : kind === 'lesson' ? 'u1' : undefined
    const resumeId = Number(route.query.get('s')) || undefined
    // A new key = a new conversation. The saved-session id (?s=) is added to the address once the
    // conversation exists, so it must not change the key — but opening a different saved one must.
    const key = `${lang}/${kind}/${focus}/${topic}/${unitId ?? ''}/${route.query.get('new') ?? ''}/${resumeId && route.query.get('resume') ? resumeId : ''}`
    return (
      <Conversation key={key} settings={settings} lang={lang} kind={kind} focus={focus} topic={topic} unitId={unitId} resumeId={resumeId} />
    )
  }
  if (screen === 'lesson') return <Lesson settings={settings} unitId={rest[0] ?? 'u1'} />
  if (screen === 'recap') return <Recap id={Number(rest[0])} />

  return (
    <div className="app">
      {screen === 'progress' ? (
        <Progress settings={settings} />
      ) : screen === 'settings' ? (
        <Settings settings={settings} />
      ) : screen === 'review' ? (
        <Review settings={settings} />
      ) : screen === 'marathi' ? (
        <Marathi settings={settings} />
      ) : (
        <Home settings={settings} />
      )}
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.path}
            type="button"
            className={screen === t.path ? 'on' : ''}
            aria-current={screen === t.path ? 'page' : undefined}
            onClick={() => go('/' + t.path)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} />
              {t.path === 'review' && dueCount > 0 && <span className="badge-dot">{dueCount > 99 ? '99+' : dueCount}</span>}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
