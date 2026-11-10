import { createElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { sanitizeSvgFlat } from "@/lib/svg-sanitize";
import { loadBrandFonts } from "@/server/og-fonts";
import { clothFor } from "@/lib/cover";
import { ageById } from "@/lib/ages";
import { keywordColour, storyKeyword } from "@/lib/keywords";

export const size = { width: 1200, height: 630 };
// Built once per story and cached (rebuilt at most daily) - not on every
// time a link preview is fetched.
export const revalidate = 86400;
export async function generateStaticParams() {
  return [];
}
export const contentType = "image/png";

const toReactAttr = (k: string) => (k === "class" ? "className" : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

/** Satori (ImageResponse's renderer) needs real elements, not dangerouslySetInnerHTML,
 *  so parse the already-sanitized SVG markup into a JSX tree. */
function svgToReact(svg: string): ReactNode[] {
  const tagRe = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)([^<>]*?)(\/)?\s*>/g;
  const attrRe = /([a-zA-Z-:]+)\s*=\s*"([^"]*)"/g;
  const root: ReactNode[] = [];
  const stack: { tag: string; props: Record<string, unknown>; children: ReactNode[] }[] = [];
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(svg))) {
    const [, closing, tag, rawAttrs, selfClose] = m;
    const push = (node: ReactNode) => (stack.length ? stack[stack.length - 1].children.push(node) : root.push(node));
    if (closing) {
      const el = stack.pop();
      if (el) push(createElement(el.tag, { ...el.props, key: key++ }, ...el.children));
      continue;
    }
    const props: Record<string, unknown> = {};
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(rawAttrs))) props[toReactAttr(a[1])] = a[2];
    if (selfClose) push(createElement(tag, { ...props, key: key++ }));
    else stack.push({ tag, props, children: [] });
  }
  return root;
}

const STAR = "M12 2.8l2.7 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.7 6.3 19.9l1.4-6.3L2.9 9.3l6.4-.6z";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" style={{ margin: "0 2px" }}>
      <path d={STAR} fill={filled ? "#C49A3E" : "none"} stroke="#C49A3E" strokeWidth={1.3} />
    </svg>
  );
}

/** The cover's little gilt flourish (the same as the in-app cover's). */
function Ornament({ color }: { color: string }) {
  return (
    <svg width={170} height={20} viewBox="0 0 120 14" fill="none" stroke={color} strokeWidth={1} strokeLinecap="round">
      <path d="M2 7h40M78 7h40" />
      <path d="M60 2c-4 0-6 2.5-6 5s2 5 6 5 6-2.5 6-5-2-5-6-5z" />
      <path d="M48 7c2-3 4-3 6 0M66 7c2 3 4 3 6 0" />
      <circle cx="60" cy="7" r="1.2" fill={color} />
    </svg>
  );
}

/** Taleo's mark, the maple leaf (the same drawing as the app's own). */
function MapleLeaf() {
  return (
    <svg width={34} height={40} viewBox="-6.6 -8.4 13.2 15.6" style={{ marginRight: 8 }}>
      <path
        d="M0,-7.2 C1.6,-6.8 2,-5.3 1.5,-4 C2.6,-4.6 4.2,-4.6 5.4,-3.4 C4.6,-2.2 3.4,-1.5 2.4,-1.2 C3.6,0.3 4.2,1.8 3.8,3.2 C2.4,2.6 1.1,2.1 0,1.6 C-1.1,2.1 -2.4,2.6 -3.8,3.2 C-4.2,1.8 -3.6,0.3 -2.4,-1.2 C-3.4,-1.5 -4.6,-2.2 -5.4,-3.4 C-4.2,-4.6 -2.6,-4.6 -1.5,-4 C-2,-5.3 -1.6,-6.8 0,-7.2 Z"
        fill="#E2AE4A"
        stroke="#7A5420"
        strokeWidth={0.45}
        strokeLinejoin="round"
      />
      <path d="M0,-5.4 L0,1.5 M0,-0.6 L-3.2,-3 M0,-0.6 L3.2,-3 M0,0.6 L-2.4,2 M0,0.6 L2.4,2" stroke="#9A6A26" strokeWidth={0.38} strokeLinecap="round" fill="none" opacity={0.8} />
      <path d="M0,1.5 C0,2.9 0,4.3 0.3,6.2" stroke="#7A5420" strokeWidth={0.6} strokeLinecap="round" fill="none" />
    </svg>
  );
}

const GILT = "#e4c27c";

/** A shared story's link preview: its book cover - cloth-bound in the
 *  story's own colour, gilt frame, stamped title, the first page's painting
 *  in an oval - beside the key details from its preview: title, keyword,
 *  who it stars, ages, reading time and pages, its rating and who made it. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id, { cacheSeconds: 86400 });

  const title = story?.title || "A Taleo story";
  const pages = story ? allPages(story) : [];
  const cover = pages.find((p) => p.svg)?.svg ?? null;
  const flatCover = cover ? sanitizeSvgFlat(cover) : "";
  const names = story ? [story.hero, ...(story.companions ?? [])].map((h) => h.name) : [];
  const starring = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0];
  const count = story?.ratingCount ?? 0;
  const avg = count ? Math.round((story!.ratingSum! / count) * 10) / 10 : 0;
  const age = story ? ageById(story.age) : null;
  const minutes = story?.minutes || age?.recommendedMinutes || 5;
  const keyword = story ? storyKeyword(story) : "";
  const kw = keyword ? keywordColour(keyword) : "#9C4F32";
  const author = story?.authorUsername || "taleo";
  const [clothA, clothB] = clothFor(id);
  const fonts = await loadBrandFonts();
  const FONT_TITLE = "IM Fell English";
  const FONT_CAPS = "IM Fell English SC";
  const FONT_BODY = "EB Garamond";
  const W = 390; // the book, 3:4
  const H = 520;
  const titleSize = title.length > 40 ? 46 : title.length > 26 ? 54 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 64px 0 72px",
          background: "radial-gradient(ellipse 80% 90% at 30% 45%, #f7f0e1 0%, #ede3cd 70%, #e2d5ba 100%)",
          fontFamily: FONT_BODY,
          color: "#3B3127",
        }}
      >
        {/* the book: its page block peeking out, then the cover */}
        <div style={{ display: "flex", position: "relative", width: W + 10, height: H + 10, flexShrink: 0 }}>
          <div style={{ display: "flex", position: "absolute", left: 12, top: 10, width: W - 4, height: H, borderRadius: "4px 12px 12px 4px", background: "#eadfc8", border: "1px solid rgba(80,60,40,0.25)" }} />
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              top: 0,
              width: W,
              height: H,
              padding: 18,
              borderRadius: "4px 12px 12px 4px",
              background: `linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 4.5%, rgba(255,220,180,0.08) 6%, rgba(0,0,0,0) 9%), radial-gradient(ellipse 90% 70% at 60% 35%, ${clothA} 0%, ${clothB} 70%)`,
              boxShadow: "0 30px 50px -20px rgba(40,18,10,0.6)",
            }}
          >
            <div style={{ display: "flex", flex: 1, border: `2px solid ${GILT}`, padding: 6 }}>
              <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid rgba(228,194,124,0.7)", padding: "18px 14px", color: GILT }}>
                <div style={{ display: "flex", fontFamily: FONT_CAPS, fontSize: 16, letterSpacing: 2 }}>A Taleo picture book</div>
                <div style={{ display: "flex", marginTop: 4 }}>
                  <Ornament color={GILT} />
                </div>
                <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontFamily: FONT_TITLE, fontSize: title.length > 34 ? 26 : title.length > 22 ? 32 : 38, lineHeight: 1.12, marginTop: 8, maxHeight: 92, overflow: "hidden", textShadow: "0 1px 1px rgba(0,0,0,0.55)" }}>
                  {title}
                </div>
                <div style={{ display: "flex", marginTop: 14, width: 250, height: 188, borderRadius: "50%", overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#ece2cb", border: `3px solid ${GILT}`, boxShadow: `0 0 0 5px ${clothB}` }}>
                  {flatCover ? (
                    <svg width={290} height={218} viewBox="0 0 400 300">
                      {svgToReact(flatCover)}
                    </svg>
                  ) : (
                    <div style={{ display: "flex", fontSize: 26, color: "#9A8A74", fontFamily: FONT_TITLE }}>Taleo</div>
                  )}
                </div>
                {starring && <div style={{ display: "flex", marginTop: 12, fontSize: 20, fontStyle: "italic" }}>Starring {starring}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* the details, as in the story's preview */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 2, color: "#9C4F32", fontFamily: FONT_CAPS }}>A Taleo Story</div>
          {keyword && (
            <div style={{ display: "flex", marginTop: 14 }}>
              <div style={{ display: "flex", padding: "3px 18px 5px", borderRadius: 999, border: `1.5px solid ${kw}`, color: kw, fontFamily: FONT_CAPS, fontSize: 22, letterSpacing: 1.5, background: "rgba(255,252,244,0.6)" }}>
                {keyword}
              </div>
            </div>
          )}
          <div style={{ display: "flex", fontFamily: FONT_TITLE, fontSize: titleSize, lineHeight: 1.08, marginTop: 14, maxHeight: titleSize * 1.08 * 3, overflow: "hidden" }}>{title}</div>
          <div style={{ display: "flex", fontSize: 28, marginTop: 18, color: "#5b4a3a" }}>
            {starring ? `Starring ${starring}` : ""}
            {starring && age ? "  ·  " : ""}
            {age ? `Ages ${age.label}` : ""}
          </div>
          <div style={{ display: "flex", fontSize: 26, marginTop: 8, color: "#6B5A48" }}>
            {`${minutes} min read${pages.length ? `  ·  ${pages.length} ${pages.length === 1 ? "page" : "pages"}` : ""}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
            {count ? (
              <>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} filled={n <= Math.round(avg)} />
                ))}
                <div style={{ display: "flex", fontSize: 26, marginLeft: 10, color: "#6B5A48" }}>{`${avg.toFixed(1)} · ${count} rating${count === 1 ? "" : "s"}`}</div>
              </>
            ) : (
              <div style={{ display: "flex", fontSize: 26, fontStyle: "italic", color: "#6B5A48" }}>A new story, painted just for you</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 34 }}>
            <div style={{ display: "flex", fontSize: 26, fontStyle: "italic", color: "#6B5A48" }}>{`by @${author}`}</div>
            <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontFamily: FONT_TITLE, color: "#3B3127" }}>
              <MapleLeaf />
              Taleo
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
