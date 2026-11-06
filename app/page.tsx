import Link from "next/link";
import { HomeArt } from "@/components/HomeArt";

export default function Home() {
  return (
    <div className="container">
      <section className="hero">
        <div>
          <h1>
            Stories you <em>dream up</em> together
          </h1>
          <p className="lead">
            Pick a cuddly character, choose what the story is about, and Taleo paints a watercolour picture book just for
            your little one — with moments where <strong>you decide what happens next</strong>.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/create">
              ✨ Start a story
            </Link>
            <Link className="btn btn-soft" href="/library">
              📚 My stories
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <HomeArt />
        </div>
      </section>

      <section className="steps">
        <div className="step">
          <div className="num">🎂</div>
          <h3>Set the age</h3>
          <p>From first words at 1½ to big imaginations at 5–6. Words and choices grow with them.</p>
        </div>
        <div className="step">
          <div className="num">🐰</div>
          <h3>Choose a hero</h3>
          <p>A bunny, a strawberry, a teapot… or invent your own by typing or saying it out loud.</p>
        </div>
        <div className="step">
          <div className="num">🗺️</div>
          <h3>Pick the theme</h3>
          <p>Adventure, new friends, family, bedtime — or describe any idea in one line.</p>
        </div>
        <div className="step">
          <div className="num">🤔</div>
          <h3>Decide together</h3>
          <p>At key moments, choose what happens — or shout out your own wild idea!</p>
        </div>
      </section>
    </div>
  );
}
