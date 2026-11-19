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
import {
  LOCAL_MODELS,
  checkWebGpu,
  deleteModel,
  isModelDownloaded,
  loadBrain,
  localJson,
  recommendedModel,
  resolveModelId,
  useBrainProgress,
  type GpuStatus,
  type LocalModel,
} from '../lib/local'
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
        <p className="hint">
          A free Gemini key makes Rani faster and her grammar corrections more accurate. Open{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>
          , sign in with your Google account, tap <em>Create API key</em>, and paste it below.
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
            <label className="field-label">Phone voice — {LANG_NAME[lang]}</label>
            {list.length === 0 ? (
              <p className="hint">
                No {LANG_NAME[lang]} voice found yet. To install: <em>Settings → System → Languages → Text-to-speech output →</em> ⚙ next to{' '}
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
      {settings.geminiKey && (
      <div className="field">
        <span className="field-label">Rani speaks with</span>
        <Segmented
          label="Voice engine"
          value={settings.ttsEngine}
          onChange={(v) => saveSettings({ ttsEngine: v })}
          options={[
            { value: 'browser', label: 'Phone voice' },
            { value: 'gemini', label: 'Gemini voice' },
          ]}
        />
      </div>
      )}
      {settings.ttsEngine === 'gemini' && settings.geminiKey && (
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

/** Choose, download, test and delete Rani's on-phone AI model. */
export function BrainSetup({ settings }: { settings: Settings }) {
  const [gpu, setGpu] = useState<GpuStatus | null>(null)
  const [choice, setChoice] = useState('')
  const [have, setHave] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [test, setTest] = useState('')
  const progress = useBrainProgress()

  const refresh = async (g: GpuStatus) => {
    const entries = await Promise.all(
      LOCAL_MODELS.map(async (m) => {
        const id = resolveModelId(m, g.f16)
        return [m.base, id ? await isModelDownloaded(id) : false] as const
      }),
    )
    setHave(Object.fromEntries(entries))
  }

  useEffect(() => {
    void checkWebGpu().then((g) => {
      setGpu(g)
      if (g.ok) void refresh(g)
    })
  }, [])

  useEffect(() => {
    if (choice) return
    const current = LOCAL_MODELS.find((m) => m.base === settings.localModel || m.f32 === settings.localModel)
    setChoice((current ?? recommendedModel()).base)
  }, [settings.localModel, choice])

  if (!gpu) return <Spinner label="Checking what your phone can run…" />
  if (!gpu.ok) return <p className="error-text">{gpu.reason}</p>

  const models = LOCAL_MODELS.filter((m) => resolveModelId(m, gpu.f16))
  const chosen = models.find((m) => m.base === choice) ?? models[0]
  const chosenId = resolveModelId(chosen, gpu.f16)!
  const active = settings.localModelReady && settings.localModel === chosenId
  const rec = recommendedModel().base

  const download = async () => {
    setBusy(true)
    setErr('')
    setTest('')
    try {
      await navigator.storage?.persist?.().catch(() => false)
      await loadBrain(chosenId)
      await saveSettings({ localModel: chosenId, localModelReady: true, llmPrimary: 'local' })
      await refresh(gpu)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }

  const runTest = async () => {
    setBusy(true)
    setErr('')
    setTest('')
    const t0 = performance.now()
    try {
      const out = await localJson<{ reply: string }>(
        {
          system: 'You are Rani, a friendly Hindi tutor. Reply ONLY with JSON like {"reply": "..."}.',
          messages: [{ role: 'user', text: 'Greet the learner warmly in one short Hindi sentence.' }],
          schema: { type: 'OBJECT', properties: { reply: { type: 'STRING' } }, required: ['reply'] },
          maxTokens: 60,
        },
        chosenId,
      )
      setTest(`“${out.reply}” — answered in ${((performance.now() - t0) / 1000).toFixed(1)} s`)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }

  const remove = async (m: LocalModel) => {
    const id = resolveModelId(m, gpu.f16)!
    if (!confirm(`Delete ${m.label} from this phone?`)) return
    await deleteModel(id)
    if (settings.localModel === id) await saveSettings({ localModelReady: false })
    await refresh(gpu)
  }

  return (
    <div className="stack">
      <div className="model-list" role="radiogroup" aria-label="On-phone AI model">
        {models.map((m) => (
          <label key={m.base} className={'model-option' + (choice === m.base ? ' on' : '')}>
            <input type="radio" name="brain-model" checked={choice === m.base} disabled={busy} onChange={() => setChoice(m.base)} />
            <span className="model-text">
              <span>
                <strong>{m.label}</strong>
                {m.base === rec && <span className="tag">Recommended</span>}
                {have[m.base] && <span className="tag good">On phone</span>}
              </span>
              <small>
                {m.size} · {m.note}
              </small>
            </span>
            {have[m.base] && !busy && (
              <button
                type="button"
                className="link-btn"
                onClick={(e) => {
                  e.preventDefault()
                  void remove(m)
                }}
              >
                Delete
              </button>
            )}
          </label>
        ))}
      </div>
      {progress && (
        <div className="dl" role="status">
          <progress max={1} value={progress.progress} />
          <small className="muted">{progress.text}</small>
        </div>
      )}
      {active ? (
        <div className="button-row center-row">
          <span className="ok-text">✓ {chosen.label} is Rani's brain</span>
          <button type="button" className="btn small" disabled={busy} onClick={runTest}>
            {busy ? <Spinner /> : 'Test'}
          </button>
        </div>
      ) : (
        <button type="button" className="btn primary" disabled={busy} onClick={download}>
          {busy ? <Spinner label="Setting up…" /> : have[chosen.base] ? `Use ${chosen.label}` : `Download ${chosen.label} (${chosen.size})`}
        </button>
      )}
      {test && <p className="ok-text">{test}</p>}
      {err && <p className="error-text">{err}</p>}
      <p className="hint">
        One-time download — use Wi-Fi and keep Rani open until it finishes. After that it works with no account. Loading the brain takes a few
        seconds each time the app starts.
      </p>
    </div>
  )
}
