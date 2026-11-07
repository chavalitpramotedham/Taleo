import { createElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { getGalleryStory } from "@/server/gallery";
import { allPages } from "@/lib/story-utils";
import { sanitizeSvgFlat } from "@/lib/svg-sanitize";

export const size = { width: 1200, height: 630 };
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
    <svg width={34} height={34} viewBox="0 0 24 24" style={{ margin: "0 2px" }}>
      <path d={STAR} fill={filled ? "#C49A3E" : "none"} stroke="#C49A3E" strokeWidth={1.3} />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getGalleryStory(id);

  const title = story?.title || "A Taleo story";
  const cover = story ? (allPages(story).find((p) => p.svg)?.svg ?? null) : null;
  const flatCover = cover ? sanitizeSvgFlat(cover) : "";
  const count = story?.ratingCount ?? 0;
  const avg = count ? Math.round((story!.ratingSum! / count) * 10) / 10 : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 48,
          padding: 56,
          background: "#F3ECDC",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 480,
            height: 480,
            flexShrink: 0,
            background: "#FBF7EE",
            border: "2px solid #ECE2CC",
            borderRadius: 4,
            padding: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {flatCover ? (
            <svg width={448} height={336} viewBox="0 0 400 300">
              {svgToReact(flatCover)}
            </svg>
          ) : (
            <div style={{ fontSize: 28, color: "#9A8A74" }}>Taleo</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 2, color: "#9C4F32", marginBottom: 14 }}>A TALEO STORY</div>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 28 ? 52 : 64,
              color: "#3B3127",
              lineHeight: 1.1,
              marginBottom: 28,
              maxHeight: 220,
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} filled={n <= Math.round(avg)} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#6B5A48", marginTop: 10, fontStyle: "italic" }}>
            {count ? `${avg.toFixed(1)} · ${count} rating${count === 1 ? "" : "s"}` : "A new story, painted just for you"}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: "auto", fontSize: 34, color: "#3B3127" }}>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: "#9C4F32", marginRight: 12 }} />
            Taleo
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
