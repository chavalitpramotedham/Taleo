"use client";
import { sanitizeSvg } from "./svg-sanitize";

/**
 * Saves a character's painting as a picture: rendered with the site's own
 * watercolour filters to a PNG, then offered through the phone's share
 * sheet (where "Save Image" puts it in the camera roll) or, where that
 * isn't available, downloaded as a file.
 */
export async function saveCharacterImage(svgMarkup: string, name: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const SIZE = 1024;
  // The paint filters live once in the page (PaintDefs); a standalone
  // picture needs its own copy.
  const defs = document.querySelector("#tl-wash")?.closest("svg")?.innerHTML ?? "";
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${SIZE}" height="${SIZE}">` +
    `<rect width="200" height="200" fill="#fbf7ee"/>${defs}<g>${sanitizeSvg(svgMarkup)}</g></svg>`;
  const url = URL.createObjectURL(new Blob([doc], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.getContext("2d")!.drawImage(img, 0, 0, SIZE, SIZE);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
    const fileName = `${name.replace(/[^\w\- ]+/g, "").trim() || "character"} - Taleo.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return "shared";
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return "cancelled";
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return "downloaded";
  } finally {
    URL.revokeObjectURL(url);
  }
}
