import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { OrnamentRule } from "@/components/Icons";

export const metadata: Metadata = {
  title: "About · Taleo",
  description: "Why a young dad built Taleo: storytelling is one of the most meaningful ways to bond with our children - and it should be fun for parents too.",
};

/** About Taleo: the founder's story, and the "Say hello" form. */
export default function AboutPage() {
  return (
    <div className="container about">
      <header className="wizard-head">
        <p className="eyebrow">By parents, for parents</p>
        <h1>Why I made Taleo</h1>
      </header>

      <article className="about-story">
        <p className="about-lead">
          I&apos;m a young dad, and by day a product manager in tech. Somewhere between raising my kids and swapping stories with
          other parents, I realised that some of the most meaningful moments we share with our children happen inside a story.
          Stories are how we bond with them, and how life&apos;s most important lessons quietly find their way in.
        </p>

        <p>
          But I also noticed that many parents feel the same quiet pain I did. Our children adore their favourite books, and we
          love that they do. Yet reading the same story over and over again can make parenting a little less fun than it should
          be.
        </p>

        <p>
          So I started to wonder: what if parents and children could create meaningful stories <em>together</em>, with the
          characters they dream up and the adventures they choose?
        </p>

        <p>
          I know that many of us carry a real fear that artificial intelligence may do our children more harm than good. I
          understand that fear, and it&apos;s exactly why I believe it matters to build this the right way: gently, carefully,
          and with parents at its heart. Because I&apos;ve seen how, used well, generative AI can unlock our children&apos;s
          dreams and creativity. It can give them the freedom to tell the stories they want, the way they want, and help them
          learn life&apos;s lessons and language more vividly than we ever could before.
        </p>

        <p className="about-sign">
          For parents like us, we hope Taleo brings a little more wonder to your bedtimes. If you have any suggestions, or run
          into any issues, we&apos;d love to hear from you through the form below.
        </p>
      </article>

      <OrnamentRule className="about-divider" />

      <ContactForm />
    </div>
  );
}
