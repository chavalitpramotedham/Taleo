"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** One painting the dialog can show. */
/** A picture to show full size. `label` names it for screen readers (and
 *  is its heading when it has no `title`); `title` is a short heading
 *  ("Painting", "Character"); `caption` is what was asked for, set under
 *  the picture in ordinary text - a long one would crowd the heading and
 *  squeeze the close button. */
export type ZoomItem = { src: string; label: string; record?: string; title?: string; caption?: string };

/** The paintings of one list, in order: a tap on any of them opens the
 *  dialog there, and ‹ › (or the arrow keys, or a sideways swipe) step
 *  through the rest. */
const List = createContext<((index: number) => void) | null>(null);

export function ZoomList({ items, children }: { items: ZoomItem[]; children: React.ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  return (
    <List.Provider value={setAt}>
      {children}
      {at !== null && items[at] && <ZoomDialog items={items} at={at} onStep={setAt} onClose={() => setAt(null)} />}
    </List.Provider>
  );
}

/** The small pictures are flattened one at a time, each in a moment the
 *  browser has to spare (never several in one go, and never while it is
 *  busy scrolling): drawing a painting once is a few milliseconds of
 *  work, which a list of them arriving together would add up. */
const waiting: (() => void)[] = [];
let turning = false;
function inTurn(job: () => void) {
  waiting.push(job);
  if (turning) return;
  turning = true;
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 80));
  const next = () => {
    const one = waiting.shift();
    if (!one) return void (turning = false);
    one();
    idle(next, { timeout: 4000 });
  };
  idle(next, { timeout: 4000 });
}

/** A painting in the activity log, small: a tap opens it full size over
 *  the page (✕, Esc or a tap outside closes it). Inside a ZoomList it
 *  opens at its place in that list (`index`); on its own, just itself. */
export function ZoomPicture({ src, className, width, height, lazy = false, record, label, title, caption, index }: ZoomItem & {
  className: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  index?: number;
}) {
  const list = useContext(List);
  const [alone, setAlone] = useState(false);
  const open = () => (list && index !== undefined ? list(index) : setAlone(true));
  // A small one in a list is shown as a flat picture, not the drawing
  // itself. A painting is hundreds of soft shapes, and as a drawing every
  // one of them is drawn again each time its row is scrolled into a fresh
  // strip of the screen - a long log of them made scrolling stutter, and
  // more so once some had been opened full size. So once a small one has
  // arrived it is drawn a single time onto a canvas at the size it's
  // shown, and that still image takes its place (the full-size view still
  // opens the drawing itself, sharp at any size).
  const small = Boolean(lazy && width && height);
  const [flat, setFlat] = useState<string | null>(null);
  const made = useRef<string | null>(null);
  useEffect(() => () => void (made.current && URL.revokeObjectURL(made.current)), []);
  const flatten = (img: HTMLImageElement) => {
    if (!small || made.current || !img.naturalWidth || img.src.startsWith("blob:")) return;
    made.current = "pending";
    inTurn(() => {
      try {
        if (!img.isConnected) return;
        const scale = Math.min(2, window.devicePixelRatio || 1);
        const c = document.createElement("canvas");
        c.width = Math.round(width! * scale);
        c.height = Math.round(height! * scale);
        const g = c.getContext("2d");
        if (!g) return;
        // (as the small picture shows it: whole, centred, on its paper)
        const fit = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
        const w = img.naturalWidth * fit;
        const h = img.naturalHeight * fit;
        g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        c.toBlob(
          (blob) => {
            if (!blob) return;
            made.current = URL.createObjectURL(blob);
            setFlat(made.current);
          },
          "image/webp",
          0.86,
        );
      } catch {
        // (a drawing the browser won't let be copied: it stays a drawing)
      }
    });
  };
  return (
    <>
      <button type="button" className="admin-zoom" onClick={open} aria-label={`See ${label} full size`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={className} src={flat ?? src} alt="" loading={lazy ? "lazy" : undefined} decoding="async" width={width} height={height} onLoad={(e) => flatten(e.currentTarget)} ref={(el) => void (el?.complete && flatten(el))} />
      </button>
      {alone && <ZoomDialog items={[{ src, label, record, title, caption }]} at={0} onStep={() => {}} onClose={() => setAlone(false)} />}
    </>
  );
}

function ZoomDialog({ items, at, onStep, onClose }: { items: ZoomItem[]; at: number; onStep: (i: number) => void; onClose: () => void }) {
  const item = items[at];
  const prev = at > 0 ? () => onStep(at - 1) : undefined;
  const next = at < items.length - 1 ? () => onStep(at + 1) : undefined;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prev) (e.preventDefault(), prev());
      else if (e.key === "ArrowRight" && next) (e.preventDefault(), next());
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, prev, next]);
  // (the paintings either side are fetched ahead, so a step shows at once)
  useEffect(() => {
    for (const i of [at - 1, at + 1]) if (items[i]) new Image().src = items[i].src;
  }, [at, items]);
  // A sideways swipe steps too.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const dx = e.changedTouches[0].clientX - from.x;
    const dy = e.changedTouches[0].clientY - from.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next?.();
    else prev?.();
  };
  const stepping = items.length > 1;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="admin-zoom-wrap" onClick={(e) => e.stopPropagation()}>
        {stepping && (
          <>
            <button type="button" className="preview-step admin-zoom-step admin-zoom-prev" onClick={prev} disabled={!prev} aria-label="Previous painting">
              ‹
            </button>
            <button type="button" className="preview-step admin-zoom-step admin-zoom-next" onClick={next} disabled={!next} aria-label="Next painting">
              ›
            </button>
          </>
        )}
        <div
          className="modal-panel admin-zoom-panel"
          role="dialog"
          aria-modal="true"
          aria-label={item.label}
          onTouchStart={stepping ? onTouchStart : undefined}
          onTouchEnd={stepping ? onTouchEnd : undefined}
        >
          <div className="modal-head">
            <h3>{item.title ?? item.label}</h3>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={item.src} className="admin-zoom-picture" src={item.src} alt={item.label} />
          {item.caption && <p className="admin-zoom-caption">{item.caption}</p>}
          <p className="meta admin-zoom-more">
            {stepping && (
              <span className="admin-zoom-count">
                {at + 1} of {items.length}
              </span>
            )}
            {item.record && <Link href={item.record}>Open this picture&apos;s record</Link>}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
