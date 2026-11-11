import { auth } from "@/server/auth";
import { getGen, pictureOf } from "@/server/genlog";

/** A picture from the activity log - a page's painting, or a character -
 *  as an image (admin only): the list shows each one small, fetched only
 *  as its row comes into view. A
 *  finished record never changes, so the browser keeps it. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) return new Response(null, { status: 404 });
  const { id } = await ctx.params;
  const found = await getGen(id).catch(() => null);
  const svg = found && pictureOf(found.record, found.result);
  if (!svg) return new Response(null, { status: 404 });
  const done = found.record.status !== "running";
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": done ? "private, max-age=86400, immutable" : "no-store",
      // (model-written markup: opened on its own it may run nothing)
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
