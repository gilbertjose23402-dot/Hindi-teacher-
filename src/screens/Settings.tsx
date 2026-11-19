import { useRef, useState } from 'react'
import { KeySetup, VoiceSetup } from '../components/Setup'
import { Segmented, Toggle } from '../components/ui'
import { downloadBlob, exportBackup, importBackup, wipeAll } from '../lib/backup'
import { dayKey } from '../lib/dates'
import { browserRecognitionAvailable } from '../lib/speech'
import { saveSettings, type Settings as S } from '../lib/store'

export default function Settings({ settings }: { settings: S }) {
  const [includeKeys, setIncludeKeys] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    downloadBlob(await exportBackup(includeKeys), `rani-backup-${dayKey()}.json`)
    setMsg('Backup downloaded. Keep it somewhere safe (e.g. Google Drive).')
  }

  const doImport = async (f: File | undefined) => {
    if (!f) return
    if (!confirm('Restore this backup? Everything currently in the app will be replaced.')) return
    try {
      await importBackup(f)
      setMsg('Backup restored.')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <div className="screen">
      <header className="sub-head">
        <h1>Settings</h1>
      </header>

      <section className="card stack">
        <h2>About you</h2>
        <div className="field">
          <label className="field-label" htmlFor="s-name">
            Name
          </label>
          <input id="s-name" value={settings.learnerName} onChange={(e) => saveSettings({ learnerName: e.target.value })} />
        </div>
        <div className="field">
          <span className="field-label">Your verb forms</span>
          <Segmented
            label="Grammatical gender"
            value={settings.learnerGender}
            onChange={(v) => saveSettings({ learnerGender: v })}
            options={[
              { value: 'm', label: 'मैं गया (masc.)' },
              { value: 'f', label: 'मैं गई (fem.)' },
            ]}
          />
        </div>
        <div className="field">
          <span className="field-label">Daily goal</span>
          <Segmented
            label="Daily goal"
            value={settings.dailyGoalMin}
            onChange={(v) => saveSettings({ dailyGoalMin: v })}
            options={[10, 15, 20, 30, 45].map((g) => ({ value: g, label: `${g}m` }))}
          />
        </div>
      </section>

      <section className="card stack">
        <h2>AI keys &amp; models</h2>
        <KeySetup settings={settings} compact />
        <div className="field">
          <span className="field-label">Rani's main brain</span>
          <Segmented
            label="Main AI"
            value={settings.llmPrimary}
            onChange={(v) => saveSettings({ llmPrimary: v })}
            options={[
              { value: 'gemini', label: 'Gemini' },
              { value: 'groq', label: 'Groq' },
            ]}
          />
          <p className="hint">If the main one hits its free limit, Rani automatically switches to the other (when its key is set).</p>
        </div>
        <div className="field">
          <span className="field-label">Speech recognition</span>
          <Segmented
            label="Speech recognition"
            value={settings.sttEngine}
            onChange={(v) => saveSettings({ sttEngine: v })}
            options={[
              { value: 'gemini', label: 'Gemini' },
              { value: 'groq', label: 'Groq' },
              ...(browserRecognitionAvailable() ? [{ value: 'browser' as const, label: 'Phone' }] : []),
            ]}
          />
          <p className="hint">
            Gemini (default) writes down exactly what you said, mistakes included. Groq needs the optional key. "Phone" uses Android's built-in
            recogniser, which tends to auto-correct your grammar and hide mistakes.
          </p>
        </div>
      </section>

      <section className="card stack">
        <h2>Voice &amp; conversation</h2>
        <VoiceSetup settings={settings} />
        <Toggle checked={settings.autoSpeak} onChange={(v) => saveSettings({ autoSpeak: v })} label="Rani speaks her replies aloud" />
        <Toggle
          checked={settings.showRomanDefault}
          onChange={(v) => saveSettings({ showRomanDefault: v })}
          label="Show romanised text by default"
          hint="You can always tap Aa / EN on a message."
        />
      </section>

      <section className="card stack">
        <h2>Backup</h2>
        <p className="hint">Your progress lives only on this phone. Download a backup now and then.</p>
        <Toggle checked={includeKeys} onChange={setIncludeKeys} label="Include API keys in the backup" />
        <div className="button-row">
          <button type="button" className="btn" onClick={doExport}>
            Download backup
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        </div>
        {msg && <p className="ok-text">{msg}</p>}
      </section>

      <section className="card stack">
        <h2>Danger zone</h2>
        <button
          type="button"
          className="btn danger"
          onClick={() => confirm('Delete ALL progress, sessions and keys from this phone? This cannot be undone.') && wipeAll()}
        >
          Delete all data
        </button>
      </section>

      <p className="hint center-text">Rani v{__APP_VERSION__} · milestone 1</p>
    </div>
  )
}
