import type { Metadata } from "next";
import Link from "next/link";
import { CharacterPortrait } from "@/components/art/Painting";
import { HomeLink } from "@/components/HomeLink";
import { MapleMark } from "@/components/Icons";
import { PRESETS, presetCharacter } from "@/lib/presets";

export const metadata: Metadata = { title: "Page not found" };

/** Any address that leads nowhere: the little rabbit from the empty
 *  shelves, a kind word, and the way back. */
export default function NotFound() {
  return (
    <div className="container empty not-found">
      <CharacterPortrait character={presetCharacter(PRESETS[0])} className="empty-portrait" />
      <p className="eyebrow">Page not found</p>
      <h1 className="empty-title">This page has wandered off</h1>
      <p className="meta">The address may be mistyped, or the page may have moved. Let&apos;s get you back to the stories.</p>
      <div className="not-found-actions">
        <HomeLink className="btn btn-primary">
          <MapleMark />
          Back to home
        </HomeLink>
        <Link className="btn btn-soft" href="/store">
          Browse the library
        </Link>
      </div>
    </div>
  );
}
