# Taleo: weak points & feature list

A review of the app as it stands, written to be worked through and prioritised together.
Effort: **S** = an hour or two · **M** = half a day to a day · **L** = several days.

---

## P0: Protect and stabilise (do first)

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 1 | **Lock down the AI endpoints.** `/api/story`, `/api/illustrate`, `/api/character` and `/api/tts` don't check sign-in and have no rate limits. | Anyone who finds them can spend your Claude and voice credits. Add sign-in checks where readers don't need them, per-user daily limits, and limit TTS to text that's in a real story. | S–M |
| 2 | **Stories only live in the browser.** Drafts and the bookshelf are in `localStorage`. | They're lost on another device or when browser data is cleared, and the device eventually fills up with paintings ("storage is full"). Save them to the account, keeping a local copy for speed. | M |
| 3 | **No error monitoring or analytics.** | We can't see failures (like the email and voice issues) or how people use the app. Add error reporting and privacy-friendly usage stats. | S |
| 4 | **No moderation in the public library.** There's no way to report a story or comment. | User-written stories and comments are public. Add a "Report" button and an admin review queue. | S–M |
| 5 | **Turn on the neural voice and confirm email.** | Add `ELEVENLABS_API_KEY` or `OPENAI_API_KEY` in Vercel, and confirm Resend delivered the two test messages. | config |

## P1: Core experience

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 6 | **Shorten the wait while a story is written and painted.** | This is the biggest moment of friction. Show per-page painting progress, let the child read the words while pictures finish, and use a faster model for paintings. | M |
| 7 | **"Words we learnt" recap at the end.** | The story's words to learn, each with its picture and tap-to-hear. It builds on the new word rules and makes the educational value visible to parents. | S |
| 8 | **Read-along highlighting.** | Each word lights up as the voice reads it, which is a big help for early readers. ElevenLabs returns word timings that make this precise. | M |
| 9 | **Continue where you left off.** | A "Continue reading" spot on the homepage and bookshelf for half-finished stories. | S |
| 10 | **Sequels from saved characters.** | "Another adventure with Pip & Mo" uses the stories each character has already been in ("last week they…"). That record already exists. | M |
| 11 | **Library discovery.** | Filter by age and theme, search, "more like this", and loading in batches (today it loads every story at once). | M |
| 12 | **Try before signing in.** | First-time visitors must sign in before they can try anything. Offer a short sample story with no account needed. | M |
| 13 | **Bedtime extras.** | A sleep timer that fades the music out, night mode turning on automatically in the evening, and a softer "wind-down" ending option. | S |

## P2: Delight and growth

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| 14 | **Child profiles.** | Several children per account, each with their age saved, their own bookshelf and the words they've learnt. | L |
| 15 | **Parent view.** | Stories read, words learnt and reading streaks. | M |
| 16 | **Print or download the book.** | A finished story as a PDF, or later as a printed hardback. | M–L |
| 17 | **Narration in a parent's own voice.** | Record a voice once and have stories read in it. | L |
| 18 | **Bilingual stories.** | The word to learn shown in a second language. | M |
| 19 | **Offline reading.** | Saved stories readable without a connection, through the app's existing web-app setup. | M |
| 20 | **Notifications.** | An email when someone rates your story, and an optional weekly round-up. | S |
| 21 | **Accessibility pass.** | Screen-reader descriptions for the paintings, focus order, a text-size control and a dyslexia-friendly font option. | S–M |

## Quality and tech debt

- **No automated tests.** Add browser smoke tests for setup → read → rate → share, run on mock data with no real story generation. (M)
- **Old share links** (`/store/<id>`) skip the new welcome popup. Only links shared from now on get it. (S, if wanted)
- **Two story-card versions.** The bookshelf and the library each have their own card code. Merge them so they can't drift apart. (S)
- **Homepage caching.** The homepage is rebuilt for every visit now that share links pass through it. Cache the library shelf. (S)
