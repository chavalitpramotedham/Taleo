"use client";
import { quotaLine, useStoryAllowance } from "@/lib/allowance";

/**
 * The small line under a "Begin a story" button once the plan's stories
 * are used up: "Story limit reached. Refreshes in about 5 hours." The
 * button itself stays as it is (it opens the wizard, which explains and
 * offers what can still be done). Shows nothing while there's room.
 */
export function QuotaNote({ className = "" }: { className?: string }) {
  const line = quotaLine(useStoryAllowance());
  if (!line) return null;
  return (
    <p className={`quota-note ${className}`.trim()} role="note">
      {line}
    </p>
  );
}
