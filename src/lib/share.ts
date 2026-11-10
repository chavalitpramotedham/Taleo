
/** The story's own page in the public store (used for in-app navigation). */
export function storeUrl(id: string, origin: string): string {
  return `${origin}/store/${id}`;
}

/** The link people share: it lands on the homepage, which greets the
 *  visitor with a welcome popup about the story (title, key details and a
 *  "Start reading" button) instead of dropping them straight onto page 1. */
export function shareUrl(id: string, origin: string): string {
  return `${origin}/?story=${encodeURIComponent(id)}`;
}

/** Opens the device's native share sheet for a story link, falling back to
 *  the clipboard (via `onCopied`) wherever Web Share isn't available. */
export async function shareStory(title: string, url: string, onCopied: () => void): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      // Cancelled or blocked - no fallback needed, the sheet handled it.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    onCopied();
  } catch {
    window.prompt("Copy this link to share:", url);
  }
}
