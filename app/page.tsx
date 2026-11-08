import Link from "next/link";
import type { Metadata } from "next";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { ageById } from "@/lib/ages";
import { SharedStoryWelcome, type SharedStorySummary } from "@/components/SharedStoryWelcome";
import { HeroPainting } from "@/components/HeroPainting";
import { FloatingBeginBar } from "@/components/FloatingBeginBar";
import { GalleryShelf } from "@/components/GalleryShelf";
import { MapleMark, OrnamentRule } from "@/components/Icons";

const STEPS = [
  { n: "I.", title: "Set the age", text: "Words and choices grow with them." },
  { n: "II.", title: "Choose a hero", text: "Pick a friend, or invent your own." },
  { n: "III.", title: "Pick the tale", text: "Adventure, bedtime, or any idea." },
  { n: "IV.", title: "Decide together", text: "Choose what happens, page by page." },
];

type HomeProps = { searchParams: Promise<{ story?: string | string[] }> };

const sharedId = async (searchParams: HomeProps["searchParams"]) => {
  const raw = (await searchParams).story;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return id && /^[\w-]{1,80}$/.test(id) ? id : null;
};

/** A shared link (/?story=<id>) previews as that story in chat apps and
 *  social posts: its title, a short description and its cover image. */
export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const id = await sharedId(searchParams);
  const story = id ? await getGalleryStory(id).catch(() => null) : null;
  if (!story) return {};
  const title = story.title || "An untitled story";
  const description = `A Taleo picture-book story starring ${story.hero.name}. Painted and shared for anyone to read.`;
  const image = `/store/${story.id}/opengraph-image`;
  return {
    title: `${title} · Taleo`,
    description,
    openGraph: { title, description, type: "article", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

async function sharedSummary(id: string | null): Promise<SharedStorySummary | null> {
  if (!id) return null;
  const story = await getGalleryStory(id).catch(() => null);
  if (!story) return null;
  const pages = allPages(story);
  return {
    id: story.id,
    title: story.title || "An untitled story",
    cover: pages.find((p) => p.svg)?.svg ?? null,
    author: story.authorUsername || "taleo",
    starring: [story.hero, ...(story.companions ?? [])].map((c) => c.name).filter(Boolean),
    ageLabel: ageById(story.age).label,
    minutes: story.minutes || ageById(story.age).recommendedMinutes,
    pages: pages.length,
    ratingAvg: story.ratingCount ? (story.ratingSum ?? 0) / story.ratingCount : null,
    ratingCount: story.ratingCount ?? 0,
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const shared = await sharedSummary(await sharedId(searchParams));
  return (
    <div className="container home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A picture book you make together</p>
          <h1>Stories dreamt up at bedtime, painted just for you</h1>
          <p className="lead">
            A watercolour picture book for your little one, where <em>you</em> decide what happens next.
          </p>
          {/* Desktop: the call to action sits right here; touch devices get the floating bar instead. */}
          <div className="hero-actions desktop-only">
            <Link className="btn btn-primary hero-cta" href="/create">
              <MapleMark />
              Begin a story
            </Link>
          </div>
        </div>
        <HeroPainting />
      </section>

      <ol className="steps" aria-label="How it works">
        {STEPS.map((s) => (
          <li key={s.n} className="step">
            <h3>
              <span className="numeral">{s.n}</span> {s.title}
            </h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <OrnamentRule className="home-divider" />

      <section className="home-shelf">
        <GalleryShelf
          limit={8}
          headClass="home-shelf-head"
          heading={<h2>From the library</h2>}
        />
        <div className="home-shelf-more">
          <Link className="btn btn-soft" href="/store">
            See the whole library
          </Link>
        </div>
      </section>

      <FloatingBeginBar />
      {shared && <SharedStoryWelcome story={shared} />}
    </div>
  );
}
