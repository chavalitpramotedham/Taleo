"use client";
import { ZoomList, ZoomPicture, type ZoomItem } from "../admin/activity/Zoom";
import type { JourneyShot } from "@/content/journey";

/** One day's screenshots: a low window that scrolls sideways, each picture
 *  with its caption; a tap opens it full size, and the arrows step through
 *  the rest of the day's. */
export function JourneyGallery({ shots, day }: { shots: JourneyShot[]; day: string }) {
  const items: ZoomItem[] = shots.map((s) => ({ src: s.src, label: s.caption, title: day, caption: s.caption }));
  return (
    <ZoomList items={items}>
      <div className="journey-gallery" role="list" aria-label={`Screenshots from ${day}`}>
        {shots.map((s, i) => (
          <figure key={s.src} role="listitem" className={`journey-thumb${s.wide ? " wide" : s.square ? " square" : ""}`}>
            <ZoomPicture index={i} src={s.src} label={s.caption} title={day} caption={s.caption} className="journey-thumb-img" lazy width={s.wide ? 300 : s.square ? 130 : 110} height={s.wide ? 188 : s.square ? 130 : 238} />
            <figcaption>{s.caption}</figcaption>
          </figure>
        ))}
      </div>
    </ZoomList>
  );
}
