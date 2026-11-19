import { useEffect, useState } from 'react'
import type { Lang } from '../db'
import {
  geminiChatModels,
  geminiTtsModels,
  listGeminiModels,
  listGroqModels,
  pickGeminiModel,
  pickGeminiTtsModel,
  pickGroqChatModel,
  pickWhisperModel,
} from '../lib/llm'
import { GEMINI_VOICES, LANG_NAME, loadVoices, speak, ttsAvailable, unlockAudio, voicesFor } from '../lib/speech'
import { saveSettings, type Settings } from '../lib/store'
import { Segmented, Spinner } from './ui'

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
          aria-label={label}
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
      const chat = models.includes(settings.geminiModel) ? settings.geminiModel : pickGeminiModel(models)
      const tts = models.includes(settings.geminiTtsModel) ? settings.geminiTtsModel : pickGeminiTtsModel(models)
      await saveSettings({ ...(chat ? { geminiModel: chat } : {}), ...(tts ? { geminiTtsModel: tts } : {}) })
      setGem({ status: 'ok', msg: `Key works. Brain: ${chat}. Voice: ${tts ?? 'not available — phone voice will be used'}.`, models })
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
      setGroq({ status: 'ok', msg: `Key works. Backup speech: ${whisper}. Backup brain: ${chat ?? 'none'}.`, models })
    } catch (e) {
      setGroq({ status: 'error', msg: (e as Error).message })
    }
  }

  return (
    <div className="stack">
      {!compact && (
        <p>
          Rani runs on <strong>Google Gemini</strong> — it listens to you, thinks, and speaks. Open{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>
          , sign in with Google, tap <em>Create API key</em>, copy it and paste it below. It's free.
        </p>
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
        <>
          <ModelSelect label="Gemini model (brain & listening)" value={settings.geminiModel} models={geminiChatModels(gem.models)} onChange={(m) => saveSettings({ geminiModel: m })} />
          {geminiTtsModels(gem.models).length > 0 && (
            <ModelSelect label="Gemini voice model" value={settings.geminiTtsModel} models={geminiTtsModels(gem.models)} onChange={(m) => saveSettings({ geminiTtsModel: m })} />
          )}
        </>
      )}

      <details className="optional" open={compact && !!settings.groqKey}>
        <summary>Optional: Groq backup key</summary>
        <div className="stack">
          <p className="hint">
            Not needed. If you add it, Rani switches to Groq whenever Gemini's free limit is reached. Get one at{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              console.groq.com/keys
            </a>
            .
          </p>
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
                label="Groq speech model (backup listening)"
                value={settings.whisperModel}
                models={groq.models.filter((m) => /whisper/i.test(m))}
                onChange={(m) => saveSettings({ whisperModel: m })}
              />
            </>
          )}
        </div>
      </details>
      <p className="hint">Keys are stored only on this phone and sent only to Google (and Groq, if you add it).</p>
    </div>
  )
}

function ModelSelect({ label, value, models, onChange }: { label: string; value: string; models: string[]; onChange: (m: string) => void }) {
  const list = models.includes(value) ? models : [value, ...models]
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
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

function PhoneVoices({ settings, langs }: { settings: Settings; langs: Lang[] }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    loadVoices().then(setVoices)
  }, [])
  if (!ttsAvailable()) return <p className="hint">This browser has no built-in voices.</p>
  const phoneOnly = { ...settings, ttsEngine: 'browser' as const }
  return (
    <>
      {langs.map((lang) => {
        const list = voicesFor(lang, voices)
        const key = lang === 'hi' ? 'voiceHi' : 'voiceMr'
        return (
          <div className="field" key={lang}>
            <label className="field-label">Backup phone voice — {LANG_NAME[lang]}</label>
            {list.length === 0 ? (
              <p className="hint">
                Optional. No {LANG_NAME[lang]} voice on this phone yet — to install: <em>Settings → System → Languages → Text-to-speech output →</em> ⚙ next to{' '}
                <em>Speech Services by Google</em> → <em>Install voice data</em> → {LANG_NAME[lang]} (India).
              </p>
            ) : (
              <div className="key-row">
                <select value={settings[key]} onChange={(e) => saveSettings({ [key]: e.target.value })} aria-label={`Phone ${LANG_NAME[lang]} voice`}>
                  <option value="">Automatic</option>
                  {list.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn small" onClick={() => speak(SAMPLE[lang], lang, phoneOnly)}>
                  Test
                </button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

export function VoiceSetup({ settings, langs = ['hi', 'mr'] }: { settings: Settings; langs?: Lang[] }) {
  const [testing, setTesting] = useState(false)
  const [note, setNote] = useState('')
  const testGemini = async () => {
    unlockAudio()
    setTesting(true)
    setNote('')
    const n = await speak(SAMPLE.hi, 'hi', settings)
    setTesting(false)
    setNote(n ?? '')
  }
  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">Rani speaks with</span>
        <Segmented
          label="Voice engine"
          value={settings.ttsEngine}
          onChange={(v) => saveSettings({ ttsEngine: v })}
          options={[
            { value: 'gemini', label: 'Gemini voice' },
            { value: 'browser', label: 'Phone voice' },
          ]}
        />
      </div>
      {settings.ttsEngine === 'gemini' && (
        <div className="field">
          <label className="field-label">Rani's Gemini voice</label>
          <div className="key-row">
            <select value={settings.geminiVoice} onChange={(e) => saveSettings({ geminiVoice: e.target.value })} aria-label="Gemini voice">
              {GEMINI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn small" disabled={!settings.geminiKey || testing} onClick={testGemini}>
              {testing ? <Spinner /> : 'Test'}
            </button>
          </div>
          {note && <p className="error-text">{note}</p>}
          <p className="hint">If Gemini's free voice limit runs out, Rani switches to the phone voice below automatically.</p>
        </div>
      )}
      <PhoneVoices settings={settings} langs={langs} />
      <div className="field">
        <label className="field-label">Speaking speed: {settings.speechRate.toFixed(2)}×</label>
        <input
          type="range"
          min={0.6}
          max={1.3}
          step={0.05}
          value={settings.speechRate}
          aria-label="Speaking speed"
          onChange={(e) => saveSettings({ speechRate: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
