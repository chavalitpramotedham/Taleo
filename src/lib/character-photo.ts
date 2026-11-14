/** A photo of the character's subject, sent with a character request to
 *  guide the painting. Made smaller and re-saved on the device before it's
 *  sent (which also drops its location and other camera details), and
 *  never kept anywhere: it lives only for the one request. */
export type CharacterPhoto = {
  data: string;
  type: "image/jpeg" | "image/webp";
  /** The parent circled who they mean (a photo with several people or
   *  things in it): the photo is cropped around the circle, which is drawn
   *  on it, and only the one inside it is painted. */
  marked?: boolean;
};

/** A point on a photo, as a fraction of its width and height (0-1). */
export type PhotoPoint = { x: number; y: number };

/** The most a photo may weigh once prepared (bytes, before base64). */
export const PHOTO_MAX_BYTES = 1_500_000;
/** Its longest side once prepared - plenty for colours and features, and
 *  about a thousand tokens for the model. */
export const PHOTO_SIDE = 1024;
/** The most a chosen file may weigh before it's even opened. */
const FILE_MAX_BYTES = 30_000_000;

/** An error message that's about the photo (no clear single subject, or
 *  nothing matching the description), as opposed to the painting failing:
 *  the creator offers to go on without it or to choose another. */
export const PHOTO_PROBLEM = "photo-problem:";
export class PhotoProblem extends Error {}

/** Shrink and re-save a chosen photo in the browser. Throws with a
 *  friendly message if it can't be opened. */
export async function preparePhoto(file: File): Promise<CharacterPhoto & { preview: string; bytes: number }> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name)) throw new Error("That isn't a photo. Please choose a picture.");
  if (file.size > FILE_MAX_BYTES) throw new Error("That photo is too big to use. Please choose a smaller one.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That photo couldn't be opened. Please try another (a JPEG or PNG works best).");
  }
  const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("That photo couldn't be opened. Please try another.");
  // (a white ground for any transparent parts, so they don't turn black)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return encode(canvas);
}

/** The colour the circle is drawn in on the photo (and named in the
 *  painter's instructions). */
export const MARK_COLOUR = "#ff2d55";

/** The photo cropped around the loop the parent drew round who they mean,
 *  with that loop drawn on it (in a bright pink-red the painter is told
 *  about, over a white edge so it shows on any photo). Some of what's
 *  around them is kept, so they're seen in their setting. */
export async function markPhoto(preview: string, loop: PhotoPoint[]): Promise<CharacterPhoto & { preview: string; bytes: number }> {
  const img = new Image();
  img.src = preview;
  await img.decode().catch(() => {
    throw new Error("That photo couldn't be read. Please try another.");
  });
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const xs = loop.map((p) => p.x * W);
  const ys = loop.map((p) => p.y * H);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // (a margin of about a third of the loop's size on each side, and never
  // a sliver: at least a quarter of the photo's longer side)
  const pad = Math.max((x1 - x0 + y1 - y0) / 6, 0);
  const least = Math.max(W, H) / 4;
  let [l, r, t, b] = [x0 - pad, x1 + pad, y0 - pad, y1 + pad];
  if (r - l < least) [l, r] = [(l + r) / 2 - least / 2, (l + r) / 2 + least / 2];
  if (b - t < least) [t, b] = [(t + b) / 2 - least / 2, (t + b) / 2 + least / 2];
  l = Math.max(0, Math.floor(l));
  t = Math.max(0, Math.floor(t));
  r = Math.min(W, Math.ceil(r));
  b = Math.min(H, Math.ceil(b));
  const cw = Math.max(1, r - l);
  const ch = Math.max(1, b - t);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("That photo couldn't be read. Please try another.");
  ctx.drawImage(img, l, t, cw, ch, 0, 0, cw, ch);
  const line = Math.max(4, Math.round(Math.max(cw, ch) / 110));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const trace = () => {
    ctx.beginPath();
    loop.forEach((p, i) => (i ? ctx.lineTo(p.x * W - l, p.y * H - t) : ctx.moveTo(p.x * W - l, p.y * H - t)));
    ctx.closePath();
  };
  trace();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = line * 2;
  ctx.stroke();
  trace();
  ctx.strokeStyle = MARK_COLOUR;
  ctx.lineWidth = line;
  ctx.stroke();
  return { ...(await encode(canvas)), marked: true };
}

/** A prepared photo's canvas saved small, as WebP where it can be. */
async function encode(canvas: HTMLCanvasElement): Promise<CharacterPhoto & { preview: string; bytes: number }> {
  const save = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let blob = await save("image/webp", 0.8);
  // (Safari before 17 can't write WebP and hands back PNG instead)
  if (!blob || blob.type !== "image/webp") blob = await save("image/jpeg", 0.82);
  for (let q = 0.7; blob && blob.size > PHOTO_MAX_BYTES && q >= 0.4; q -= 0.15) blob = await save("image/jpeg", q);
  if (!blob || blob.size > PHOTO_MAX_BYTES) throw new Error("That photo couldn't be made small enough. Please try another.");
  const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  const preview = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That photo couldn't be read. Please try another."));
    r.readAsDataURL(blob);
  });
  return { type, data: preview.slice(preview.indexOf(",") + 1), preview, bytes: blob.size };
}

/** The photo from a request body, checked: a WebP or JPEG of sensible
 *  size, or nothing. */
export function readPhoto(v: unknown): CharacterPhoto | null | "bad" {
  if (v == null) return null;
  const p = v as { data?: unknown; type?: unknown };
  if ((p.type !== "image/jpeg" && p.type !== "image/webp") || typeof p.data !== "string") return "bad";
  if (p.data.length > Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(p.data)) return "bad";
  return { type: p.type, data: p.data, ...((v as { marked?: unknown }).marked === true ? { marked: true } : {}) };
}
/** Bytes in a photo's base64 data. */
export const photoBytes = (p: CharacterPhoto) => Math.floor((p.data.length * 3) / 4);
