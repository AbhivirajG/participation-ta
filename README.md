# Participation TA

A single-page web app for filling the class participation sheet live. It listens
to the room through Chrome, spots roster names in the transcript when the
professor calls on someone, and turns each one into a row you finish with a few
keystrokes. Rows sync straight into the Google Sheet.

Files:
- `index.html` — the whole app (no build, no dependencies)
- `apps-script/Code.gs` — the tiny Google Apps Script that writes into the sheet
- `IDEATION.md` — design notes / decisions

---

## For the TA — using it in class

1. Open the link in **Google Chrome** (live transcription only works in Chrome/Edge).
2. Click **Start listening**, allow the microphone. The little bar next to the
   button shows mic level — if it isn't moving when the professor talks, move
   the laptop closer.
3. When the professor says a name, a **yellow card** appears:
   - one name → `Enter` to accept, `Esc` to dismiss
   - two names (two students share a first name) → press `1` or `2`
4. Accepting a card creates a row with the time and student filled in, and
   puts the cursor in **Type**:
   - `Q` / `R` / `C` → Question / Response / Comment (cursor jumps to the note)
   - type the one-line note, `Enter`
   - `1` / `2` / `3` → points (row is done)
5. The professor didn't say the name? Press `N` (or `⌘ Enter` from anywhere)
   for a blank row stamped with the current time. Start typing a name and pick
   from the list, or type free text like `Unnamed – black jacket, first row`.
6. `▸` on a row shows what was transcribed around that moment. That text goes
   into the "Transcript check" column automatically.
7. Right panel: live transcript (roster names highlighted) and the roster with
   entries / points per student. Click the `–` next to a name to mark
   attendance (`1` present → `½` late → `0` absent → blank).
8. **Sync to Sheet** whenever you like (or turn on auto-sync in Settings).
   Rows you edit later re-sync in place; nothing on the sheet is ever deleted.
   **CSV** downloads the same rows if the sync is ever down.

Everything is saved in the browser as you go, per class date. Closing the tab
by accident loses nothing. The **Tab** box is the sheet tab to write into
(defaults to the date, `916` for Sept 16). If that tab doesn't exist yet the
script creates it as a copy of the latest one.

---

## One-time setup

### 1. Host the page (GitHub Pages)

```bash
cd "live transaction ta"
git init && git add -A && git commit -m "Participation TA"
# create an empty repo on github.com (e.g. participation-ta), then:
git remote add origin git@github.com:<you>/participation-ta.git
git push -u origin main
```

On GitHub: repo → **Settings → Pages → Source: Deploy from a branch → main / (root)**.
The page is live at `https://<you>.github.io/participation-ta/` in about a minute.
(Any HTTPS host works — Chrome needs HTTPS for the microphone. `file://` also
works for local testing.)

### 2. Connect the Google Sheet (someone with edit access, ~2 min)

1. Open the sheet → **Extensions → Apps Script**.
2. Delete the placeholder code, paste the contents of `apps-script/Code.gs`, save.
3. **Deploy → New deployment → ⚙ Select type → Web app**
   - Description: anything
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click Deploy, authorize when prompted (it asks for access to this spreadsheet).
5. Copy the **Web app URL** (ends in `/exec`).
6. In the app: **Settings → Google Sheet sync URL**, paste, click **Test** — it
   should say `✓ connected (…)` and list the tabs. Then click **Import roster
   from sheet** (pulls column I of the latest class tab) and **Save**.
   The roster is stored only in that browser — it is deliberately not in this repo.

If you later change `Code.gs`, you must **Deploy → Manage deployments → Edit →
New version** for the change to go live; the URL stays the same.

### What the sync writes

| Where | What |
|---|---|
| `<tab>!A6:F` | Time, Student, Type, What they said, Points, Transcript snippet |
| `<tab>!G` | `App ID` per row — lets the app update a row it already wrote |
| `<tab>!J:K` | `COUNTIF` / `SUMIF` roll-up formulas next to the roster in column I |
| `<tab>!L6` | End-of-class note |
| `<tab>!B2` | Class date (only if empty) |
| `Attendance!<date column>` | 1 / 0.5 / 0 per student you marked |

---

## Settings

- **Roster** — one per line, `First Last | nickname, nickname`. The names the
  professor actually uses matter most (e.g. `Matthew Smith | Matt`).
- **Common-word names** — first names that are also ordinary words (`max`,
  `august`). These only trigger a card at the start or end of a sentence, so
  "the max value" doesn't fire.
- **Cooldown** — same student won't get a second card within N seconds.

## Known limits

- Chrome sends audio to Google for recognition (that's how Web Speech works).
  Keep the professor informed that the class is being transcribed.
- Chrome stops its recognizer every minute or so; the app restarts it
  automatically. You'll see "Restarting…" flicker in the status — that's normal.
- Name recognition depends on the laptop hearing the **professor** clearly.
  Student answers from the back of the room won't transcribe — that's fine,
  the note is yours to write. Watch the mic bar.
- Keep the tab open (it can be in the background, but not closed).
