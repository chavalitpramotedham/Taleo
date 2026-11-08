import Link from "next/link";
import { Painting } from "@/components/art/Painting";
import { HOME_SCENE } from "@/lib/art/homeScene";
import { FloatingBeginBar } from "@/components/FloatingBeginBar";
import { GalleryShelf } from "@/components/GalleryShelf";
import { MapleMark } from "@/components/Icons";

const STEPS = [
  { n: "I.", title: "Set the age", text: "Words and choices grow with them." },
  { n: "II.", title: "Choose a hero", text: "Pick a friend, or invent your own." },
  { n: "III.", title: "Pick the tale", text: "Adventure, bedtime, or any idea." },
  { n: "IV.", title: "Decide together", text: "Choose what happens, page by page." },
];

export default function Home() {
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
        <figure className="hero-art">
          <Painting svg={HOME_SCENE} title="Pip the rabbit leaps over a puddle after a falling leaf while Bobo the bear laughs" />
        </figure>
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
    </div>
  );
}
