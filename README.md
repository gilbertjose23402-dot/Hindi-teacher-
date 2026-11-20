# Rani — Hindi & Marathi conversation tutor

A phone app (installable PWA) you talk to every day to improve your Hindi grammar — and, from the next milestone, learn Marathi from zero.
Rani listens, replies in natural spoken Hindi, quietly corrects your sentences, remembers your progress and tracks your practice time.

## What's in milestone 1

- **Placement chat** (~10 min): Rani assesses 17 Hindi grammar skills and your listening, then gives you a level (A1–C1) and a skills map.
- **Daily conversation**: pick a topic; Rani steers the conversation towards your weakest grammar point (or one you choose).
- **Corrections without interruptions**: Rani keeps talking and recasts the right form; under each of your messages a card shows
  what you said → the correct sentence (with audio), a one-line rule in English and, when useful, a comparison with Malayalam.
- **Memory**: per-skill scores update after every message; after each session Rani writes a recap, updates her notes about you,
  and saves the sentence patterns you got wrong as flashcards (review screen arrives in milestone 2).
- **Time tracker**: counts only *active* conversation time (pauses over 90 s don't count). Daily goal ring, streak, 7-day chart, all-time total.
- **Listening mode** (eye icon) hides Rani's text so you practise listening; tap **Aa** for romanisation and **EN** for translation.
- Type instead of talking (keyboard icon), Hinglish welcome.
- Everything is stored **only on your phone** (IndexedDB). Download/restore a backup file from Settings.

Coming in milestone 2: Marathi mode (structured beginner lessons → conversation), flashcard review, courtroom/criminal-law
and AI conversation tracks (unlock at level B1).

## How it works — no account needed

Everything runs on your phone by default:

| Step | Default (no sign-up) | Optional upgrade |
|---|---|---|
| Speech → text | Android's built-in speech recognition (Chrome) | Gemini or Groq Whisper — keeps your words exactly as spoken |
| Tutor brain | **On-phone AI**: a Gemma model running inside Chrome (WebGPU, via WebLLM). One-time download, then works with no account | Gemini (faster, much more accurate corrections) or Groq |
| Text → speech | Android's Hindi/Marathi voice | Gemini voices |

**Phone's built-in AI:** if Chrome on your phone exposes its built-in model (Gemini Nano, via Chrome's Prompt API), Rani
detects it in setup and can use it with no download. Native on-device AI such as AICore or Moto AI is only open to Play Store
apps, not web apps, so on phones where Chrome doesn't offer it Rani uses a downloaded model instead.

On-phone models offered for download (recommended one is picked from your phone's RAM):

| Model | Download | Notes |
|---|---|---|
| Gemma 4 E2B | ~3 GB | Best Hindi; needs a recent phone with 8 GB+ RAM |
| Gemma 2 2B | ~1.5 GB | Lighter, weaker Hindi grammar |
| Gemma 3 1B | ~0.7 GB | Fastest; corrections often wrong |

Honest expectations: on a phone, replies take roughly 10–40 s, and small models make grammar mistakes of their own.
A free Gemini key (Settings → *Optional cloud AI*) gives replies in a few seconds and far more reliable corrections.
If the main brain fails, Rani automatically tries any other brain you've set up.

### ⚡ Fast mode (Gemini for everything)

With a Gemini key, **Settings → Rani's brain → ⚡ Use Gemini for everything** turns on fast mode:

- Your recording goes straight to Gemini, which writes down exactly what you said (mistakes kept), corrects it and
  replies — **one call** instead of separate listening and thinking calls.
- The answer is streamed: your words appear first, and Rani starts speaking as soon as her reply is written.
- Gemini runs with "thinking" turned down, and the voice uses Gemini 3.8 Flash-Lite TTS (built for real-time).
- Two Gemini calls per turn (hear+answer, voice). The on-phone model stays as an automatic backup.

Typical delay from the end of your sentence to Rani's voice: about 2–3 s (depends on your connection).

## Setup on your phone

1. Open the app link in **Chrome on Android**: `https://gilbertjose23402-dot.github.io/Hindi-teacher-/`
2. Chrome menu (⋮) → **Add to Home screen** → Install.
3. In setup, pick an on-phone model and tap **Download** (use Wi-Fi, keep the app open). Tap **Test** afterwards to see how
   fast it answers on your phone.
4. For Rani's voice: phone **Settings → System → Languages → Text-to-speech output →** ⚙ next to
   *Speech Services by Google* → *Install voice data* → **Hindi (India)** (later **Marathi**) → choose a female voice.

## Deploying (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` builds and publishes the app on every push.
One-time setup: make the repository **public**, then **Settings → Pages → Build and deployment → Source: GitHub Actions**,
then re-run the latest workflow from the **Actions** tab.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (vitest)
npm run build    # production build into dist/
```

Code map:

- `src/lib/prompts.ts` — Rani's persona, correction rules, placement plan, JSON schemas
- `src/lib/tutor.ts` — turn handling, recap, placement assessment, memory updates
- `src/lib/skills.ts` — the Hindi grammar skill catalogue, scoring and focus selection
- `src/lib/builtin.ts` — the phone's built-in AI through Chrome (Prompt API / Gemini Nano), when available
- `src/lib/local.ts`, `src/lib/brain.worker.ts` — on-phone AI (WebLLM): model choice, download, KV-cache-friendly prompting
- `src/lib/llm.ts` — brain routing and fallback, Gemini/Groq calls, model discovery, transcription, Gemini speech
- `src/lib/speech.ts` — recording, speech recognition routing, Gemini voice playback with phone-voice fallback
- `src/lib/store.ts`, `src/db.ts` — settings, learner profile, time log (IndexedDB via Dexie)
- `src/screens/*` — Onboarding, Home, Conversation, Recap, Progress, Settings
