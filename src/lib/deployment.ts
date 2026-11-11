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
export interface Deployment {
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
