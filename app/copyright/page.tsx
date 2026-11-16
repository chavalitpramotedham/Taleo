import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Copyright at Taleo" },
  description: "How to tell us if something on Taleo copies your work, and how we handle it.",
  alternates: { canonical: "/copyright" },
};

/** When this page last changed in substance (shown at its head). */
const UPDATED = "17 November 2026";

/** Where copyright notices go (the designated agent's address, as
 *  registered with the US Copyright Office - keep the two the same). */
const AGENT_EMAIL = "taleostories.dev@gmail.com";

/**
 * The copyright (DMCA) policy: finished stories and comments are public,
 * so there has to be a way for someone to say "that's mine" and have it
 * taken down - and a named agent to send it to.
 */
export default function CopyrightPage() {
  return (
    <div className="container about policy">
      <header className="wizard-head">
        <p className="eyebrow">Respecting other people&apos;s work</p>
        <h1>Copyright at Taleo</h1>
        <p className="policy-date">Last updated {UPDATED}</p>
      </header>

      <article className="policy-body">
        <p>
          Stories in Taleo&apos;s Library are made by families, with pictures and words written by AI from their ideas. Comments are written by readers. We ask everyone to make their own stories and characters, and not to copy other people&apos;s. If you think something on Taleo copies your work, tell us and we&apos;ll look at it quickly.
        </p>

        <h2>Telling us about a copy of your work</h2>
        <p>Send a notice to our copyright agent (details below) that includes:</p>
        <ul>
          <li>the work you believe has been copied (a link or a description);</li>
          <li>where it is on Taleo: the link to the story, picture or comment;</li>
          <li>your name, postal address, telephone number and email address;</li>
          <li>a statement that you believe in good faith that the use isn&apos;t authorised by you, your agent or the law;</li>
          <li>a statement that the information in your notice is accurate and, under penalty of perjury, that you are the owner or are authorised to act for the owner;</li>
          <li>your physical or electronic signature (typing your full name is enough).</li>
        </ul>
        <p>
          When we receive a complete notice, we take the material down or make it unavailable, and tell the family who posted it.
        </p>

        <h2>If your story was taken down</h2>
        <p>
          If you believe it was taken down by mistake, or that you have the right to use the material, you can send a counter-notice to the same agent with: the link to what was removed; a statement, under penalty of perjury, that you believe in good faith it was removed by mistake or misidentification; your name, address and telephone number; a statement that you consent to the jurisdiction of the federal district court for your address (or, outside the United States, any judicial district in which Taleo may be found) and will accept service from the person who sent the notice; and your signature. Unless the person who sent the notice tells us they have gone to court, we may put the material back after 10 to 14 working days.
        </p>

        <h2>Repeat infringement</h2>
        <p>We close the accounts of people who repeatedly post work that isn&apos;t theirs to share.</p>

        <h2>Our copyright agent</h2>
        <p>
          Chavalit Pramotedham, Taleo
          <br />
          Email: <a href={`mailto:${AGENT_EMAIL}?subject=Copyright%20notice`}>{AGENT_EMAIL}</a>
        </p>
        <p>
          For anything else, <Link href="/about#contact">contact us</Link>.
        </p>
      </article>
    </div>
  );
}
