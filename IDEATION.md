# Live Transcription TA — ideation (no code yet)

Date: 2026-09-15. Target user: a TA for Entrepreneurship MGMT-UB85 who fills the
"Class Participation Notes" sheet live while the professor runs a case discussion.

## 1. What the sheet actually needs (from the 9/14 PDF)

Per contribution (one row):
| Time | Student | Type (Question / Response / Comment) | What they said (1 neutral line) | Points 1/2/3 | Transcript check / follow-up |

Plus, per class:
- Roster roll-up: for each of ~40 students → #Entries, total Points (pure aggregation of the rows).
- End-of-class note (free text).
- Scoring key: 1 = recitation / one-liner, 2 = correct answer or insightful question,
  3 = moves the whole class forward (2–3 per class).

Observations from the real 9/14 data:
- ~22 rows in ~75 min → one row every ~3 min. Bursty around the TAM showcase (5 rows in 6 min).
- Rows are 5–20 words. The TA is already writing "Prof said 'precisely'" style evidence.
- 2 rows are "Unnamed – black jacket, first row" → the professor does NOT always say the name.
- Same first names collide (two pairs share a first name or last name).
- The sheet header literally says "use the timestamp to match a transcript later" → the
  transcript step is already part of the workflow, just done manually and after the fact.

## 2. Is a native macOS app feasible? Yes.

The LifeTracker iOS app already proves the hard parts on Apple platforms:
- `AudioChunker.swift` is written to compile on macOS (says so in its header).
- `SpeechAnalyzerEngine.swift` (Apple's new on-device long-form ASR, OS 26) and
  `ParakeetEngine.swift` (NVIDIA Parakeet via CoreML) both run on Apple Silicon Macs.
- `TranscriptCleaner.swift` is platform-neutral.

Mac is actually the *easier* platform: no background-audio limits, no App Review,
no Action Button, a real keyboard for the TA, and the app can sit in the menu bar.

### Transcription engine options (on-device only, same principle as LifeTracker)
| Option | Streaming? | Custom vocab (roster names)? | Notes |
|---|---|---|---|
| Apple `SpeechAnalyzer` (macOS 26) | yes, true streaming | verify — need to check API | Best choice if her Mac is on macOS 26. Already have an engine wrapper. |
| `SFSpeechRecognizer` on-device (macOS 13+) | yes, but ~1 min per request → restart loop | **yes, `contextualStrings`** — feed the whole roster | Fallback if she's on older macOS. Name boosting is a real win. |
| Parakeet / WhisperKit in rolling 5–10 s chunks | pseudo-streaming | no | Better general accuracy, but names still mangled; no vocab boost. |

Recommendation: SpeechAnalyzer if macOS 26, else SFSpeechRecognizer with contextualStrings.
Decide after checking her OS version.

## 3. Product concept — "the row appears before she starts typing"

Core loop:
1. App listens all class (AVAudioEngine tap on the Mac mic, or an external mic).
2. Rolling live transcript with wall-clock timestamps, kept locally.
3. **Name spotting**: every recognized phrase is fuzzy-matched against the roster
   (first name, full name, nickname list; phonetic matching — Soundex/Double Metaphone —
   because ASR will butcher the less common names).
4. When a name fires → a **pending row** slides in, pre-filled with Time + Student.
   Ambiguous hits show both candidates; TA picks with one key.
5. TA finishes the row with keyboard only:
   - `Q` / `R` / `C` → contribution type
   - type one line → "What they said"
   - `1` / `2` / `3` → points
   - `Enter` → commit. `Esc` → dismiss false positive.
6. Each row automatically stores the transcript span (T−10 s … T+60 s) → that IS the
   "Transcript check" column. The "match a transcript later" step disappears.

Must-have fallbacks (because the prof doesn't always name people):
- Global hotkey (e.g. ⌘⇧Space) → new row stamped "now", with a type-ahead roster picker.
- "Unnamed" row with a description field ("black jacket, first row"), resolvable later
  from a dropdown — keeps today's habit, just structured.

Roll-up and export:
- Roster roll-up (Entries, Points) computed live; the "3 Week" tab is just a pivot.
- Export: CSV in the exact column order of the sheet, and/or write straight into the
  Google Sheet. The Life Widget project already does Google Sheets sync — reuse that.
- End-of-class note: a text box, exported with the rest.

Optional, later (text-only, never audio):
- LLM drafts the neutral one-liner from the transcript span and *suggests* a 1/2/3
  using the scoring key; TA confirms. Could even be fully local via Apple Foundation
  Models on macOS 26, so nothing leaves the laptop.

## 4. The one thing that decides go / no-go: room acoustics

Everything hinges on the laptop mic hearing the **professor** clearly enough to catch
"George?" / "Iris, go ahead." Students at the back will be inaudible — that's fine,
the TA writes "what they said" herself. But if the prof's name calls don't land in the
transcript, the auto-rows never fire and this degrades to "hotkey + roster picker"
(still useful, but not the magic).

Spike, before writing any app code (costs one class):
1. She records one full class on her laptop with QuickTime / Voice Memos, laptop where
   she normally sits.
2. Run it through the existing LifeTracker pipeline (or just Apple's on-device recognizer)
   offline on a Mac.
3. Count: of the ~20 times the prof said a name, how many appear in the transcript
   (exactly or fuzzy-matchable)? ≥ 70 % → build the name-spotting path. < 40 % →
   build hotkey-first and consider a cheap external mic / placing the laptop near the prof.

## 5. Risks / things to settle with her

- **Consent & policy.** Recording a classroom needs the professor's OK (and check
  Stern/NYU policy). NY is one-party consent legally, but this is the prof's class and
  the students' voices. The prof clearly already has a transcript flow, so this is likely
  fine — but ask explicitly. Audio stays on her Mac, transcription is on-device, audio is
  deleted after export. Same "honest recording" principle as LifeTracker.
- **Her macOS version** → picks the ASR engine.
- **Where the sheet lives** (Google Sheets? Excel?) → picks the export path.
- **What the prof sends her later** (Zoom/Otter transcript?). If it's Zoom, it may be
  higher quality than the laptop mic — the app could import it afterwards to re-verify.
- **Name collisions** → ask for a nickname list from her (what the prof actually calls people).
- **Cognitive load.** The pending row must never steal focus from what she's typing;
  a queue, not a modal.

## 6. Suggested build phases

0. Acoustics spike (one class, no code).
1. Menu-bar app: listen → live transcript → hotkey row → roster picker → Q/R/C, 1/2/3 →
   CSV export. Already saves her real time with zero ML risk.
2. Name spotting → auto-prefilled pending rows.
3. Transcript-span attachment + Google Sheet write + roll-up.
4. LLM one-liner / score suggestion (opt-in).

## 7. What to reuse from LifeTracker

- `Transcription/AudioChunker.swift` (already macOS-compatible)
- `Transcription/SpeechAnalyzerEngine.swift`, `ParakeetEngine.swift`, `TranscriptCleaner.swift`
- Constraints that carry over: on-device only, audio never leaves the machine, no keys in
  the app, honest/visible recording state.
- Not needed on Mac: RecordingEngine's interruption/background policy, Live Activity,
  App Intents.

## 8. Open questions

1. macOS version on her laptop?
2. Has the professor OK'd recording?
3. Google Sheet or Excel? Can we get edit access to write rows directly?
4. Does she want the app to *suggest* points, or only record them?
5. Nickname list for the roster.

## 9. Web app vs native — decision (2026-09-15)

**Go web for v1.** Single static HTML page in Chrome, hosted on GitHub Pages / Vercel
(HTTPS required for mic). She opens a URL; no Xcode, no signing, no installs.

- Transcription: Chrome Web Speech API (`webkitSpeechRecognition`, continuous +
  interimResults). Free, no backend. Must auto-restart on `onend` (Chrome stops after
  ~60 s / silence). Audio goes to Google — confirm that's acceptable to her / the prof.
- Everything else (roster fuzzy-match, pending rows, keyboard flow, transcript spans,
  roll-up, CSV, Sheets write via Apps Script) is the same logic in JS.
- Doubles as the acoustics spike: run it in one class, measure name-hit rate.

**Native only if:** on-device audio becomes a hard requirement, or name-spotting looks
promising but Web Speech mangles roster names (native gets `contextualStrings`).
Middle path if privacy matters but native is too much: Whisper in-browser via WebGPU
(transformers.js) — on-device, ~1–2 s latency, heavier setup.

**Not a Claude artifact:** sandboxed iframe, mic access almost certainly blocked.
5-minute test before ruling it out, but plan to self-host.
