/**
 * The Taleo Journey (/journey): how the platform grew, day by day.
 *
 * One entry per day of development, newest last. `updates` is the number
 * of changes shipped to the live site that day (commits on main, merges
 * left out, by Singapore time). Keep each day short: what changed, and
 * what it means for a family using Taleo.
 *
 * Never put here: prices or anything about what things cost us, the
 * admin's tools or dashboards, model or supplier names, or anything about
 * accounts, security settings or keys.
 *
 * A scheduled task adds each new day's entry at the end of the day.
 */
export interface JourneyDay {
  /** YYYY-MM-DD, Singapore time */
  date: string;
  title: string;
  updates: number;
  /** two to four short points */
  highlights: string[];
  /** pictures of what changed, as it looked that evening (public/journey/):
   *  each caption names what it shows - night mode in night mode, and so
   *  on. Admin pages only ever with everything under their title blurred. */
  shots?: JourneyShot[];
}
export interface JourneyShot {
  src: string;
  caption: string;
  /** a desktop-width picture (else a phone's) */
  wide?: boolean;
  /** a square picture (an icon) */
  square?: boolean;
}

const shot = (day: string, name: string, caption: string, wide = false): JourneyShot => ({ src: `/journey/d${day}-${name}.webp`, caption, ...(wide ? { wide } : {}) });

export const JOURNEY: JourneyDay[] = [
  {
    date: "2026-11-07",
    title: "Taleo is born",
    updates: 33,
    highlights: [
      "Interactive storybooks, painted page by page in a soft country-watercolour style.",
      "A word to tap on every page, with its own little animation and sound.",
      "A public library of stories, sign-in with Google, ratings and friendly character avatars.",
      "The maple-leaf whirl that became Taleo's brand mark.",
    ],
    shots: [shot("07", "home", "The very first home page"), shot("07", "reader", "A storybook page, with a word to tap"), shot("07", "library", "The first public library")],
  },
  {
    date: "2026-11-08",
    title: "Feeling like a real book",
    updates: 104,
    highlights: [
      "Your own characters, and stories with up to three heroes.",
      "Page turns you can swipe, read-aloud, and gentle bedtime music.",
      "Night mode, with a hand-inked lantern glowing over the page.",
      "An About page: why Taleo exists.",
    ],
    shots: [shot("08", "reader-night", "Night mode in the storybook, with music and read-aloud"), shot("08", "create", "Setting up a story: who is it for?"), shot("08", "about", "The About page: why I made Taleo")],
  },
  {
    date: "2026-11-09",
    title: "Ready for bedtime",
    updates: 155,
    highlights: [
      "Night mode across the whole site, with a lantern and fireflies.",
      "Every story opens as a cloth-bound book cover.",
      "Words light up as they're read aloud, and a new level for young readers (6+).",
      "Your own characters get a page of their own, and anyone can read the library.",
    ],
    shots: [shot("09", "home-night", "Night mode across the whole site"), shot("09", "cover", "Every story opens as a book cover"), shot("09", "characters", "My characters")],
  },
  {
    date: "2026-11-10",
    title: "A home for every family",
    updates: 92,
    highlights: [
      "A personal home page with a reading chart and a diary of bedtimes together.",
      "Save other families' stories to your own bookshelf, and a story of the day in the library.",
      "Make a character from a photo, and rearrange your characters by dragging.",
      "Pictures arrive much sooner: the scenery and the characters are painted at the same time.",
    ],
    shots: [shot("10", "home-signed-in", "Your own home page, with a reading chart"), shot("10", "bookshelf", "My bookshelf"), shot("10", "admin", "Behind the scenes: the owner's dashboard (costs hidden)", true)],
  },
  {
    date: "2026-11-11",
    title: "Built to last",
    updates: 86,
    highlights: [
      "A free story every week, and credits for making more.",
      "Account records kept privately, a plain-words privacy page, and deleting an account removes everything.",
      "A new home-screen icon, and day or night chosen by the clock.",
      "Read-aloud reworked to start sooner and sound more natural.",
    ],
    shots: [shot("11", "plans", "Plan and credits: a free story every week"), shot("11", "privacy", "A plain-words privacy page"), { ...shot("11", "icon", "The new home-screen icon"), square: true }, shot("11", "activity", "Behind the scenes: a log of what's made (costs hidden)", true)],
  },
  {
    date: "2026-11-12",
    title: "How far shall we go tonight?",
    updates: 92,
    highlights: [
      "Choose a story's length: a Quest, an Adventure or an Odyssey, on a little picture slider.",
      "Longer, more generous stories, with more pages at every age.",
      "Secure card payments for credits, through Stripe.",
      "A starry night sky on bigger screens, and faster pages everywhere.",
    ],
    shots: [shot("12", "length", "Choosing a story's length"), shot("12", "night-sky", "A starry night sky on bigger screens", true), shot("12", "credits", "Credits, and what each thing takes")],
  },
  {
    date: "2026-11-13",
    title: "Plans, and painting smarter",
    updates: 32,
    highlights: [
      "Plus and Pro plans for families who read every night, and a clear page on pricing.",
      "Smoother home page, story set-up and page turns; the first page's picture is ready sooner.",
      "Behind the scenes: trying new ways of painting that reuse characters and places, for quicker pictures.",
    ],
    shots: [shot("13", "pricing", "A clear page on pricing and the plans"), shot("13", "bench", "Behind the scenes: testing new ways to paint (costs hidden)", true)],
  },
  {
    date: "2026-11-14",
    title: "Taleo improves itself: pictures, speed and stories",
    updates: 49,
    highlights: [
      "Behind the scenes: recursive self-improvement. With three goals - better pictures, quicker and smoother pictures, and clearer stories - Taleo wrote and painted test books, measured every result against where it started, and kept only the changes that helped.",
      "Better pictures: each page shows what it's about, giants look giant, friends come along together, and characters sit, wave, ride and get tucked into bed naturally.",
      "Quicker and smoother on phones: the next page is ready the moment you turn, picture and words together; pictures are sharp; the first picture paints from the first seconds, and a story keeps going if you leave the app.",
      "Clearer stories, especially for the youngest: one simple plot, told in order, that a parent can read aloud without a second look. Four test books are in the library to read.",
    ],
    shots: [shot("14", "painter-rsi", "Before and after: one giant, at her size, instead of three", true), shot("14", "painter-live", "Before and after: a cat ten times the hero's size, now drawn that way", true)],
  },
];
