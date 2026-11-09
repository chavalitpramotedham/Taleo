import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { OG_IMAGE } from "@/lib/seo";
import { OrnamentRule } from "@/components/Icons";

export const metadata: Metadata = {
  title: "About",
  description: "Why a young dad built Taleo: both parents want to be there for their kids, and bedtime stories are one of the best ways to do it.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    siteName: "Taleo",
    url: "/about",
    title: "About Taleo: by parents, for parents",
    description: "Why a young dad built Taleo: both parents want to be there for their kids, and bedtime stories are one of the best ways to do it.",
    images: [OG_IMAGE],
  },
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
          <svg viewBox="0 0 400 400" className="painted-edge-square" role="img" aria-label="A dad reading a picture book to his laughing baby at bedtime, the moon outside the window">
            <image href="/about/bedtime-story.jpg" width="400" height="400" preserveAspectRatio="xMidYMid slice" />
            <rect className="paint-dim" width="400" height="400" />
          </svg>
        </figure>
        <h1>Why I made Taleo</h1>
      </header>

      <article className="about-story">

        <p className="about-lead">
          <span className="about-drop">I</span>
          &apos;m a young dad to a little boy. By day, I work in tech as a product manager, and by night, I&apos;m slowly perfecting the art of bedtime.
        </p>

        <p>
          As working parents, the time we get to spend with our children after work is so precious. Over the past few months, reading to him has become one of my favourite parts of our bedtime routine. It calms him down, slows me down, and gives us a little time that&apos;s just ours, with no distractions. I think these are some of the most precious moments we get to share with our little ones, and they&apos;re truly worth protecting.
        </p>

        <p>
          Becoming a dad has also made me think a lot about the years ahead. I&apos;ve spent time talking to other parents, watching and learning about raising young children, and one thing that keeps coming up is the role storytelling plays as they grow.
        </p>

        <p>
          Stories are a wonderful way for children to explore the world, let their imaginations run wild, and learn about things like kindness, courage and empathy, often without it ever feeling like a lesson.
        </p>

        <p>
          But of course, parents also become the occasional &quot;victims&quot; of their children&apos;s favourite bedtime stories. Kids want it again. Then again. And again. By the fiftieth reading, even the best stories can start to lose a little of their magic.
        </p>

        <p>
          It got me wondering: what if parents and kids could make new stories together? What if children could choose their own heroes, imagine their own adventures, and have a say in where the story goes, while parents get to weave in the little lessons and values they&apos;d like to share? With every new story, there&apos;s a fresh adventure and a little surprise for everyone. And perhaps, for the first time in a while, the magic comes alive for parents just as much as it does for their children.
        </p>

        <p>
          That&apos;s the idea behind Taleo.
        </p>

        <p>
          I know a lot of parents are wary of AI around their children. Honestly, so am I, and I think it&apos;s a healthy instinct. But as I&apos;ve worked on this project, I&apos;ve come to appreciate how magical it can be for a child to see something they&apos;ve imagined brought to life on a page, illustrated and read back to them, especially by the people they love most in the world. Used with care, I think generative AI can help kids dream bigger, find their own words, and pick up a few of life&apos;s lessons along the way.
        </p>

        <p>
          That&apos;s what I&apos;m hoping to build with Taleo. A little more imagination, a little more connection, and a few more special moments at bedtime. All from a dad who&apos;s figuring it out along the way.
        </p>

      </article>

      <OrnamentRule className="about-divider" />

      <ContactForm />
    </div>
  );
}
