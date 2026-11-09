import { createElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { sanitizeSvgFlat } from "@/lib/svg-sanitize";
import { loadBrandFonts } from "@/server/og-fonts";
import { clothFor } from "@/lib/cover";

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

const GILT = "#e4c27c";

/** A shared story's link preview is its book cover, just as it looks in
 *  the app: cloth-bound in the story's own colour, with a double gilt
 *  frame, the stamped title, the first page's painting in an oval and who
 *  it stars - set on a warm table, centred, so chat apps that crop the
 *  preview to a square still show the whole book. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id, { cacheSeconds: 86400 });

  const title = story?.title || "A Taleo story";
  const cover = story ? (allPages(story).find((p) => p.svg)?.svg ?? null) : null;
  const flatCover = cover ? sanitizeSvgFlat(cover) : "";
  const names = story ? [story.hero, ...(story.companions ?? [])].map((h) => h.name) : [];
  const starring = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0];
  const [clothA, clothB] = clothFor(id);
  const fonts = await loadBrandFonts();
  const FONT_TITLE = "IM Fell English";
  const FONT_CAPS = "IM Fell English SC";
  const FONT_BODY = "EB Garamond";
  const W = 438; // the book: 3:4, nearly the card's full height
  const H = 584;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse 70% 80% at 50% 45%, #f7f0e1 0%, #eadfc8 70%, #ddcfb3 100%)",
          fontFamily: FONT_BODY,
        }}
      >
        {/* the page block peeking out on the right, then the cover */}
        <div style={{ display: "flex", position: "relative", width: W + 10, height: H + 10 }}>
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 12,
              top: 10,
              width: W - 4,
              height: H,
              borderRadius: "4px 12px 12px 4px",
              background: "#eadfc8",
              border: "1px solid rgba(80,60,40,0.25)",
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              top: 0,
              width: W,
              height: H,
              padding: 20,
              borderRadius: "4px 12px 12px 4px",
              background: `linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 4.5%, rgba(255,220,180,0.08) 6%, rgba(0,0,0,0) 9%), radial-gradient(ellipse 90% 70% at 60% 35%, ${clothA} 0%, ${clothB} 70%)`,
              boxShadow: "0 30px 50px -20px rgba(40,18,10,0.6)",
            }}
          >
            {/* the double gilt frame */}
            <div style={{ display: "flex", flex: 1, border: `2px solid ${GILT}`, padding: 7 }}>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid rgba(228,194,124,0.7)`,
                  padding: "26px 18px 18px",
                  color: GILT,
                }}
              >
                <div style={{ display: "flex", fontFamily: FONT_CAPS, fontSize: 19, letterSpacing: 2.5, opacity: 0.9 }}>A Taleo picture book</div>
                <div style={{ display: "flex", marginTop: 6 }}>
                  <Ornament color={GILT} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    textAlign: "center",
                    fontFamily: FONT_TITLE,
                    fontSize: title.length > 34 ? 32 : title.length > 22 ? 38 : 46,
                    lineHeight: 1.12,
                    marginTop: 12,
                    maxHeight: 110,
                    overflow: "hidden",
                    textShadow: "0 1px 1px rgba(0,0,0,0.55)",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    width: 290,
                    height: 218,
                    borderRadius: "50%",
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ece2cb",
                    border: `3px solid ${GILT}`,
                    boxShadow: `0 0 0 5px ${clothB}`,
                  }}
                >
                  {flatCover ? (
                    <svg width={336} height={252} viewBox="0 0 400 300">
                      {svgToReact(flatCover)}
                    </svg>
                  ) : (
                    <div style={{ display: "flex", fontSize: 30, color: "#9A8A74", fontFamily: FONT_TITLE }}>Taleo</div>
                  )}
                </div>
                {starring && (
                  <div style={{ display: "flex", marginTop: 16, fontSize: 24, fontStyle: "italic" }}>Starring {starring}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
