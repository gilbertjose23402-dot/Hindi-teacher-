import { useEffect, useState } from 'react'
import type { Lang } from '../db'
import { listGeminiModels, listGroqModels, pickGeminiModel, pickGroqChatModel, pickWhisperModel } from '../lib/llm'
import { LANG_NAME, loadVoices, speak, ttsAvailable, voicesFor } from '../lib/speech'
import { saveSettings, type Settings } from '../lib/store'
import { Spinner } from './ui'

type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; msg?: string; models?: string[] }

function KeyField({
  label,
  value,
  onSave,
  onTest,
  test,
  placeholder,
}: {
  label: string
  value: string
  onSave: (v: string) => void
  onTest: (v: string) => void
  test: TestState
  placeholder: string
}) {
  const [draft, setDraft] = useState(value)
  const [show, setShow] = useState(false)
  useEffect(() => setDraft(value), [value])
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="key-row">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value.trim())}
          onBlur={() => draft !== value && onSave(draft)}
        />
        <button type="button" className="btn ghost small" onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          className="btn small"
          disabled={!draft || test.status === 'testing'}
          onClick={() => {
            if (draft !== value) onSave(draft)
            onTest(draft)
          }}
        >
          Test
        </button>
      </div>
      {test.status === 'testing' && <Spinner label="Checking…" />}
      {test.status === 'ok' && <p className="ok-text">✓ {test.msg}</p>}
      {test.status === 'error' && <p className="error-text">{test.msg}</p>}
    </div>
  )
}

export function KeySetup({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const [gem, setGem] = useState<TestState>({ status: 'idle' })
  const [groq, setGroq] = useState<TestState>({ status: 'idle' })

  const testGemini = async (key: string) => {
    setGem({ status: 'testing' })
    try {
      const models = await listGeminiModels(key)
      const pick = models.includes(settings.geminiModel) ? settings.geminiModel : pickGeminiModel(models)
      if (pick) await saveSettings({ geminiModel: pick })
      setGem({ status: 'ok', msg: `Key works. Using ${pick}.`, models })
    } catch (e) {
      setGem({ status: 'error', msg: (e as Error).message })
    }
  }
  const testGroq = async (key: string) => {
    setGroq({ status: 'testing' })
    try {
      const models = await listGroqModels(key)
      const chat = models.includes(settings.groqModel) ? settings.groqModel : pickGroqChatModel(models)
      const whisper = models.includes(settings.whisperModel) ? settings.whisperModel : pickWhisperModel(models)
      await saveSettings({ ...(chat ? { groqModel: chat } : {}), whisperModel: whisper })
      setGroq({ status: 'ok', msg: `Key works. Speech: ${whisper}. Backup AI: ${chat ?? 'none'}.`, models })
    } catch (e) {
      setGroq({ status: 'error', msg: (e as Error).message })
    }
  }

  return (
    <div className="stack">
      {!compact && (
        <ol className="steps">
          <li>
            <strong>Google Gemini key</strong> — Rani's brain. Open{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
            , sign in with Google, tap <em>Create API key</em>, copy it and paste below.
          </li>
          <li>
            <strong>Groq key</strong> — fast, accurate speech recognition (and a backup brain). Open{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              console.groq.com/keys
            </a>
            , sign up, tap <em>Create API Key</em>, copy and paste below.
          </li>
        </ol>
      )}
      <KeyField
        label="Gemini API key"
        value={settings.geminiKey}
        placeholder="AIza…"
        onSave={(v) => saveSettings({ geminiKey: v })}
        onTest={testGemini}
        test={gem}
      />
      {gem.models && gem.models.length > 0 && (
        <ModelSelect label="Gemini model" value={settings.geminiModel} models={gem.models} onChange={(m) => saveSettings({ geminiModel: m })} />
      )}
      <KeyField
        label="Groq API key"
        value={settings.groqKey}
        placeholder="gsk_…"
        onSave={(v) => saveSettings({ groqKey: v })}
        onTest={testGroq}
        test={groq}
      />
      {groq.models && groq.models.length > 0 && (
        <>
          <ModelSelect
            label="Groq chat model (backup brain)"
            value={settings.groqModel}
            models={groq.models.filter((m) => !/whisper|tts|guard|playai|orpheus/i.test(m))}
            onChange={(m) => saveSettings({ groqModel: m })}
          />
          <ModelSelect
            label="Speech recognition model"
            value={settings.whisperModel}
            models={groq.models.filter((m) => /whisper/i.test(m))}
            onChange={(m) => saveSettings({ whisperModel: m })}
          />
        </>
      )}
      <p className="hint">Keys are stored only on this phone and sent only to Google / Groq.</p>
    </div>
  )
}

function ModelSelect({ label, value, models, onChange }: { label: string; value: string; models: string[]; onChange: (m: string) => void }) {
  const list = models.includes(value) ? models : [value, ...models]
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {list.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}

const SAMPLE: Record<Lang, string> = {
  hi: 'नमस्ते! मैं रानी हूँ। चलिए, आज हिंदी में बात करते हैं।',
  mr: 'नमस्कार! मी राणी. चला, आज मराठीत बोलूया.',
}

export function VoiceSetup({ settings, langs = ['hi', 'mr'] }: { settings: Settings; langs?: Lang[] }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    loadVoices().then(setVoices)
  }, [])
  if (!ttsAvailable()) return <p className="error-text">This browser has no text-to-speech. Use Chrome on Android.</p>
  return (
    <div className="stack">
      {langs.map((lang) => {
        const list = voicesFor(lang, voices)
        const key = lang === 'hi' ? 'voiceHi' : 'voiceMr'
        return (
          <div className="field" key={lang}>
            <label className="field-label">Rani's {LANG_NAME[lang]} voice</label>
            {list.length === 0 ? (
              <p className="hint">
                No {LANG_NAME[lang]} voice found on this phone. Install it: phone <em>Settings → System → Languages → Text-to-speech output →</em> gear icon
                next to <em>Speech Services by Google</em> → <em>Install voice data</em> → {LANG_NAME[lang]} (India) → pick a female voice. Then reopen
                Rani.
              </p>
            ) : (
              <div className="key-row">
                <select value={settings[key]} onChange={(e) => saveSettings({ [key]: e.target.value })}>
                  <option value="">Automatic</option>
                  {list.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn small" onClick={() => speak(SAMPLE[lang], lang, settings)}>
                  Test
                </button>
              </div>
            )}
          </div>
        )
      })}
      <div className="field">
        <label className="field-label">Speaking speed: {settings.speechRate.toFixed(2)}×</label>
        <input
          type="range"
          min={0.6}
          max={1.3}
          step={0.05}
          value={settings.speechRate}
          onChange={(e) => saveSettings({ speechRate: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
