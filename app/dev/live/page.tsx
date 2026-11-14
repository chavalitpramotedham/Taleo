"use client";
import { useEffect, useState } from "react";
import { Painting } from "@/components/art/Painting";

/** Dev only: a finished library painting replayed as if it were arriving
 *  from the painter (a chunk every 250ms), to measure how smoothly a page
 *  painted live draws. ?story=ip1&page=1&chunk=1500 */
export default function LiveDev() {
  const [svg, setSvg] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const story = q.get("story") ?? "ip1";
    const page = Number(q.get("page") ?? 1);
    const chunk = Number(q.get("chunk") ?? 1500);
    let t = 0;
    void fetch(`/api/gallery/${story}`)
      .then((r) => r.json())
      .then(({ story: s }) => {
        const pages = s.segments.flatMap((sg: { pages: { svg?: string }[] }) => sg.pages);
        const whole: string = pages[page]?.svg ?? "";
        let at = 0;
        const step = () => {
          at = Math.min(whole.length, at + chunk);
          setSvg(whole.slice(0, at));
          if (at < whole.length) t = window.setTimeout(step, 250);
          else setDone(true);
        };
        step();
      });
    return () => clearTimeout(t);
  }, []);
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <main style={{ maxWidth: 640, margin: "20px auto", padding: 16 }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3" }}>{svg && <Painting svg={svg} live={!done} className="painting" />}</div>
      <p id="live-state">{done ? "done" : `${svg.length}`}</p>
    </main>
  );
}
