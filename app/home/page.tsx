import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listGallery } from "@/server/gallery";
import { ageById } from "@/lib/ages";
import { MyCreationsRow } from "@/components/MyCreationsRow";
import { GalleryShelf } from "@/components/GalleryShelf";
import { FloatingBeginBar } from "@/components/FloatingBeginBar";
import { MapleMark, OrnamentRule } from "@/components/Icons";

export const metadata: Metadata = { title: "Home", robots: { index: false, follow: true } };

/** A signed-in parent's home: a welcome, three numbers about their
 *  stories, their own stories in a row, then more from the library. (New
 *  visitors get the welcome page at / instead.) */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const username = session.user.username ?? null;

  // Their published stories (one read of the library index, cached briefly).
  const all = await listGallery({ cacheSeconds: 60 }).catch(() => []);
  const mine = all.filter((e) => e.authorId === session.user.id);
  const pages = mine.reduce((n, e) => n + (e.pages ?? 0), 0);
  const minutes = mine.reduce((n, e) => n + (e.minutes || ageById(e.age).recommendedMinutes), 0);
  const stats = [
    { value: mine.length, label: mine.length === 1 ? "story created" : "stories created" },
    // every page teaches one new word (the tappable word on each page)
    { value: pages, label: pages === 1 ? "new word learned" : "new words learned" },
    { value: minutes, label: minutes === 1 ? "minute of stories" : "minutes of stories" },
  ];

  return (
    <div className="container home home-dash">
      <header className="home-dash-head">
        <p className="eyebrow">Welcome back{username ? `, @${username}` : ""}</p>
        <h1>
          Stories dreamt up at bedtime,
          <br />
          painted just for you
        </h1>
      </header>

      <section className="home-stats" aria-label="Your stories so far">
        {stats.map((s) => (
          <div key={s.label} className="home-stat">
            <span className="home-stat-value">{s.value.toLocaleString()}</span>
            <span className="home-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* Desktop: begin right under the numbers (touch devices have the
          floating bar instead). */}
      <div className="home-dash-begin desktop-only">
        <Link className="btn btn-primary hero-cta" href="/create">
          <MapleMark />
          Begin a story
        </Link>
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
              <h2>Discover more from the library</h2>
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
