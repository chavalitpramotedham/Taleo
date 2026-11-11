import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import pkg from "./package.json";

/**
 * What this build is, noted as it's built, for the admin's "what's live"
 * marker (see app/api/admin/deployment): the commit it was built from,
 * when, and the last few commits with their full messages - the log of
 * what changed. Read from git where the build has it (Vercel's has the
 * last ten commits), else from what Vercel says about the one commit.
 * Only the admin-only route reads it, so it is in no page's scripts.
 */
/**
 * The version, worked out from the calendar and the pushes - nobody has to
 * remember to change it:
 *
 *   1 . days since launch . pushes that day
 *
 * The middle number goes up by one at each midnight in GMT+8 (whether or
 * not anything was pushed that day); the last goes up by one with each
 * push and starts again at 0 with the day's first. The release that
 * introduced this is 1.0.0. It is read from the commit being built (its
 * own date, not the time of building), so building the same commit again
 * gives the same version.
 */
const LAUNCH = Date.parse("2026-11-11T14:55:00Z"); // (the first 1.0.0: commits from here on count)
const ZONE_MS = 8 * 3600_000; // GMT+8
const DAY_MS = 86_400_000;
const dayOf = (t: number) => Math.floor((t + ZONE_MS) / DAY_MS);
function versionOf(git: (...args: string[]) => string, headAt?: string): string | null {
  const at = Date.parse(headAt || git("log", "-1", "--format=%cI"));
  if (!Number.isFinite(at) || at < LAUNCH) return null;
  const minor = dayOf(at) - dayOf(LAUNCH);
  // The day's pushes: commits since its midnight (or, on launch day, since
  // the launch). A build may have only the last few commits - ask for the
  // rest of the day's first, and count what's there if that can't be had.
  const since = new Date(Math.max(LAUNCH, dayOf(at) * DAY_MS - ZONE_MS)).toISOString();
  if (git("rev-parse", "--is-shallow-repository") === "true") git("fetch", "--quiet", `--shallow-since=${since}`, "origin", "HEAD");
  const pushes = Number(git("rev-list", "--count", `--since=${since}`, "HEAD")) || 1;
  return `1.${minor}.${Math.max(0, pushes - 1)}`;
}

function buildInfo() {
  const git = (...args: string[]) => {
    try {
      return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 4 << 20 }).trim();
    } catch {
      return "";
    }
  };
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);
  // (unit and record separators: nothing a commit message contains)
  const log = git("log", "-n", "12", "--format=%H%x1f%cI%x1f%s%x1f%b%x1e");
  let commits = log
    .split("\x1e")
    .map((row) => row.replace(/^\s+/, "").split("\x1f"))
    .filter((f) => f.length >= 4 && f[0])
    .map(([sha, at, subject, body]) => ({ sha, at, subject: clip(subject, 300), body: clip(body.trim(), 6000) }));
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || commits[0]?.sha || "";
  if (!commits.length && sha) {
    const [subject = "", ...rest] = (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n");
    commits = [{ sha, at: "", subject: clip(subject, 300), body: clip(rest.join("\n").trim(), 6000) }];
  }
  return {
    version: versionOf(git, commits[0]?.at) ?? pkg.version,
    sha,
    branch: process.env.VERCEL_GIT_COMMIT_REF || git("rev-parse", "--abbrev-ref", "HEAD"),
    // (the commit the deployment before this one was built from, where
    // Vercel says: everything after it arrived with this deployment)
    previousSha: process.env.VERCEL_GIT_PREVIOUS_SHA || "",
    builtAt: new Date().toISOString(),
    commits,
  };
}

const built = buildInfo();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // (the log is read only by the admin-only route; the short commit id is
  // in the page itself, so an open page can tell when a newer version has
  // gone live)
  env: { TALEO_BUILD_INFO: JSON.stringify(built), TALEO_BUILD_SHA: built.sha.slice(0, 12) },
  // The library's old address: a real permanent redirect (308), answered
  // before any page is rendered, so search engines move the address over.
  async redirects() {
    return [{ source: "/library", destination: "/store", permanent: true }];
  },
  async headers() {
    // The paintings and pictures the pages are made of: kept by the browser
    // for a week (and shown from its copy while a newer one is fetched), so
    // a returning reader's page doesn't ask about each of them again.
    const kept = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }];
    return [
      { source: "/art/:path*", headers: kept },
      { source: "/steps/:path*", headers: kept },
      { source: "/about/:path*", headers: kept },
      {
        // The service worker: always checked afresh (a browser must never
        // hold on to an old one), and allowed to run only our own code.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
