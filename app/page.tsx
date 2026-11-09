import Link from "next/link";
import type { Metadata } from "next";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { ageById } from "@/lib/ages";
import { storyKeyword } from "@/lib/keywords";
import { SharedStoryWelcome, type SharedStorySummary } from "@/components/SharedStoryWelcome";
import { HeroPainting } from "@/components/HeroPainting";
import { StepsScroller } from "@/components/StepsScroller";
import { TechShowcase } from "@/components/TechShowcase";
import { FloatingBeginBar } from "@/components/FloatingBeginBar";
import { GalleryShelf } from "@/components/GalleryShelf";
import { MapleMark, OrnamentRule } from "@/components/Icons";
import { ORGANIZATION, WEB_APPLICATION, WEBSITE, jsonLd } from "@/lib/seo";

const STEPS = [
  {
    n: "I.",
    title: "Set the age",
    text: "Words and choices grow with your child.",
    image: "/steps/step-1.jpg",
    alt: "A dad measuring his giggling baby with a tape measure at bedtime",
  },
  {
    n: "II.",
    title: "Choose a hero",
    text: "Theirs, yours, or one you dream up together.",
    image: "/steps/step-2.jpg",
    alt: "A dad and baby dreaming up a little knight riding a friendly dragon",
  },
  {
    n: "III.",
    title: "Pick the tale",
    text: "Adventure, bedtime, or a lesson to share.",
    image: "/steps/step-3.jpg",
    alt: "A dad and baby reading, surrounded by dreams of bears, forests, foxes and castles",
  },
  {
    n: "IV.",
    title: "Decide together",
    text: "Read side by side, choosing page by page.",
    image: "/steps/step-4.jpg",
    alt: "A laughing baby choosing what a little dragon does next: a sword, a treasure chest or a mountain",
  },
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
  if (!story) return { alternates: { canonical: "/" } };
  const title = story.title || "An untitled story";
  const description = `A Noomi picture-book story starring ${story.hero.name}. Painted and shared for anyone to read.`;
  const image = `/store/${story.id}/opengraph-image`;
  return {
    // (The "· Noomi" template only applies to pages below this one.)
    title: { absolute: `${title} · Noomi` },
    description,
    // The same story has its own page; search engines should list that one.
    alternates: { canonical: `/store/${story.id}` },
    openGraph: { title, description, type: "article", siteName: "Noomi", url: `/store/${story.id}`, images: [image] },
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
    keyword: storyKeyword(story),
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
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@graph": [ORGANIZATION, WEBSITE, WEB_APPLICATION] })} />
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Stories dreamt up at bedtime,
            <br />
            painted just for you
          </h1>
          <p className="lead">
            <strong>By parents, for parents</strong> - a watercolour picture book you and your little one shape <em>together</em> at
            bedtime, with a warm lesson in every story.
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

      {/* The steps get their own little chapter: a divider and heading. */}
      <OrnamentRule className="home-divider" />
      <header className="home-shelf-head home-steps-head">
        <h2>Get started</h2>
        <p className="sub">Dream up a bedtime story together, one magical page at a time.</p>
      </header>
      <StepsScroller steps={STEPS} />

      <TechShowcase />

      <OrnamentRule className="home-divider" />

      <section className="home-shelf">
        <GalleryShelf
          limit={8}
          headClass="home-shelf-head"
          heading={
            <>
              <h2>From the library</h2>
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
      {shared && <SharedStoryWelcome story={shared} />}
    </div>
  );
}
