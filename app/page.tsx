import Link from "next/link";
import { Painting } from "@/components/art/Painting";
import { Ornament } from "@/components/Icons";
import { HOME_SCENE } from "@/lib/art/homeScene";
import { FloatingBeginBar } from "@/components/FloatingBeginBar";

export default function Home() {
  return (
    <div className="container home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A picture book you make together</p>
          <h1>Stories dreamt up at bedtime, painted just for you</h1>
          <p className="lead">
            Choose a character, choose what the story is about, and Taleo writes and paints a watercolour picture book for your
            little one, pausing at just the right moments so <em>you</em> can decide what happens next.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-soft" href="/my-stories">
              My stories
            </Link>
          </div>
        </div>
        <figure className="hero-art">
          <Painting svg={HOME_SCENE} title="Pip the rabbit leaps over a puddle after a falling leaf while Bobo the bear laughs" />
          <figcaption>“Wait for me!” laughed Bobo, as Pip leapt clean over the puddle.</figcaption>
        </figure>
      </section>

      <Ornament className="ornament center" />

      <section className="steps">
        <div className="step">
          <span className="numeral">I.</span>
          <h3>Set the age</h3>
          <p>From first words at one-and-a-half to big imaginations at six. Words and choices grow with them.</p>
        </div>
        <div className="step">
          <span className="numeral">II.</span>
          <h3>Choose a hero</h3>
          <p>A rabbit, a fox cub, a china teapot… or invent your own by typing it or saying it out loud.</p>
        </div>
        <div className="step">
          <span className="numeral">III.</span>
          <h3>Pick the tale</h3>
          <p>Adventure, new friends, family, bedtime, or any idea you can put in a sentence.</p>
        </div>
        <div className="step">
          <span className="numeral">IV.</span>
          <h3>Decide together</h3>
          <p>At each turning point, choose what happens, or call out your own idea. Every page is painted as you go.</p>
        </div>
      </section>

      <FloatingBeginBar />
    </div>
  );
}
