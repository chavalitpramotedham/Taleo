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
  const counted = Number(git("rev-list", "--count", `--since=${since}`, "HEAD")) || 1;
  // (Vercel's copy of the code holds only the last few commits, so on a busy
  // day that count stops at about ten: a live build counts itself instead -
  // see liveBuildNumber - and the count above is only the fallback)
  const pushes = liveBuildNumber(minor, Math.max(counted, SEEN[minor] ?? 0)) ?? counted;
  return `1.${minor}.${Math.max(0, pushes - 1)}`;
}

/** Pushes already made on a day before builds counted themselves (day 1:
 *  12 November 2026, GMT+8). */
const SEEN: Record<number, number> = { 1: 89 };

/**
 * A live (production) build's number within its day: 1 for the day's
 * first, then 2, 3... - counted in the app's own Redis store, which every
 * build can reach, and the same number again if the same commit is built
 * twice. `atLeast`: where the day's count starts, if this is its first
 * build. Null on any other build, or if the store can't be reached (the
 * version then comes from the commits the build has).
 */
function liveBuildNumber(day: number, atLeast: number): number | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.VERCEL_ENV !== "production" || !url || !token || !sha) return null;
  const script = [
    "local n = redis.call('GET', KEYS[2]) if n then return tonumber(n) end",
    "if redis.call('EXISTS', KEYS[1]) == 0 then redis.call('SET', KEYS[1], tonumber(ARGV[1]) - 1) end",
    "n = redis.call('INCR', KEYS[1]) redis.call('EXPIRE', KEYS[1], 864000) redis.call('SET', KEYS[2], n, 'EX', 2592000) return n",
  ].join(" ");
  const command = JSON.stringify(["EVAL", script, "2", `version:day:${day}`, `version:sha:${sha}`, String(Math.max(1, atLeast))]);
  // (the config is read without waiting, so the store is asked from a
  // short-lived child process, which waits at most a few seconds)
  const ask = `fetch(${JSON.stringify(url.replace(/\/$/, ""))},{method:"POST",headers:{Authorization:"Bearer "+process.env.T,"Content-Type":"application/json"},body:process.env.C,signal:AbortSignal.timeout(4000)}).then(r=>r.json()).then(d=>process.stdout.write(String(d.result??""))).catch(()=>{})`;
  try {
    const out = execFileSync(process.execPath, ["-e", ask], { encoding: "utf8", env: { ...process.env, T: token, C: command }, timeout: 6000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    const n = Number(out);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
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
    // Every page and answer: not to be shown inside another site's frame
    // (a page dressed up around ours to trick a tap), files taken for
    // what they say they are, the address of a private page not passed on
    // to other sites, and no use of the camera or location - nothing here
    // needs them (the microphone is used, for saying a story idea aloud).
    const safe = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
    ];
    return [
      { source: "/:path*", headers: safe },
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
