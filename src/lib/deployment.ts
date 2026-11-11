/** What's live, as the admin's marker and its dialog show it (see
 *  app/api/admin/deployment, and next.config.ts where it's noted). */
export interface DeployedCommit {
  sha: string;
  /** When it was committed (ISO), where known. */
  at: string;
  subject: string;
  /** The rest of the commit message: what changed, as it was logged. */
  body: string;
}
/** How the open page stands to what's live: "live" (reachable, and this
 *  page is the version that's live), "update" (a newer version has gone
 *  live since this page was opened), "offline" (the site can't be reached
 *  from here just now). */
export type LiveStatus = "live" | "update" | "offline";

export interface Deployment {
  /** (set in the browser: see DeploymentMarker) */
  status?: LiveStatus;
  /** package.json's version. */
  version: string;
  /** The commit the live site was built from. */
  sha: string;
  branch: string;
  /** When it was built (ISO): to within a minute or so, when it went live. */
  builtAt: string;
  /** "production", "preview"... (Vercel), or "local". */
  environment: string;
  /** Vercel's own name for this deployment, and its address. */
  deploymentId: string | null;
  url: string | null;
  region: string | null;
  /** How many of `commits` (from the top) arrived with this deployment;
   *  null where that isn't known. */
  fresh: number | null;
  /** The newest commits, the live one first. */
  commits: DeployedCommit[];
}
