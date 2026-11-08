import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { OrnamentRule } from "@/components/Icons";

export const metadata: Metadata = {
  title: "About · Taleo",
  description: "Why a young dad built Taleo: both parents want to be there for their kids, and bedtime stories are one of the best ways to do it.",
};

/** About Taleo: the founder's story, and the "Say hello" form. */
export default function AboutPage() {
  return (
    <div className="container about">
      <header className="wizard-head">
        <p className="eyebrow">By parents, for parents</p>
        {/* Bedtime reading, faded into the page with the same painted edge
            as the story illustrations. */}
        <figure className="about-hero">
          <svg viewBox="0 0 400 400" role="img" aria-label="A dad reading a picture book to his laughing baby at bedtime, the moon outside the window">
            <image href="/about/bedtime-story.jpg" width="400" height="400" mask="url(#tl-vignette-square)" preserveAspectRatio="xMidYMid slice" />
            <rect className="paint-dim" width="400" height="400" mask="url(#tl-vignette-square)" />
          </svg>
        </figure>
        <h1>Why I made Taleo</h1>
      </header>

      <article className="about-story">
        <p className="about-lead">
          I am a young dad. By day I work in tech as a product manager, and by night I&apos;m mostly negotiating
          bedtimes. Some of my favourite moments with my kids happen with a book open between us. It&apos;s where we laugh at
          the same silly things, and where a lot of the important stuff gets said without it ever feeling like a lecture.
        </p>

        <p>
          I genuinely believe we&apos;re the first generation of parents where mums and dads are equally in it. Both of us
          want a close bond with our children. Both of us want to be the one teaching them what&apos;s right, and helping
          them find their way in the world. Taleo is my way of acting on that, as a dad.
        </p>

        <p>
          If you&apos;re a parent, you&apos;ll know the other side of bedtime stories too. Kids have their favourite book,
          and they want it again. And again. I love that they love it, but by the fiftieth reading even the best story starts
          to drag, for me at least.
        </p>

        <p>
          So I started wondering what it would be like to make the stories <em>together</em>. My kids pick the hero and
          decide what happens next, and I get to weave in the lesson I&apos;d like them to take away.
        </p>

        <p>
          I know a lot of parents are wary of AI around their children. Honestly, so am I, and I think that&apos;s a healthy
          instinct. But I&apos;ve also seen how much it means to a child when something they imagined shows up on the page,
          painted and read back to them. Used with care, I think it can help kids dream bigger, find their own words, and
          pick up a few of life&apos;s lessons along the way. That&apos;s what I&apos;m trying to build, as a parent first.
        </p>

        <p className="about-sign">
          If you&apos;re a parent like us, I hope Taleo makes bedtime a little more fun in your home. If you have an idea, or
          something isn&apos;t working, please tell me using the form below. I&apos;d really love to hear from you.
        </p>
      </article>

      <OrnamentRule className="about-divider" />

      <ContactForm />
    </div>
  );
}
