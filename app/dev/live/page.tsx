"use client";
import { useEffect, useState } from "react";
import { Painting } from "@/components/art/Painting";

/** Dev only: finished library paintings replayed as if they were arriving
 *  from the painter (a chunk every 250ms), to measure how smoothly - and
 *  in how much memory - pages painted live draw. `n` replays that many
 *  pages at once, as a new part does. ?story=ip1&page=1&chunk=1500&n=1 */
export default function LiveDev() {
  const [svgs, setSvgs] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const story = q.get("story") ?? "ip1";
    const page = Number(q.get("page") ?? 1);
    const chunk = Number(q.get("chunk") ?? 1500);
    const n = Number(q.get("n") ?? 1);
    let t = 0;
    void fetch(`/api/gallery/${story}`)
      .then((r) => r.json())
      .then(({ story: s }) => {
        const pages = s.segments.flatMap((sg: { pages: { svg?: string }[] }) => sg.pages);
        const wholes: string[] = Array.from({ length: n }, (_, i) => pages[(page + i) % pages.length]?.svg ?? "");
        let at = 0;
        const step = () => {
          at += chunk;
          setSvgs(wholes.map((w) => w.slice(0, Math.min(w.length, at))));
          if (wholes.some((w) => at < w.length)) t = window.setTimeout(step, 250);
          else setDone(true);
        };
        step();
      });
    return () => clearTimeout(t);
  }, []);
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <main style={{ maxWidth: 640, margin: "20px auto", padding: 16 }}>
      {svgs.map((svg, i) => (
        <div key={i} style={{ position: "relative", aspectRatio: "4 / 3" }}>
          {svg && <Painting svg={svg} live={!done} className="painting" />}
        </div>
      ))}
      <p id="live-state">{done ? "done" : `${svgs[0]?.length ?? 0}`}</p>
    </main>
  );
}
