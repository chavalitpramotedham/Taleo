import { auth } from "@/server/auth";
import { getGen } from "@/server/genlog";

/** A painting from the activity log, as an image (admin only): the list
 *  shows each one small, fetched only as its row comes into view. A
 *  finished record never changes, so the browser keeps it. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) return new Response(null, { status: 404 });
  const { id } = await ctx.params;
  const found = await getGen(id).catch(() => null);
  const result = found?.record.kind === "painting" ? found.result : null;
  if (!result || !/^\s*</.test(result)) return new Response(null, { status: 404 });
  // (a page's painting is kept as it was sent: the shapes alone, on the
  // book's 400 by 300 sheet; one cut short at the log's limit loses its
  // tail note so what was painted still draws)
  const shapes = result.replace(/\n… \(cut: \d+ characters in all\)$/, "");
  const svg = /^\s*<svg[\s>]/.test(shapes) ? shapes : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${shapes}</svg>`;
  const done = found!.record.status !== "running";
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
