import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { blobUrl } from "./store";

/**
 * Neural read-aloud voice, so stories are read in a calm, well-spoken
 * British woman's voice on every device instead of whatever robotic system
 * voice the browser happens to have.
 *
 * Works with whichever provider has a key set (checked in this order):
 *
 *   ELEVENLABS_API_KEY  ElevenLabs - the most natural storytelling voices.
 *                       Default voice "Lily" (warm, velvety British).
 *                       TTS_VOICE = another voice id to change it.
 *   OPENAI_API_KEY      OpenAI gpt-4o-mini-tts - the cheapest; the tone and
 *                       British accent are set by a written instruction.
 *                       TTS_VOICE = one of OpenAI's voices (default "sage").
 *   AZURE_SPEECH_KEY    Azure AI Speech (+ AZURE_SPEECH_REGION).
 *                       TTS_VOICE default "en-GB-SoniaNeural".
 *
 * Each distinct phrase is synthesised once and cached (Vercel Blob in
 * production, .data/ locally), so a story's pages and words cost nothing to
 * replay - for anyone. Without any key, the browser's own voice is used.
 */

type Provider = "elevenlabs" | "openai" | "azure";
export type TtsKind = "page" | "word";

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || "uksouth";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const provider: Provider | null = ELEVEN_KEY ? "elevenlabs" : OPENAI_KEY ? "openai" : AZURE_KEY ? "azure" : null;

const DEFAULT_VOICE: Record<Provider, string> = {
  elevenlabs: "pFZP5JQG7iQjIQuC4Bku", // "Lily": warm British narration
  openai: "sage",
  azure: "en-GB-SoniaNeural",
};
const voice = provider ? process.env.TTS_VOICE || DEFAULT_VOICE[provider] : "";

export const ttsEnabled = () => provider !== null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

// The tone, written once for every provider that takes direction.
const OPENAI_TONE: Record<TtsKind, string> = {
  page:
    "Voice: a calm, gentle, well-spoken British woman (soft Received Pronunciation) reading a picture book aloud to a small child at bedtime. " +
    "Tone: warm, soothing and kind, with a hint of a smile; never loud or dramatic. " +
    "Pacing: very slow and gentle, like reading a picture book to a baby at bedtime - a little slower than two-thirds of normal speaking speed, every word clear, with soft pauses at commas and a long, calm pause between sentences. Never rushed. " +
    "Give characters' speech a light, playful lift, but keep it cosy and quiet.",
  word:
    "Voice: a calm, gentle, well-spoken British woman (soft Received Pronunciation) teaching a small child a new word. " +
    "Say the single word very slowly, clearly and warmly, once, as if teaching it to a baby.",
};

async function synthesise(text: string, kind: TtsKind): Promise<Buffer> {
  if (provider === "elevenlabs") {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_96`, {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        // Steady and soothing rather than theatrical; single words a touch slower.
        voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: kind === "word" ? 0.78 : 0.74 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => "")}`);
    return Buffer.from(await res.arrayBuffer());
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text, instructions: OPENAI_TONE[kind], response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text().catch(() => "")}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // Azure
  const prosody = kind === "word" ? `rate="-30%" pitch="+2%"` : `rate="-30%" pitch="-1%"`;
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><voice name="${esc(voice)}"><prosody ${prosody}>${esc(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "taleo",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text().catch(() => "")}`);
  return Buffer.from(await res.arrayBuffer());
}

const cacheKey = (text: string, kind: TtsKind) =>
  `tts/${provider}-${voice.replace(/[^\w-]/g, "")}-${kind === "page" ? "slow3" : "slow2"}/${createHash("sha256").update(`${kind}\n${text}`).digest("hex").slice(0, 32)}.mp3`;

async function readCache(key: string): Promise<Buffer | null> {
  try {
    if (BLOB_TOKEN) {
      // Straight from its public address: no list() operation per clip.
      const url = blobUrl(key);
      if (!url) return null;
      const res = await fetch(url);
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

/** A clip that's already been made (free to serve to anyone), or null. */
export async function cachedClip(text: string, kind: TtsKind): Promise<Buffer | null> {
  if (!provider) return null;
  return readCache(cacheKey(text, kind));
}

/** MP3 audio for a phrase, from the cache or freshly synthesised. Callers
 *  must check the requester may create new clips (see /api/tts). */
export async function speechClip(text: string, kind: TtsKind): Promise<Buffer> {
  if (!provider) throw new Error("No text-to-speech provider configured.");
  const key = cacheKey(text, kind);
  const cached = await readCache(key);
  if (cached) return cached;
  const audio = await synthesise(text, kind);
  await writeCache(key, audio);
  return audio;
}
