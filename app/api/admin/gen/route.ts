import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { getGen } from "@/server/genlog";

export const dynamic = "force-dynamic";

/** One activity-log record (admin only): for the comparison bench, which
 *  reads back each painting's model calls - tokens, times, cost. The
 *  picture itself is left out (the bench already has it). */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return new NextResponse(null, { status: 404 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[\w-]{4,60}$/.test(id)) return NextResponse.json({ error: "No such record." }, { status: 400 });
  const got = await getGen(id).catch(() => null);
  if (!got) return NextResponse.json({ error: "Not written yet." }, { status: 404, headers: { "cache-control": "no-store" } });
  const { record } = got;
  // (?picture=1: the painting too, for a bench run opened again later)
  const withPicture = new URL(req.url).searchParams.get("picture") === "1";
  return NextResponse.json(
    { status: record.status, summary: record.summary, firstMs: record.firstMs, totalMs: record.totalMs, usdMicro: record.usdMicro, calls: record.calls, cases: record.cases, ...(withPicture ? { svg: got.result } : {}) },
    { headers: { "cache-control": "no-store" } },
  );
}
