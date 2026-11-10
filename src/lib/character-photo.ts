/** A photo of the character's subject, sent with a character request to
 *  guide the painting. Made smaller and re-saved on the device before it's
 *  sent (which also drops its location and other camera details), and
 *  never kept anywhere: it lives only for the one request. */
export type CharacterPhoto = { data: string; type: "image/jpeg" | "image/webp" };

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
  return { type: p.type, data: p.data };
}
/** Bytes in a photo's base64 data. */
export const photoBytes = (p: CharacterPhoto) => Math.floor((p.data.length * 3) / 4);
