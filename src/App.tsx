import { useEffect } from 'react'
import { Icon } from './components/ui'
import type { Lang } from './db'
import { go, useRoute } from './lib/router'
import { HINDI_SKILLS } from './lib/skills'
import { loadVoices } from './lib/speech'
import { closeStaleSessions, useSettings } from './lib/store'
import Conversation from './screens/Conversation'
import Home from './screens/Home'
import Onboarding from './screens/Onboarding'
import Progress from './screens/Progress'
import Recap from './screens/Recap'
import Settings from './screens/Settings'

const TABS = [
  { path: '', label: 'Home', icon: 'home' },
  { path: 'progress', label: 'Progress', icon: 'chart' },
  { path: 'settings', label: 'Settings', icon: 'gear' },
]

export default function App() {
  const settings = useSettings()
  const route = useRoute()

  useEffect(() => {
    void closeStaleSessions()
    void loadVoices()
  }, [])

  if (!settings) return <div className="splash" aria-busy="true" />
  if (!settings.onboarded) return <Onboarding settings={settings} />

  const [screen = '', ...rest] = route.path

  if (screen === 'talk') {
    const lang: Lang = rest[0] === 'mr' ? 'mr' : 'hi'
    const kind = rest[1] === 'placement' ? 'placement' : 'practice'
    const focusParam = route.query.get('focus')
    const focus = HINDI_SKILLS.some((s) => s.id === focusParam) ? focusParam : HINDI_SKILLS[0].id
    // key forces a fresh conversation for every visit
    return (
      <Conversation
        key={location.hash}
        settings={settings}
        lang={lang}
        kind={kind}
        focus={focus}
        topic={route.query.get('topic') ?? 'surprise'}
      />
    )
  }
  if (screen === 'recap') return <Recap id={Number(rest[0])} />

  return (
    <div className="app">
      {screen === 'progress' ? <Progress settings={settings} /> : screen === 'settings' ? <Settings settings={settings} /> : <Home settings={settings} />}
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.path}
            type="button"
            className={screen === t.path ? 'on' : ''}
            aria-current={screen === t.path ? 'page' : undefined}
            onClick={() => go('/' + t.path)}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
