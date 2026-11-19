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

## How it works (free tiers)

Everything runs on **Google Gemini** with one free key:

| Step | Service | Notes |
|---|---|---|
| Speech → text | **Gemini** (audio → verbatim transcript) | Instructed to keep your mistakes exactly as spoken. |
| Tutor brain | **Gemini** (newest Flash model, auto-detected) | Corrections, conversation, recaps, placement scoring. |
| Text → speech | **Gemini voice** (`*-flash-*-tts`, female voices such as Kore, Aoede, Sulafat) | If the free voice limit runs out, Rani switches to the phone's Hindi voice for 10 minutes. |

**Optional:** a free **Groq** key (Settings → *Optional: Groq backup key*) is used automatically when Gemini hits its
free limit — Whisper for listening, a Llama/GPT-OSS model for the brain.

The app calls these APIs directly from your phone with your own key(s). There is no server.

## Setup on your phone

1. Open the app link in **Chrome on Android**: `https://gilbertjose23402-dot.github.io/Hindi-teacher-/`
2. Chrome menu (⋮) → **Add to Home screen** → Install.
3. Get a free Gemini key and paste it in when asked: <https://aistudio.google.com/apikey> → *Create API key*.
   (Optional backup: a Groq key from <https://console.groq.com/keys>.)
4. Pick Rani's Gemini voice and tap **Test**. For the backup phone voice: phone **Settings → System → Languages →
   Text-to-speech output →** ⚙ next to *Speech Services by Google* → *Install voice data* → **Hindi (India)** (later **Marathi**).

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
- `src/lib/llm.ts` — Gemini/Groq calls, fallback, model discovery, transcription, Gemini speech
- `src/lib/speech.ts` — recording, speech recognition routing, Gemini voice playback with phone-voice fallback
- `src/lib/store.ts`, `src/db.ts` — settings, learner profile, time log (IndexedDB via Dexie)
- `src/screens/*` — Onboarding, Home, Conversation, Recap, Progress, Settings
