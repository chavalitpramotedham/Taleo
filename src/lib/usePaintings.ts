"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Story } from "./types";
import { castFor, pageKey } from "./story-utils";
import { extractSvgMarkup, sanitizeSvg } from "./svg-sanitize";

const CONCURRENCY = 3;
const DONE = "<!--taleo:done-->";

type Updater = (fn: (s: Story) => Story) => void;

/**
 * Paints every page that doesn't have a picture yet, streaming each painting
 * in as it is made. The page being read is painted first.
 */
export function usePaintings(story: Story, update: Updater | undefined, focus: string | null, enabled: boolean) {
  const [live, setLive] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [tick, setTick] = useState(0);
  const inflight = useRef(new Set<string>());
  const storyRef = useRef(story);
  storyRef.current = story;

  const paint = useCallback(
    async (seg: number, idx: number) => {
      const key = pageKey(seg, idx);
      const s = storyRef.current;
      const page = s.segments[seg]?.pages[idx];
      if (!page || !update) return;
      inflight.current.add(key);
      const prev = idx > 0 ? s.segments[seg].pages[idx - 1] : s.segments[seg - 1]?.pages.slice(-1)[0];
      let text = "";
      let last = 0;
      try {
        const res = await fetch("/api/illustrate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            world: s.world,
            cast: castFor(s, page),
            page: { text: page.text, picture: page.picture || page.text, characters: page.characters, action: page.action ?? null },
            previous: prev?.picture ?? null,
          }),
        });
        if (!res.ok || !res.body) throw new Error("paint failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          const now = performance.now();
          if (now - last > 120) {
            last = now;
            setLive((l) => ({ ...l, [key]: extractSvgMarkup(text) }));
          }
        }
        const svg = sanitizeSvg(extractSvgMarkup(text.replace(DONE, "")));
        if (!text.includes(DONE) || svg.length < 200) throw new Error("unfinished painting");
        update((cur) => ({
          ...cur,
          segments: cur.segments.map((sg, si) =>
            si !== seg ? sg : { ...sg, pages: sg.pages.map((p, pi) => (pi === idx ? { ...p, svg } : p)) },
          ),
        }));
      } catch {
        setFailed((f) => ({ ...f, [key]: true }));
      } finally {
        inflight.current.delete(key);
        setLive((l) => {
          const { [key]: _drop, ...rest } = l;
          void _drop;
          return rest;
        });
        setTick((t) => t + 1);
      }
    },
    [update],
  );

  useEffect(() => {
    if (!enabled) return;
    const pending: { seg: number; idx: number; key: string }[] = [];
    story.segments.forEach((sg, si) =>
      sg.pages.forEach((p, pi) => {
        const key = pageKey(si, pi);
        if (!p.svg && !failed[key] && !inflight.current.has(key)) pending.push({ seg: si, idx: pi, key });
      }),
    );
    if (!pending.length) return;
    // Paint the page being read first, then the ones after it.
    const focusIdx = focus ? pending.findIndex((p) => p.key === focus) : -1;
    const ordered = focusIdx > 0 ? [...pending.slice(focusIdx), ...pending.slice(0, focusIdx)] : pending;
    for (const p of ordered) {
      if (inflight.current.size >= CONCURRENCY) break;
      void paint(p.seg, p.idx);
    }
  }, [story, enabled, focus, failed, tick, paint]);

  const retry = useCallback((key: string) => {
    setFailed((f) => {
      const { [key]: _drop, ...rest } = f;
      void _drop;
      return rest;
    });
  }, []);

  return { live, failed, retry, painting: (key: string) => inflight.current.has(key) };
}
