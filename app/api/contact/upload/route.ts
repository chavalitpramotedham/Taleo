import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/server/auth";
import { CONTACT_FILE_TYPES, CONTACT_MAX_FILE_MB, isMediaType } from "@/lib/contact";

export const runtime = "nodejs";

/**
 * Attachment uploads for the Contact page.
 *  - Production (BLOB_READ_WRITE_TOKEN set): the Vercel Blob client-upload
 *    handshake. The browser uploads straight to blob storage (so large
 *    videos skip the ~4.5 MB serverless request limit); this route only
 *    issues a short-lived, signed-in-only token restricted to images and
 *    videos under the size cap, in the contact/ folder.
 *  - Development: a simple fallback that saves the raw file under .data/.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const body = (await req.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          if (!pathname.startsWith("contact/")) throw new Error("Bad upload path.");
          return {
            allowedContentTypes: CONTACT_FILE_TYPES,
            maximumSizeInBytes: CONTACT_MAX_FILE_MB * 1024 * 1024,
            addRandomSuffix: true,
          };
        },
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 400 });
    }
  }

  // ---- local development fallback ----
  const type = req.headers.get("content-type") || "";
  const name = decodeURIComponent(req.headers.get("x-filename") || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  if (!isMediaType(type)) return NextResponse.json({ error: "Only images and videos, please." }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > CONTACT_MAX_FILE_MB * 1024 * 1024) return NextResponse.json({ error: "That file is too large." }, { status: 413 });
  const dir = path.join(process.cwd(), ".data", "contact", "files");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${Date.now().toString(36)}-${name}`), buf);
  return NextResponse.json({ url: null });
}
