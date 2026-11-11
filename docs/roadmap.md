# Taleo: what's next

A review of the whole app as it stands (9 Nov 2026), with ideas grouped by
goal, and a catalogue of what a paid version needs. Companion to
[feature-list.md](feature-list.md), which tracks smaller fixes.

Effort: **S** = an hour or two · **M** = half a day to a day · **L** = several days · **XL** = a week or more.

---

## 1. Where the app is today

**Strong already**
- A real storybook feel: a cover that opens, page turns, painted edges, night mode with a lantern and fireflies, music, and read-aloud with a moving word highlight.
- Children shape the story through choices. Parents can save their own characters (with gender and family notes) and reuse them.
- Words, pictures and choices stream in, so waits feel shorter.
- Social basics: a public library, ratings and comments, share links with a welcome popup, and author bookshelves with category filters.
- Running costs are guarded: sign-in is required for paid work, there are per-user rate limits, work stops when the reader leaves, and storage operations are kept off hot paths.

**Gaps that matter most for a public launch**

| Area | Gap | Why it matters |
|---|---|---|
| Cost visibility | We don't record what each story actually costs (tokens per story, painting and voice). | No safe price for credits or tiers without it. |
| Data store | Everything lives in Blob JSON files (users, ratings, library index). | Fine for now, but credits, payments and counters need a real database with atomic updates. |
| First visit | A visitor must sign in before trying anything. | The biggest drop-off in any funnel. |
| Moderation | There's no Report button, and no review of public stories or comments. | Required before strangers can post. Children are the audience. |
| Children's privacy | No privacy policy or terms, and no statement on children's data. | Required by app stores, Stripe and the law (COPPA / UK and EU children's rules). |
| Return visits | Nothing brings a family back: no "continue", no series, no reminders. | Retention is what makes a subscription work. |
| Analytics | We can't see how many people start, finish, share or come back. | Needed to judge every idea below. |

---

## 2. Ideas: delight for children and parents

**At bedtime**

| Idea | What it is | Effort |
|---|---|---|
| Sleep timer and wind-down | The music fades out after the last page, the screen dims, and an optional "the end, goodnight" closing line is read slowly. Night mode turns on by itself in the evening. | S |
| Read-to-me mode | Hands-free: the voice reads each page, waits, then turns the page by itself. At a choice it reads both options aloud, and the child answers with a tap or their voice. | M |
| Voice choices | Answer the story's question out loud ("the cave!"). Dictation already exists. | S–M |
| Calm stories | A "settle down" story type: slower pace, softer pictures, ends asleep. | S |

**Learning, made visible to parents**

| Idea | What it is | Effort |
|---|---|---|
| Words we learnt | A recap at the end of each story: each word with its picture and tap-to-hear. A growing personal word list. | S |
| Child profiles | Several children per account, each with their name, age, favourite characters and word list. Stories are aimed at that child automatically. | L |
| Parent view | A weekly picture of each child: stories read, words met, minutes, favourite themes. | M |
| Reading levels that grow | Suggests moving up an age level when stories are finished easily. | M |

**More magic per story**

| Idea | What it is | Effort |
|---|---|---|
| Sequels and series | "Another adventure with Pip and Bobo" carries on from the last story's ending. Characters already remember the stories they were in. | M |
| Your child as the hero | Describe your child, or later use a photo turned into a painted character (sensitive: keep it private by default). | M / L |
| Seasonal and occasion stories | Birthdays (name and age), the first day of school, a new sibling, a trip, a visit to the dentist. Parents value these highly. | S each |
| Gentle animation | Small motions on the finished painting: leaves drifting, eyes blinking, water rippling. | M |
| Sound effects | A soft splash or rustle on tap-target words. | S–M |
| Colouring page | Any painting as line art, to print and colour. | S |

**Keepsakes** (these are also natural paid add-ons)
- Download a finished story as a PDF. (M)
- A printed hardback, through a print-on-demand partner such as Lulu or Peecho. (L)
- A personalised dedication page ("For Mia, who is brave"). (S)

---

## 3. Ideas: discovery and sharing

**Finding stories**
- Search, plus filters for age, length and theme, alongside the category filter just added. (M)
- Collections chosen by the team: "Bedtime favourites", "Brave little heroes", "Stories about feelings". (S)
- "More like this" under each story's ending and preview. (M)
- A featured story of the week on the homepage. (S)
- Trending: favourites from the last 7 days, not all time, so new stories can rise. (S)

**Authors and community**
- Follow an author: their new stories show up in a "From people you follow" shelf, with optional email. (M)
- Author profile extras: a short bio, total favourites and a "top storyteller" badge. (S)
- Remix: start a new story with the same characters or setting as a library story, credited back to it. This is the main growth loop. (M)
- Reactions children can give (a sticker or heart) without typing a comment. (S)
- Collections that families make and share ("Our camping stories"). (M)

**Sharing outward**
- Author pages and collections get their own link previews: a collage of covers. Story links already show the cover painting. (S)
- A short video of the opening pages for Instagram or TikTok, made in the browser. (L)
- Grandparent mode: a read-only link with no sign-in, read-aloud on and big buttons. (S)
- Gift a story: "I made this story for your child". (S, and a natural paid feature)

**Safety, required before growth**
- Report on stories and comments, an admin queue, and auto-hide after N reports. (S–M)
- Before a story becomes public, a quick moderation check (a cheap model) of its text and title. (S)
- Private by default for stories featuring real children's names or photos. (S)
- Publishing becomes a choice: "share to the library" as an explicit step, with a note on what's public. (S)

---

## 4. Freemium: what it costs us, and how to charge

### 4.1 Where the money goes

| Work | When | Today's setting | Relative cost |
|---|---|---|---|
| Story text (streamed, per part) | 2–4 parts per story | Opus 5.5, low effort | Medium |
| Page paintings (SVG) | ~8–20 per story | Opus 5.5, low effort (lighter right after a choice) | **Highest**: long outputs, with the character reference sent each time |
| Custom character | Once per character | Opus 5.5, high effort, 45–105 shapes | High, but rare |
| Neural voice (OpenAI) | Per sentence, cached | Only when enabled | Low–medium |
| Storage and bandwidth | Ongoing | Vercel Blob Pro | Low |

**Step zero: measure before pricing.** Log each AI request's model, input and
output tokens, and the user and story it was for (the response's `usage`). Add
them up per story. Then a credit can be priced at a real margin rather than a
guess. Effort: S, plus a database (see 4.5).

**Ways to reduce cost without hurting quality:**
- Cache the system prompts. They're already marked for caching; check the cache-hit rate.
- Use a smaller or faster model for paintings and test the quality. Paintings are where the money goes.
- Paint fewer pages for free users: pictures on key pages only, or simpler paintings.
- Reuse paintings across readers. Library stories are already painted once; make sure no reader path repaints them.
- Use batch processing for work that isn't urgent, such as back-filling or moderation checks.

### 4.2 Pricing model options

| Model | How it works | Good for | Watch out for |
|---|---|---|---|
| **A. Credits only** | Buy packs (e.g. 10 stories). One credit = one new story; a custom character costs extra. | Simple, fair and tied directly to cost. | No recurring revenue; parents dislike counting. |
| **B. Subscription with a monthly allowance** | Free: e.g. 3 new stories a month and reading the whole library. Plus: e.g. 30 stories a month, more characters, PDF and voice. | Predictable revenue, and it matches a bedtime habit. | Heavy users can cost more than they pay, so cap the allowance. |
| **C. Hybrid (recommended)** | Free tier plus a subscription with an allowance, and top-up credit packs when the allowance runs out. Keepsakes (PDF, print, gifts) sold separately. | Covers light, regular and heavy users; one-off buyers aren't forced to subscribe. | More states to handle, though it's the industry norm. |

**Suggested starting tiers** (placeholders until costs are measured):

| | Free | Plus (monthly or yearly) |
|---|---|---|
| Read the public library | Unlimited | Unlimited |
| New stories | 3 a month, shorter (≤5 min) | e.g. 30 a month, any length |
| Paintings | Every page (or key pages only) | Every page, richer detail |
| Custom characters | 2 saved | 8 saved (today's limit), high-effort design |
| Neural read-aloud | Device voice | Neural voice with the word highlight |
| Child profiles | 1 | Up to 4 |
| PDF download | No | Yes |
| Top-up credits | Can buy | Discounted |
| Print and gifts | Paid separately | Paid separately, member price |

A yearly plan at about 2 months free is standard. A 7-day free trial of Plus
converts better than a permanently free tier with the same limits.

**Free-tier details that protect costs:**
- An allowance resets monthly and isn't carried over. Credits from packs don't expire, or last 12 months.
- A failed or abandoned story gives the credit back automatically. The app already stops the work when the reader leaves, so refund it then.
- Only a finished, kept story uses a credit. That's friendlier, and as long as the stop-on-leave logic holds it's about the same cost.
- Library reading stays free forever: it costs almost nothing and it's the top of the funnel.

### 4.3 Payment platforms

| Option | Fits | Pros | Cons |
|---|---|---|---|
| **Stripe Billing + Checkout + Customer Portal** | The web app (now) | Most flexible; subscriptions, one-off packs and coupons; a hosted checkout and self-serve portal mean no card forms to build; webhooks are excellent. | We handle sales tax/VAT (Stripe Tax helps, ~0.5%) and are the seller of record. |
| **Paddle or Lemon Squeezy** (merchant of record) | The web app, small team | They handle global VAT and sales tax, invoices and refunds as the seller. | Higher fees (~5% + fees); less flexible. |
| **Apple App Store / Google Play in-app purchases** | Only if we ship native apps | Required for digital goods inside iOS and Android apps; trusted one-tap payment. | 15–30% fee; separate receipts to verify; the entitlement must sync with web purchases. |
| **RevenueCat** | If we go native | One entitlement system across Stripe, Apple and Google; handles receipts and webhooks. | Another vendor; most useful once there are multiple stores. |

**Recommendation:** start with **Stripe** on the web (Checkout plus the
Customer Portal). If tax handling becomes painful, switch to Paddle. Add
RevenueCat only if and when a native app ships. Keep payments off the iOS
web-app flow where Apple's rules would apply.

### 4.4 What a paid version needs (checklist)

**Accounts and entitlements**
- [ ] A **database** with transactions (Postgres via Neon or Supabase, from the Vercel Marketplace). Blob JSON can't safely do "use one credit" when two requests race.
- [x] **Account records out of the public file store.** Profiles (email, plan, admin and suspended flags), usage counts, saved characters, bookshelves, reading diaries and Contact-us messages are kept in Redis, one record per account, each changed only if it is still what was read (`src/server/private-store.ts`, `src/server/users.ts`). Redis was chosen over waiting for Postgres because it is already connected and already holds the billing records; the move to Postgres, if it comes, is a copy of `user:*`. Still in the public store: published stories, ratings and comments, voice clips (all public anyway), unfinished stories (too large for Redis; under an unguessable name) and Contact-us attachments (under a random name).
- [ ] Tables: `users` (moved from Blob), `subscriptions` (Stripe customer and subscription ids, plan, status, current period end), `credit_ledger` (+/− entries with a reason and story id; the balance is the sum), `usage_events` (tokens and cost per AI request), `entitlements` (computed per request from plan + balance).
- [ ] An `entitlements(user)` server helper used by `/api/story`, `/api/illustrate`, `/api/character` and `/api/tts`. It replaces or extends today's `guard()`.
- [ ] **Hold → confirm/release** credits: hold one when a story starts, confirm it when the story finishes or is kept, release it on failure or abandonment.
- [ ] Keep the anti-abuse rate limits alongside the credits (per IP and per account).

**Payments**
- [ ] Products and prices in Stripe: Plus monthly and yearly, credit packs (e.g. 10 and 30), and later PDF and print.
- [ ] `/api/billing/checkout` creates a Checkout Session for the plan or pack.
- [ ] `/api/billing/portal` creates a Customer Portal session (upgrade, cancel, change card, invoices).
- [ ] `/api/billing/webhook` checks the signature, handles each event once, and covers `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`/`deleted`, `charge.refunded` and `invoice.payment_failed`, plus the monthly allowance top-up on renewal.
- [ ] Test mode first, with Stripe's test cards and the Stripe CLI forwarding webhooks to localhost.
- [ ] Tax: turn on Stripe Tax, or use a merchant of record.

**Product and UX**
- [ ] A **pricing page** (plain comparison, yearly saving, the trial).
- [ ] A **usage display**: "2 of 3 free stories left this month", in the menu or account page and on the story setup page.
- [ ] **Gentle paywalls** at natural moments: when the allowance runs out, when choosing a long story, when saving a 3rd character, at PDF download. Never in the middle of a story.
- [ ] A finished story is never locked: what you made stays readable forever.
- [ ] Receipts and plan status on the account page; a reminder email before a renewal or the end of a trial.
- [ ] A "grown-ups only" check before purchases (e.g. hold a button, or a simple sum), since children use the device.

**Legal and trust**
- [ ] Terms of service, privacy policy and refund policy pages.
- [ ] A children's privacy statement: the account holder is the parent, children's data is minimal, and photos and real names are private by default.
- [ ] Explain how stories are made by AI, and how public stories are moderated.
- [ ] Data export and account deletion (partly there: account deletion exists).
- [ ] Cookie consent, only if non-essential analytics are added.

**Operations**
- [ ] A cost dashboard: spend per day, per user and per story, plus alerts above a daily limit (alert emails exist already).
- [ ] An admin view: users, plan, credits, manual grant or refund, reported content.
- [ ] Error handling for payments: a failed renewal moves the account to Free after a grace period, and nothing is ever deleted.

---

## 5. Suggested order

1. **Measure and protect** (≈1 week): token and cost logging, a database, Report and moderation, Terms, Privacy, basic analytics.
2. **Hook new visitors** (≈1 week): a sample story without signing in, "Words we learnt", the sleep timer, team-picked collections.
3. **Bring families back** (≈2 weeks): child profiles, sequels and series, "Continue reading", collections and search.
4. **Charge** (≈1–2 weeks): Stripe Checkout and Portal, credits with hold/confirm, the pricing page, usage display, paywall moments.
5. **Grow** (ongoing): remix, following authors, gift a story, PDF and print, an occasion story pack.

Steps 1 and 4 share the database and the cost logging, so building those
early makes paid plans a short step later rather than a rebuild.
