import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import type { DeployedCommit, Deployment } from "@/lib/deployment";

export const dynamic = "force-dynamic";

/** What's live (admin only): the version and commit this deployment was
 *  built from, when, and the log of what changed - for the marker at the
 *  foot of the admin's account menu. Anyone else: a plain "not found". */
export async function GET() {
  if (!(await currentAdmin())) return new NextResponse(null, { status: 404 });
  let built: { version?: string; sha?: string; branch?: string; previousSha?: string; builtAt?: string; commits?: DeployedCommit[] } = {};
  try {
    built = JSON.parse(process.env.TALEO_BUILD_INFO || "{}");
  } catch {}
  const commits = built.commits ?? [];
  const before = built.previousSha ? commits.findIndex((c) => c.sha === built.previousSha) : -1;
  const info: Deployment = {
    version: built.version ?? "",
    sha: built.sha ?? "",
    branch: built.branch ?? "",
    builtAt: built.builtAt ?? "",
    environment: process.env.VERCEL_ENV || "local",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    region: process.env.VERCEL_REGION || null,
    fresh: before > 0 ? before : null,
    commits,
  };
  return NextResponse.json(info, { headers: { "cache-control": "private, no-store" } });
}
