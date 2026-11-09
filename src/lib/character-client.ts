import type { CharacterResponse } from "@/lib/types";

/** How far a character's design has got (streamed from /api/character). */
export type CharacterProgress = { stage: "thinking" } | { stage: "sheet" } | { stage: "painting"; shapes: number };

/** Ask for a character to be designed (or redrawn), reporting progress as it
 *  streams in. Resolves with the finished character; throws with a
 *  friendly message on failure. */
export async function requestCharacter(body: unknown, onProgress: (p: CharacterProgress) => void): Promise<CharacterResponse> {
  const res = await fetch("/api/character", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Refused before it started (signed out, over the limit, no description).
  if (!res.ok || !res.headers.get("content-type")?.includes("ndjson") || !res.body) {
    const data = (await res.json().catch(() => ({}))) as CharacterResponse & { error?: string };
    if (!res.ok || !data.character) throw new Error(data.error || "Couldn't paint that one. Try again?");
    return data;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as ({ type: "progress" } & CharacterProgress) | ({ type: "done" } & CharacterResponse) | { type: "error"; error: string };
      if (msg.type === "progress") onProgress(msg);
      else if (msg.type === "error") throw new Error(msg.error);
      else if (msg.type === "done") {
        if (!msg.character) throw new Error("Couldn't paint that one. Try again?");
        return { character: msg.character };
      }
    }
    if (done) break;
  }
  throw new Error("The painting was interrupted. Please try again.");
}
