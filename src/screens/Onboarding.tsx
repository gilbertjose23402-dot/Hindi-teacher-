import { useState } from 'react'
import { BrainSetup, KeySetup, VoiceSetup } from '../components/Setup'
import { Segmented } from '../components/ui'
import { hasLlm } from '../lib/llm'
import { saveSettings, type Settings } from '../lib/store'

const GOALS = [10, 15, 20, 30]

export default function Onboarding({ settings }: { settings: Settings }) {
  const [step, setStep] = useState(0)
  const [mic, setMic] = useState<'idle' | 'ok' | 'denied'>('idle')
  const steps = ['Welcome', 'About you', 'Brain', 'Voice', 'Daily goal']

  const finish = async () => {
    await navigator.storage?.persist?.().catch(() => false)
    await saveSettings({ onboarded: true })
    location.hash = '#/'
  }

  const testMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach((t) => t.stop())
      setMic('ok')
    } catch {
      setMic('denied')
    }
  }

  const canNext = step !== 1 || settings.learnerName.trim().length > 0

  return (
    <div className="onboarding">
      <div className="progress-dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <section className="stack center-text">
          <div className="avatar big" aria-hidden>
            रा
          </div>
          <h1>Hi, I'm Rani</h1>
          <p className="lead">नमस्ते! I'm your Hindi &amp; Marathi conversation partner.</p>
          <p>
            Talk to me every day like a friend. I'll keep the conversation going, quietly fix your grammar, remember what you've learned, and track
            your practice time.
          </p>
          <p className="hint">No account needed: I listen and speak using your phone, and my AI brain runs on your phone after a one-time download.</p>
        </section>
      )}

      {step === 1 && (
        <section className="stack">
          <h2>About you</h2>
          <div className="field">
            <label className="field-label" htmlFor="name">
              What should Rani call you?
            </label>
            <input id="name" value={settings.learnerName} onChange={(e) => saveSettings({ learnerName: e.target.value })} placeholder="Your name" />
          </div>
          <div className="field">
            <span className="field-label">Which verb forms should Rani expect when you talk about yourself?</span>
            <p className="hint">
              Hindi verbs change with the speaker's gender — <span lang="hi">मैं गया</span> (masculine) vs <span lang="hi">मैं गई</span> (feminine).
              Malayalam doesn't do this, which is why it's easy to slip.
            </p>
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
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <h2>Rani's brain</h2>
          <p>Rani's AI runs right on your phone — no account, no sign-up. Pick a model and download it once.</p>
          <BrainSetup settings={settings} />
          <details className="optional">
            <summary>Optional: use Google Gemini instead</summary>
            <KeySetup settings={settings} />
          </details>
          {!hasLlm(settings) && <p className="hint">You can skip this for now and set up the brain later in Settings.</p>}
        </section>
      )}

      {step === 3 && (
        <section className="stack">
          <h2>Voice &amp; microphone</h2>
          <VoiceSetup settings={settings} />
          <div className="field">
            <span className="field-label">Microphone</span>
            <button type="button" className="btn" onClick={testMic}>
              Allow microphone
            </button>
            {mic === 'ok' && <p className="ok-text">✓ Microphone ready</p>}
            {mic === 'denied' && <p className="error-text">Microphone blocked. Allow it in Chrome's site settings for this app.</p>}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="stack">
          <h2>Daily goal</h2>
          <p>How many minutes of conversation per day? Only active talking time counts.</p>
          <Segmented
            label="Daily goal"
            value={settings.dailyGoalMin}
            onChange={(v) => saveSettings({ dailyGoalMin: v })}
            options={GOALS.map((g) => ({ value: g, label: `${g} min` }))}
          />
          <p className="hint">
            Your first conversation is a relaxed 10-minute placement chat so Rani can find your level. Tip: in Chrome, use the menu → <em>Add to Home
            screen</em> to install Rani as an app.
          </p>
        </section>
      )}

      <div className="onboarding-nav">
        {step > 0 ? (
          <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < steps.length - 1 ? (
          <button type="button" className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={finish}>
            Start learning
          </button>
        )}
      </div>
    </div>
  )
}
