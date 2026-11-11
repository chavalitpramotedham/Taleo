import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Privacy at Taleo" },
  description: "What Taleo keeps about your family, who can see it, who helps us run the site, and how to delete it all.",
  alternates: { canonical: "/privacy" },
};

/** When this page last changed in substance (shown at its head). */
const UPDATED = "11 November 2026";

/**
 * The privacy policy, in plain words. Everything here describes what the
 * code does today - src/server/account-data.ts lists what's kept for an
 * account and what deleting one removes. Change this page whenever that
 * changes (something new is stored, or a new outside service is used).
 */
export default function PrivacyPage() {
  return (
    <div className="container about policy">
      <header className="wizard-head">
        <p className="eyebrow">Your family&apos;s trust</p>
        <h1>Privacy at Taleo</h1>
        <p className="policy-date">Last updated {UPDATED}</p>
      </header>

      <article className="policy-body">
        <p>
          Taleo is a small, independent project made by a parent, for families. This page says plainly what we keep, who can see it, and how to remove it. If anything here is unclear, <Link href="/about#contact">write to us</Link>.
        </p>

        <h2>The short version</h2>
        <ul>
          <li>We keep only what the site needs to work. There are no adverts, no trackers and no analytics services watching what you do.</li>
          <li>We never sell your information, and we don&apos;t pass it to anyone except the few services that help us run Taleo, listed below.</li>
          <li>Stories you finish are public, in the Library, under your username. Everything else about your account is private to you.</li>
          <li>You can delete any story, or your whole account and everything kept with it, at any time.</li>
        </ul>

        <h2>What we keep</h2>
        <h3>Your account</h3>
        <p>
          You sign in with Google. Google tells us your email address, your name and the address of your Google profile picture, and gives us an account number so we know it&apos;s you next time. We never see your Google password. You then choose a username and a picture to be known by on Taleo.
        </p>
        <h3>What you make</h3>
        <p>
          The stories you create (their words, pictures and the choices made along the way), the characters you design (their names, how they look, and any notes you add about them), and a story you&apos;ve begun and not yet finished, so you can carry on with it later or on another device.
        </p>
        <h3>What you do here</h3>
        <p>
          Your reading diary (the days you finished a story, and which stories), the stories you&apos;ve saved from the Library, ratings and comments you leave, how much of your plan&apos;s allowance you&apos;ve used, and your credits with a list of how they were added and spent.
        </p>
        <h3>A record of what was made</h3>
        <p>
          For 30 days we keep a record of each request to write a story, paint a picture or design a character: what was asked for and what came back. We use it to fix problems and to keep an eye on what the site costs to run. We also keep a monthly figure of what each account&apos;s creations cost us.
        </p>
        <h3>Messages you send us</h3>
        <p>
          If you write to us through Contact us, we keep your message and anything you attach, along with your email address so we can reply.
        </p>
        <h3>When something goes wrong</h3>
        <p>
          If the site hits an error in your browser, a short technical report is sent to us: the error, the page it happened on and the kind of browser. It doesn&apos;t include what you were writing.
        </p>

        <h2>Photos</h2>
        <p>
          You can choose a photo to design a character from. It is made smaller on your own device first, which also strips out where and when it was taken. It is then sent once to be painted from, and we do not keep it.
        </p>

        <h2>On your device</h2>
        <p>
          We use cookies for one thing only: signing you in and keeping you signed in. Your browser also remembers a few settings for you, such as day or night mode, your chosen reading voice and your place in a story. There are no advertising or tracking cookies.
        </p>

        <h2>What other people can see</h2>
        <p>
          A finished story appears in the public Library under your username, where anyone can read it, including the names of the characters in it. Ratings and comments are shown with the username of whoever left them.
        </p>
        <p>
          Nobody else can see your email address, your real name, your saved characters and the notes about them, your reading diary, the stories you&apos;ve saved, or a story you haven&apos;t finished.
        </p>
        <p className="policy-note">
          Because finished stories are public, please don&apos;t put a child&apos;s full name, address, school or anything else you wouldn&apos;t want strangers to read into a story. A first name or a nickname is plenty for a hero.
        </p>

        <h2>Who helps us run Taleo</h2>
        <p>These services handle information for us, only to do the job described, each under its own privacy terms:</p>
        <ul>
          <li>
            <b>Anthropic</b> writes the stories and paints the pictures. It receives what you ask for: the story idea, the characters&apos; names and descriptions, and a photo if you chose one.
          </li>
          <li>
            <b>ElevenLabs or OpenAI</b> provides the read-aloud voice. It receives the words of the page being read.
          </li>
          <li>
            <b>Google</b> handles signing in.
          </li>
          <li>
            <b>Vercel</b> hosts the site and stores its files.
          </li>
          <li>
            <b>Upstash</b> holds the site&apos;s running records: allowance and credit counts, and the 30-day record of what was made.
          </li>
          <li>
            <b>Resend</b> delivers the messages you send us, and error reports, to our inbox.
          </li>
        </ul>
        <p>We don&apos;t share your information with anyone else, unless the law requires us to.</p>

        <h2>How it&apos;s kept safe</h2>
        <p>
          Your account details, characters, reading diary, saved stories and messages are stored encrypted, with a key that only our server holds. An unfinished story is kept at a private address nobody can guess. Finished stories and their read-aloud recordings are public files, as they are meant to be read by anyone. Only signed-in account holders can create anything, and every request is checked against the account making it.
        </p>
        <p>No website can promise perfect security, but we treat your family&apos;s information as we would want ours treated.</p>

        <h2>How long we keep it</h2>
        <p>
          Your account and what you&apos;ve made stay until you delete them. The record of what was made is kept for 30 days, and the counts of allowance used for about a week.
        </p>

        <h2>Deleting your information</h2>
        <p>
          You can delete any one story from its page, or all of your stories at once from your <Link href="/account">Account</Link> page. Deleting your account, from the same page, removes your profile, your stories, your characters, your unfinished story, your reading diary, your saved stories, your allowance and credit records, the record of what was made for you, and the copies of messages you sent us.
        </p>
        <p>
          Two things remain: ratings and comments you left on other families&apos; stories, which stay under the username you wrote them with, and any emails already delivered to our inbox. <Link href="/about#contact">Write to us</Link> if you&apos;d like those removed too, or if you&apos;d like a copy of what we hold about you or want something corrected.
        </p>

        <h2>Children</h2>
        <p>
          Taleo is made for parents and other grown-ups to use with their children. Accounts are for adults. We don&apos;t ask children for any information, and we don&apos;t knowingly keep any that a child has given us directly. What we hold about a child is only what a grown-up chose to put into a character or a story.
        </p>

        <h2>Changes to this page</h2>
        <p>
          If what we keep or who helps us changes, we&apos;ll update this page and the date at the top. For anything else, <Link href="/about#contact">contact us</Link>.
        </p>
      </article>
    </div>
  );
}
