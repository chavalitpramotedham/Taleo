# Taleo ✿

Interactive watercolour picture-book stories that parents create **with** their little ones (ages 1½ – 6).

1. **Set the age**: 1½–2, 2–3, 3–4, 4–5 or 5–6. Sentence length, vocabulary, number of pages, number of choices and options all adapt.
2. **Pick a hero**: 16 preset characters (animals, food, objects), or type / dictate your own. Claude designs the custom character in the same cute pastel style.
3. **Pick a theme**: friends, adventure, a mission, family, bedtime… or a one-line idea of your own (typed or spoken).
4. **Read and decide together**: Claude writes a 3–5 minute story in segments. At each decision point the child picks an option or offers their own idea. Ideas that don't fit get a playful narrator aside ("Oh, you want Pip to drive a fire truck? Pip's paws can't reach the pedals!") and the story is steered back on track.
5. **Save, rate, revisit, share**: finished stories live in *My stories* with star ratings. Share links carry the whole story, so no account or server storage is needed.

Every page is fully illustrated. Pages can be read aloud (browser text-to-speech), turned by swipe or arrow keys, and laid out as a phone/tablet portrait page or a desktop/landscape two-page spread.

## How the pictures work

Claude doesn't output images. For each page it returns a **scene description**: setting, time of day, weather, which characters stand where with which expression and pose, and which props go where. The browser paints that scene from a hand-built SVG library:

- `src/components/art/presetArt.tsx`: 16 preset characters
- `src/components/art/Face.tsx`: 10 expressions shared by every character, including custom ones
- `src/components/art/propArt.tsx`: 58 props
- `src/components/art/Background.tsx`: 19 settings, plus day/sunset/night and rain/snow/wind/rainbow
- `src/components/art/WatercolorDefs.tsx`: SVG filters for wobbly edges, pigment granulation, pooled edges and paper grain

For custom heroes, new side characters and plot-critical objects missing from the library, Claude draws simple SVG under strict style rules. All model-drawn SVG passes through a whitelist sanitizer (`src/lib/svg-sanitize.ts`) on the server and again in the browser. Shared links are untrusted input.

Because pictures are vectors painted on the device, they render instantly, cost very few tokens, and stay consistent from page to page.

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
| `TALEO_EFFORT` | `low` | `low` keeps the wait short for little ones; `medium`/`high` for richer writing |

## Architecture

- **Next.js (App Router) + TypeScript**, plain CSS (`app/globals.css`).
- `app/api/story`: writes one segment per call (opening, continuation after a choice, or the ending). Uses structured outputs (`src/server/schemas.ts`) so responses are always valid JSON, plus server-side refusal fallbacks. Output is clamped and normalised in `src/server/claude.ts`.
- `app/api/character`: designs a custom hero.
- Prompts are in `src/server/prompts.ts`; age guidance is in `src/lib/ages.ts`.
- Stories are stored in `localStorage` (`src/lib/storage.ts`). Share links are lz-string-compressed into the URL fragment (`src/lib/share.ts`).

## Ideas for next steps

- Accounts and cloud sync, plus short share links (needs a database).
- Rate limiting on the API routes before going public.
- Narration with natural voices; PDF / print export.
- Recurring characters ("Pip's friends remember last week's adventure").
