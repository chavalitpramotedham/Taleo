"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** A painting in the activity log, small: a tap opens it full size over
 *  the page (✕, Esc or a tap outside closes it). `record` links on to
 *  the request it came from. */
export function ZoomPicture({ src, className, width, height, lazy = false, record, label }: {
  src: string;
  className: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  record?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <>
      <button type="button" className="admin-zoom" onClick={() => setOpen(true)} aria-label={`See ${label} full size`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={className} src={src} alt="" loading={lazy ? "lazy" : undefined} decoding="async" width={width} height={height} />
      </button>
      {open &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div className="modal-panel admin-zoom-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}>
              <div className="modal-head">
                <h3>{label}</h3>
                <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                  ✕
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="admin-zoom-picture" src={src} alt={label} />
              {record && (
                <p className="meta admin-zoom-more">
                  <Link href={record}>Open this painting&apos;s record</Link>
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
