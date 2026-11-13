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
 * A scheduled task adds each new day's entry at the end of the day (see
 * the commit that added this file).
 */
export interface JourneyDay {
  /** YYYY-MM-DD, Singapore time */
  date: string;
  title: string;
  updates: number;
  /** two to four short points */
  highlights: string[];
  /** optional: a picture of the site as it stood that day (public/journey/) */
  shot?: { src: string; alt: string };
}

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
    shot: { src: "/journey/day-07.webp", alt: "Taleo's home page at the end of its first day" },
  },
  {
    date: "2026-11-08",
    title: "Feeling like a real book",
    updates: 104,
    highlights: [
      "Your own characters, and stories with up to three heroes.",
      "Page turns you can swipe, read-aloud, and gentle bedtime music.",
      "Night mode, with a hand-inked lantern glowing over the page.",
      "The home page painting paints itself, like an illustrator at work.",
    ],
    shot: { src: "/journey/day-08.webp", alt: "Taleo's home page at the end of day two" },
  },
  {
    date: "2026-11-09",
    title: "Ready for bedtime",
    updates: 155,
    highlights: [
      "Every story opens as a cloth-bound book cover.",
      "Words light up as they're read aloud, so little ones can follow along.",
      "Unfinished stories are saved to carry on later, and a new level for young readers (6+).",
      "Anyone can browse and read the library, no account needed.",
    ],
    shot: { src: "/journey/day-09.webp", alt: "Taleo's home page at the end of day three" },
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
    shot: { src: "/journey/day-10.webp", alt: "Taleo's home page at the end of day four" },
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
    shot: { src: "/journey/day-11.webp", alt: "Taleo's home page at the end of day five" },
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
    shot: { src: "/journey/day-12.webp", alt: "Taleo's home page at the end of day six" },
  },
  {
    date: "2026-11-13",
    title: "Plans, and painting smarter",
    updates: 32,
    highlights: [
      "Plus and Pro plans for families who read every night, and a clear page on pricing.",
      "Smoother home page, story set-up and page turns; the first page's picture is ready sooner.",
      "Behind the scenes: trying a new way of painting that reuses characters and places, for quicker pictures.",
    ],
  },
];
