import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listGallery } from "@/server/gallery";
import { ageById } from "@/lib/ages";
import { MyCreationsRow } from "@/components/MyCreationsRow";
import { GalleryShelf } from "@/components/GalleryShelf";
import { FloatingBeginBar } from "@/components/FloatingBeginBar";
import { AccountIcon, CharacterIcon, MapleMark, OpenBookIcon, OrnamentRule } from "@/components/Icons";
import { QuotaNote } from "@/components/QuotaNote";
import { ReadingChart } from "@/components/ReadingChart";
import { readingDiary } from "@/server/reading";

export const metadata: Metadata = { title: "Home", robots: { index: false, follow: true } };

/** A signed-in parent's home: a welcome, three numbers about their
 *  stories, their own stories in a row, then more from the library. (New
 *  visitors get the welcome page at / instead.) */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const username = session.user.username ?? null;

  // Their published stories (one read of the library index, cached
  // briefly), and their reading diary: every story they've finished, on
  // which day - their own and the library's alike.
  const [all, diary] = await Promise.all([
    listGallery({ cacheSeconds: 60 }).catch(() => []),
    readingDiary(session.user.id).catch(() => ({ days: [], read: {} as Record<string, string[]> })),
  ]);
  const mine = all.filter((e) => e.authorId === session.user.id);
  const byId = new Map(all.map((e) => [e.id, e]));
  const minutesOf = (e: (typeof all)[number]) => e.minutes || ageById(e.age).recommendedMinutes;
  // Every book read counts, whoever wrote it: each story finished on a day
  // (read again on another day, it counts again), plus each of their own
  // stories, read as it was made, that isn't in the diary.
  const readings = Object.values(diary.read).flat().flatMap((id) => byId.get(id) ?? []);
  const inDiary = new Set(readings.map((e) => e.id));
  const sessions = [...readings, ...mine.filter((e) => !inDiary.has(e.id))];
  const minutes = sessions.reduce((n, e) => n + minutesOf(e), 0);
  // ...and a new word for each page of each different book (a book read
  // again teaches no new ones).
  const books = new Map(sessions.map((e) => [e.id, e]));
  const pages = [...books.values()].reduce((n, e) => n + (e.pages ?? 0), 0);
  const isNew = mine.length === 0;
  // Brand new: how a first story comes together, instead of three zeros.
  const firstSteps = [
    { icon: <AccountIcon />, title: "Say who it's for", hint: "Pick your child's age, and how long a story you'd like tonight." },
    { icon: <CharacterIcon />, title: "Choose a hero", hint: "A rabbit, a fox, or a character of your own - then what the story is about." },
    { icon: <OpenBookIcon />, title: "Read it together", hint: "Taleo writes it and paints every page. Your child decides what happens next." },
  ];
  const stats = [
    // (each number said as what it gave the child, not what was produced)
    { value: mine.length, label: mine.length === 1 ? "story created just for them" : "stories created just for them" },
    { value: minutes, label: minutes === 1 ? "minute of story time together" : "minutes of story time together" },
    // every page teaches one new word (the tappable word on each page)
    { value: pages, label: pages === 1 ? "new word discovered together" : "new words discovered together" },
  ];

  return (
    <div className="container home home-dash">
      <header className="home-dash-head">
        {/* (brand new - nothing made yet - it's a first welcome, not "back") */}
        <p className="eyebrow">
          {mine.length ? "Welcome back" : "Welcome"}
          {username ? `, @${username}` : ""}
        </p>
        {isNew ? (
          <>
            <h1>
              Your first story is
              <br />a few taps away
            </h1>
            <p className="sub">Tell us who it&apos;s for and what they love. Taleo writes it and paints every page.</p>
          </>
        ) : (
          <h1>
            Stories dreamt up at bedtime,
            <br />
            painted just for you
          </h1>
        )}
      </header>

      {isNew ? (
        // Brand new: the three steps of a first story, as one card that
        // can be tapped anywhere to begin - the first step is where it
        // starts, and says so.
        <Link className="first-steps" href="/create" aria-label="Begin your first story: say who it's for, choose a hero, then read it together">
          <ol>
            {firstSteps.map((s, i) => (
              <li key={s.title} className={i === 0 ? "first" : undefined}>
                <span className="first-steps-mark" aria-hidden>
                  {s.icon}
                  <b>{i + 1}</b>
                </span>
                <span className="first-steps-words">
                  <span className="first-steps-title">{s.title}</span>
                  <span className="first-steps-hint">{s.hint}</span>
                </span>
              </li>
            ))}
          </ol>
          <span className="first-steps-go">
            Start here <span aria-hidden>›</span>
          </span>
        </Link>
      ) : (
        <section className="home-stats" aria-label="Your stories so far">
          {stats.map((s) => (
            <div key={s.label} className="home-stat">
              <span className="home-stat-value">{s.value.toLocaleString()}</span>
              <span className="home-stat-label">{s.label}</span>
            </div>
          ))}
        </section>
      )}

      {/* The days you've read together, with the current streak. */}
      <ReadingChart />

      {/* Desktop: begin right under the numbers (touch devices have the
          floating bar instead). */}
      <div className="home-dash-begin desktop-only">
        <Link className="btn btn-primary hero-cta" href="/create">
          <MapleMark />
          {isNew ? "Begin your first story" : "Begin a story"}
        </Link>
        <QuotaNote />
      </div>

      <OrnamentRule className="home-divider" />

      <section className="home-creations">
        <header className="home-shelf-head home-creations-head">
          <h2>My bookshelf</h2>
          <p className="sub">The stories you&apos;ve made together, and the ones you&apos;ve saved.</p>
        </header>
        <MyCreationsRow username={username} />
      </section>

      <OrnamentRule className="home-divider" />

      <section className="home-shelf">
        <GalleryShelf
          limit={8}
          headClass="home-shelf-head"
          heading={
            <>
              <h2>Discover more</h2>
              <p className="sub">Made and shared by parents like you.</p>
            </>
          }
        />
        <div className="home-shelf-more">
          <Link className="btn btn-soft" href="/store">
            See the whole library
          </Link>
        </div>
      </section>

      <FloatingBeginBar />
    </div>
  );
}
