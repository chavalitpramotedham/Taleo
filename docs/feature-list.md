# Taleo: weak points & feature list

A review of the app, written to be worked through and prioritised together.
Effort: **S** = an hour or two · **M** = half a day to a day · **L** = several days.
Status: ✅ done · 🟡 partly done · ⬜ not started. Last updated 9 Nov 2026.

---

## P0: Protect and stabilise

| # | Item | Status | Notes | Effort |
|---|------|--------|-------|--------|
| 1 | **Lock down the AI endpoints.** | ✅ | Sign-in required for story, painting, character and voice requests. Limits: one new story per 30 minutes (admin exempt), plus anti-abuse caps. Signed-out readers can only voice a published story's exact sentences. Unfinished paid work stops when the reader leaves. | - |
| 2 | **Stories only live in the browser.** | ✅ | Unfinished stories are saved to the account, with a Resume/Discard prompt on any device (a local copy is kept for speed). | - |
| 3 | **No error monitoring or analytics.** | 🟡 | Server and browser errors now email an alert. Still to do: privacy-friendly usage stats, and logging what each story costs (see [roadmap.md](roadmap.md)). | S |
| 4 | **No moderation in the public library.** | ⬜ | Add a "Report" button on stories and comments, and an admin review queue. | S–M |
| 5 | **Neural voice and contact email.** | 🟡 | The OpenAI voice is on (`/api/tts` reports enabled). Email works, but goes through Resend's shared test sender. Verify `taleo-stories.app` in Resend and set `CONTACT_FROM`. 3 early messages were saved but never emailed. | config |
| 6 | **Storage budget.** | ✅ | Storage reads cost nothing (no `list()` per read), the session re-reads the profile at most every 10 minutes, rate-limit counters live in memory, and the plan is Pro. | - |
| 7 | **Custom domain.** | 🟡 | `taleo-stories.app` is live, and sign-in tolerates a missing `https://`. Still to do: set `AUTH_URL` to `https://taleo-stories.app`, add the domain in Google (origins, redirect URI, authorized domains), and redirect `taleo-stories.vercel.app` to it. | config |

## P1: Core experience

| # | Item | Status | Notes | Effort |
|---|------|--------|-------|--------|
| 8 | **Shorten the wait while a story is written and painted.** | 🟡 | Text now streams page by page, the reader can start on page 1 straight away, and pictures paint in the background with a "Painting…" loader. Next: a faster/cheaper painting model or effort setting. | M |
| 9 | **"Words we learnt" recap at the end.** | ⬜ | The story's words to learn, each with its picture and tap-to-hear. Makes the educational value visible to parents. | S |
| 10 | **Read-along highlighting.** | ✅ | Each word lights up as the voice reads it, timed from the audio itself. | - |
| 11 | **Continue where you left off.** | ⬜ | A "Continue reading" spot on the homepage and bookshelf for half-finished stories. | S |
| 12 | **Sequels from saved characters.** | ⬜ | "Another adventure with Pip & Mo", using the stories each character has already been in. That record already exists. | M |
| 13 | **Library discovery.** | 🟡 | Sort by favourites or newest, filter by category, author bookshelves, and a preview sheet. Next: filter by age, search, "more like this", and loading in batches. | M |
| 14 | **Try before signing in.** | ⬜ | First-time visitors must sign in before they can try anything. Offer a short sample story with no account needed. | M |
| 15 | **Bedtime extras.** | 🟡 | Site-wide night mode with lantern and fireflies, and the music dips under the voice. Next: a sleep timer that fades the music out, night mode turning on automatically in the evening, and a softer "wind-down" ending. | S |
| 16 | **Characters that stay true.** | ✅ | Optional male/female per custom character, family notes about relationships, and the storyteller and painter told to keep both exactly right. Worth spot-checking in real stories. | - |

## P2: Delight and growth

| # | Item | Status | Notes | Effort |
|---|------|--------|-------|--------|
| 17 | **Child profiles.** | ⬜ | Several children per account, each with their age, their own bookshelf and the words they've learnt. | L |
| 18 | **Parent view.** | ⬜ | Stories read, words learnt and reading streaks. | M |
| 19 | **Print or download the book.** | ⬜ | A finished story as a PDF, or later as a printed hardback. | M–L |
| 20 | **Narration in a parent's own voice.** | ⬜ | Record a voice once and have stories read in it (ElevenLabs voice cloning). | L |
| 21 | **Bilingual stories.** | ⬜ | The word to learn shown in a second language. | M |
| 22 | **Offline reading.** | ⬜ | Saved stories readable without a connection, through the app's existing web-app setup. | M |
| 23 | **Notifications.** | ⬜ | An email when someone rates your story, and an optional weekly round-up. | S |
| 24 | **Accessibility pass.** | ⬜ | Screen-reader descriptions for the paintings, focus order, a text-size control and a dyslexia-friendly font option. | S–M |

## Quality and tech debt

- ⬜ **No automated tests.** Add browser smoke tests for setup → read → rate → share, run on mock data with no real story generation. (M)
- ⬜ **Old share links** (`/store/<id>`) skip the welcome popup. Only links shared from now on get it. (S, if wanted)
- ⬜ **Two story-card versions.** The bookshelf and the library each have their own card code. Merge them so they can't drift apart. (S)
- ✅ **Caching.** The library list is cached at the edge for a minute, shared story pages are cached and rebuilt at most every 5 minutes, and preview images daily.
- ✅ **Mobile performance.** Painted edges come from a pre-drawn mask, heavy work is staged (painting animation, night effects), page turns use GPU-only animation, and the tab icon dropped from 189KB to 7KB.
- ⬜ **Contact admin page.** List every contact message, including ones that failed to email. (S)
