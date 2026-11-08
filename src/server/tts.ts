import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Neural read-aloud voice, so stories are read by a calm, well-spoken
 * British voice on every device instead of whatever robotic system voice
 * the browser happens to have.
 *
 * Uses Azure AI Speech (neural text-to-speech). Each distinct phrase is
 * synthesised once and cached (Vercel Blob in production, .data/ locally),
 * so a story's pages and words cost nothing to replay.
 *
 * Environment:
 *   AZURE_SPEECH_KEY     - enables it (without it, the browser voice is used).
 *   AZURE_SPEECH_REGION  - the resource's region, e.g. "uksouth".
 *   TTS_VOICE            - optional, default "en-GB-SoniaNeural". Other good
 *                          British options: en-GB-LibbyNeural, en-GB-AbbiNeural,
 *                          en-GB-HollieNeural, en-GB-BellaNeural.
 */

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || "uksouth";
export const TTS_VOICE = process.env.TTS_VOICE || "en-GB-SoniaNeural";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export const ttsEnabled = () => Boolean(KEY);
export type TtsKind = "page" | "word";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Unhurried and warm for reading a page; slower and clearer for a single word. */
function ssml(text: string, kind: TtsKind) {
  const prosody = kind === "word" ? `rate="-22%" pitch="+2%"` : `rate="-8%" pitch="-1%"`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><voice name="${esc(TTS_VOICE)}"><prosody ${prosody}>${esc(text)}</prosody></voice></speak>`;
}

const cacheKey = (text: string, kind: TtsKind) =>
  `tts/${TTS_VOICE}/${createHash("sha256").update(`${kind}\n${text}`).digest("hex").slice(0, 32)}.mp3`;

async function readCache(key: string): Promise<Buffer | null> {
  try {
    if (BLOB_TOKEN) {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: key, token: BLOB_TOKEN, limit: 1 });
      const blob = blobs.find((b) => b.pathname === key);
      if (!blob) return null;
      const res = await fetch(blob.url);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    return await fs.readFile(path.join(process.cwd(), ".data", key));
  } catch {
    return null;
  }
}

async function writeCache(key: string, audio: Buffer) {
  try {
    if (BLOB_TOKEN) {
      const { put } = await import("@vercel/blob");
      await put(key, audio, { access: "public", contentType: "audio/mpeg", addRandomSuffix: false, allowOverwrite: true, token: BLOB_TOKEN });
      return;
    }
    const file = path.join(process.cwd(), ".data", key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, audio);
  } catch (e) {
    console.error("[tts] couldn't cache clip", e);
  }
}

/** MP3 audio for a phrase, from the cache or freshly synthesised. */
export async function speechClip(text: string, kind: TtsKind): Promise<Buffer> {
  const key = cacheKey(text, kind);
  const cached = await readCache(key);
  if (cached) return cached;
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "taleo",
    },
    body: ssml(text, kind),
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text().catch(() => "")}`);
  const audio = Buffer.from(await res.arrayBuffer());
  await writeCache(key, audio);
  return audio;
}
