# Noomi ✿

Interactive watercolour picture-book stories that parents create **with** their little ones (ages 1½ – 6).

1. **Set the age**: 1½–2, 2–3, 3–4, 4–5 or 5–6. Sentence length, vocabulary, number of pages, number of choices and options all adapt.
2. **Pick a hero**: 16 preset characters (animals, food, objects), or type / dictate your own. Claude designs the custom character in the same cute pastel style.
3. **Pick a theme**: friends, adventure, a mission, family, bedtime… or a one-line idea of your own (typed or spoken).
4. **Read and decide together**: Claude writes a 3–5 minute story in segments. At each decision point the child picks an option or offers their own idea. Ideas that don't fit get a playful narrator aside ("Oh, you want Pip to drive a fire truck? Pip's paws can't reach the pedals!") and the story is steered back on track.
5. **Save, rate, revisit, share**: finished stories live in *My stories* with star ratings. Share links carry the whole story, so no account or server storage is needed.

Every page is fully illustrated. Pages can be read aloud (browser text-to-speech), turned by swipe or arrow keys, and laid out as a phone/tablet portrait page or a desktop/landscape two-page spread.

## How the pictures work

The look is classic English country watercolour: fine sepia pen line, soft earthy washes, and naturalistic animals. Pictures fade into the page like vignette plates. Type is set in IM Fell English and EB Garamond.

**Claude paints every page.** When it writes the story, Claude also art-directs it:
- A `world` note sets the place, season, light and palette for the whole book.
- Each page gets a `picture` brief for one dynamic moment: who is doing what with their whole body, their expression, the camera angle and the composition.

A second call (`/api/illustrate`, `src/server/claude.ts → paintPage`) then paints that moment as layered SVG and streams it to the browser. You can watch each page paint in. The page being read is painted first, and up to three pages paint at a time (`src/lib/usePaintings.ts`).

**Consistent characters.** Every character has a model sheet: a description with exact hex colours, plus a reference painting in a neutral pose. Presets are in `src/lib/art/presetArt.ts`; custom heroes are designed by Claude in the same format. The illustrator re-poses each character but keeps their colours, markings and proportions.

**The paint box.** Claude paints flat shapes in layer groups (`class="wash" | "paint" | "ink" | "detail"`). The app supplies the medium through shared SVG filters (`src/components/art/PaintDefs.tsx`): bleeding washes, mottled pigment with pooled edges, wobbly pen line, paper grain and a vignette.

**Safety.** All painted SVG goes through a whitelist sanitizer (`src/lib/svg-sanitize.ts`) when saved and again when shown, because shared links are untrusted. Only plain shapes survive, and layer classes map to the app's own filters.

**Fallback.** If a painting fails, the page offers "Paint this page again". In the meantime, and in demo mode, a simple composer (`src/lib/art/compose.ts`) builds a picture from the reference art.

## Tap-to-learn moments

Every page is built around one action or event (Claude fills `action` for each page: the key `word`, the tap `target`, a `sound` and a `motion`; see `src/lib/actions.ts`).
- **In the picture:** the illustrator wraps the target character or object in `<g class="target">`. The app gives it a small hop every few seconds as a hint.
- **On tap:** tapping it (or the underlined word in the text) plays the animation and a matching sound effect, and pops up and speaks the word.
- **Why:** children connect the word, the picture and the sound.
- **Animations grow with age** (`motionForAge` in `src/lib/actions.ts`). Each motion belongs to a family (travel, jump, up, turn, size, down, shake); the reader's age picks a gentler or bolder version and scales how far it moves. A toddler's car wiggles; a five-year-old's car zooms off the page and back. Ages 3+ also get a burst of painted sparkles.
- **Sound effects** are synthesised in the browser with the Web Audio API (`src/lib/sfx.ts`), so there are no audio files.
- **Animation code** is in `InteractivePainting` (`src/components/art/Painting.tsx`).

## Running it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without an `ANTHROPIC_API_KEY` the app runs in **demo mode**: a templated storyteller (`src/server/mock.ts`) so the whole flow can be tried offline.

| Env var | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Server-side only; never sent to the browser |
| `TALEO_MODEL` | `claude-opus-5-5` | |
| `TALEO_EFFORT` | `low` | Story writing effort |
| `TALEO_ART_MODEL` | same as `TALEO_MODEL` | Model that paints the pages (e.g. `claude-sonnet-5-5` to paint faster and cheaper) |
| `TALEO_ART_EFFORT` | `low` | Painting effort |
| `RESEND_API_KEY` | – | Emails "Contact us" messages (via [Resend](https://resend.com)). Without it, messages are still saved under `contact/` in storage |
| `CONTACT_EMAIL` | `taleostories.dev@gmail.com` | Where "Contact us" messages go |
| `CONTACT_FROM` | `Noomi <onboarding@resend.dev>` | Sender. The default only delivers to the address that owns the Resend account, so sign up to Resend with `CONTACT_EMAIL` (or verify a domain in Resend and use an address on it) |
| `ELEVENLABS_API_KEY` | – | Neural read-aloud voice via ElevenLabs (most natural; default voice "Lily", warm British). Used first if set |
| `OPENAI_API_KEY` | – | Neural read-aloud voice via OpenAI `gpt-4o-mini-tts` (cheapest; calm British tone set by instruction) |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` | – / `uksouth` | Neural read-aloud voice via Azure AI Speech |
| `TTS_VOICE` | per provider | ElevenLabs voice id (default Lily `pFZP5JQG7iQjIQuC4Bku`), OpenAI voice name (default `sage`), or Azure voice (default `en-GB-SoniaNeural`). Without any voice key, the browser's best British female voice is used. Each phrase is generated once and cached |

## Architecture

- **Next.js (App Router) + TypeScript**, plain CSS (`app/globals.css`).
- `app/api/story`: writes one segment per call (opening, continuation after a choice, or the ending). Uses structured outputs (`src/server/schemas.ts`) so responses are always valid JSON, plus server-side refusal fallbacks. Output is clamped and normalised in `src/server/claude.ts`.
- `app/api/illustrate`: streams one painted page as SVG.
- `app/api/character`: designs a custom hero (model sheet plus reference painting).
- Prompts are in `src/server/prompts.ts`; age guidance is in `src/lib/ages.ts`.
- Stories, paintings included, are stored in `localStorage` (`src/lib/storage.ts`). That's roughly 5 MB, enough for a few dozen books. Share links are lz-string-compressed into the URL fragment (`src/lib/share.ts`) and carry the paintings, so they run to roughly 20–40 KB.

## Ideas for next steps

- Accounts and cloud sync, plus short share links (needs a database).
- Rate limiting on the API routes before going public.
- Narration with natural voices; PDF / print export.
- Recurring characters ("Pip's friends remember last week's adventure").
