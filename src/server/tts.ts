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

type Provider = "openai" | "azure";
export type TtsKind = "page" | "word";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || "uksouth";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const provider: Provider | null = OPENAI_KEY ? "openai" : AZURE_KEY ? "azure" : null;

const DEFAULT_VOICE: Record<Provider, string> = {
  openai: "sage",
  azure: "en-GB-SoniaNeural",
};
const voice = provider ? process.env.TTS_VOICE || DEFAULT_VOICE[provider] : "";

export const ttsEnabled = () => provider !== null;

/** The OpenAI voices readers can choose between in the story reader (when
 *  there's an OpenAI key), each with a word on its feel. */
export const OPENAI_VOICES: { id: string; name: string; note: string }[] = [
  // a short list of the gentlest voices for bedtime (of OpenAI's 13);
  // the first is the default
  { id: "fable", name: "Fable", note: "storyteller" },
  { id: "sage", name: "Sage", note: "calm, gentle" },
  { id: "shimmer", name: "Shimmer", note: "soft, soothing" },
  { id: "coral", name: "Coral", note: "warm, bright" },
  { id: "marin", name: "Marin", note: "natural, warm" },
  { id: "ballad", name: "Ballad", note: "lilting" },
  { id: "cedar", name: "Cedar", note: "deep, cosy" },
];
const OPENAI_VOICE_IDS = new Set(OPENAI_VOICES.map((v) => v.id));
/** The voices a reader can choose from (none unless OpenAI is set up). */
export const voiceChoices = () => (OPENAI_KEY ? OPENAI_VOICES : []);
/** A reader's chosen OpenAI voice, if it's a real one and OpenAI is set up. */
export const chosenVoice = (v: string | null | undefined) => (OPENAI_KEY && v && OPENAI_VOICE_IDS.has(v) ? v : null);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

// The tone, written once for every provider that takes direction.
const OPENAI_TONE: Record<TtsKind, string> = {
  page:
    "Voice: a calm, gentle, well-spoken British storyteller (soft Received Pronunciation) reading a picture book aloud to a small child at bedtime. " +
    "Tone: warm, soothing and kind, with a hint of a smile; never loud or dramatic. " +
    "Pacing: very slow and gentle, like reading a picture book to a baby at bedtime - a little slower than two-thirds of normal speaking speed, every word clear, with soft pauses at commas and a long, calm pause between sentences. Never rushed. " +
    "Give characters' speech a light, playful lift, but keep it cosy and quiet.",
  word:
    "Voice: a calm, gentle, well-spoken British storyteller (soft Received Pronunciation) teaching a small child a new word. " +
    "Say the single word very slowly, clearly and warmly, once, as if teaching it to a baby.",
};

async function synthesise(text: string, kind: TtsKind, picked: string | null): Promise<Buffer> {
  if (picked) return openaiSpeech(text, kind, picked);
  if (provider === "openai") return openaiSpeech(text, kind, voice);

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

async function openaiSpeech(text: string, kind: TtsKind, v: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: v, input: text, instructions: OPENAI_TONE[kind], response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text().catch(() => "")}`);
  return Buffer.from(await res.arrayBuffer());
}

const cacheKey = (text: string, kind: TtsKind, picked: string | null) =>
  `tts/${picked ? "openai" : provider}-${(picked ?? voice).replace(/[^\w-]/g, "")}-${kind === "page" ? "slow3" : "slow2"}/${createHash("sha256").update(`${kind}\n${text}`).digest("hex").slice(0, 32)}.mp3`;

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

async function writeCache(key: string, audio: Buffer, contentType = "audio/mpeg") {
  try {
    if (BLOB_TOKEN) {
      const { put } = await import("@vercel/blob");
      await put(key, audio, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true, token: BLOB_TOKEN });
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
export async function cachedClip(text: string, kind: TtsKind, picked: string | null = null): Promise<Buffer | null> {
  if (!provider) return null;
  return readCache(cacheKey(text, kind, picked));
}

/** MP3 audio for a phrase, from the cache or freshly synthesised. Callers
 *  must check the requester may create new clips (see /api/tts). */
export async function speechClip(text: string, kind: TtsKind, picked: string | null = null): Promise<Buffer> {
  if (!provider) throw new Error("No text-to-speech provider configured.");
  const key = cacheKey(text, kind, picked);
  const cached = await readCache(key);
  if (cached) return cached;
  const audio = await synthesise(text, kind, picked);
  await writeCache(key, audio);
  // (and its word timings, worked out now so they're there when it's first
  // played - without holding up the clip itself)
  if (kind === "page") void clipMarks(text, kind, picked).catch(() => null);
  return audio;
}

// ---------------------------------------------------------------- word timings
//
// When each word of a page is spoken in its clip, so the reader can light
// the words as they're read. The voice service doesn't say; the clip is
// listened to once (OpenAI's speech-to-text, with a time for every word),
// what was heard is lined up with the page's own words, and the answer is
// kept beside the clip - made once, like the clip, and free ever after.
// (Without an OpenAI key, or if listening fails, there are none: the
// reader then estimates from the clip's pauses, as it always did.)

const marksKey = (clipKey: string) => clipKey.replace(/\.mp3$/, ".marks.json");
const plain = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

/** Lines up the words heard (each with its start time) with the words of
 *  the text (split at spaces, as the reader splits them): a start time for
 *  every word of the text, or null if too little matched to trust. */
export function alignWords(text: string, heard: { word: string; start: number }[], length: number): number[] | null {
  const words = [...text.matchAll(/\S+/g)].map((m) => plain(m[0]));
  const said = heard.map((h) => ({ w: plain(h.word), start: h.start })).filter((h) => h.w);
  if (!words.length || !said.length) return null;
  const at: (number | null)[] = words.map(() => null);
  let j = 0;
  let matched = 0;
  const same = (a: string, b: string) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
  for (let i = 0; i < words.length; i++) {
    if (!words[i]) continue; // (a dash, a lone quote mark: nothing is said)
    // (the listener may have dropped or added a word or two: look a little ahead)
    for (let k = j; k < Math.min(said.length, j + 5); k++) {
      if (same(words[i], said[k].w)) {
        at[i] = said[k].start;
        j = k + 1;
        matched++;
        break;
      }
    }
  }
  const spoken = words.filter(Boolean).length;
  if (matched < Math.max(1, Math.ceil(spoken * 0.6))) return null;
  // Words that weren't matched (a number read as a word, a name spelt
  // another way) are placed between their neighbours, by length.
  const out: number[] = [];
  let i = 0;
  while (i < words.length) {
    if (at[i] !== null) {
      out[i] = at[i]!;
      i++;
      continue;
    }
    let e = i;
    while (e < words.length && at[e] === null) e++;
    const from = i > 0 ? out[i - 1] : 0;
    const to = e < words.length ? at[e]! : length;
    const weight = (n: number) => words[n].length + 1.5;
    // (the gap starts after the word before it has been said)
    const lead = i > 0 ? weight(i - 1) : 0;
    let total = lead;
    for (let n = i; n < e; n++) total += weight(n);
    let run = lead;
    for (let n = i; n < e; n++) {
      out[n] = from + ((to - from) * run) / (total || 1);
      run += weight(n);
    }
    i = e;
  }
  // (never backwards)
  for (let n = 1; n < out.length; n++) if (out[n] < out[n - 1]) out[n] = out[n - 1];
  return out.map((t) => Math.round(t * 1000) / 1000);
}

async function listen(audio: Buffer): Promise<{ words: { word: string; start: number }[]; duration: number } | null> {
  if (!OPENAI_KEY) return null;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "clip.mp3");
  form.append("model", "whisper-1");
  form.append("language", "en");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: form });
  if (!res.ok) throw new Error(`OpenAI listening ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { duration?: number; words?: { word?: string; start?: number }[] };
  const words = (data.words ?? []).filter((w): w is { word: string; start: number } => typeof w.word === "string" && typeof w.start === "number");
  return words.length ? { words, duration: typeof data.duration === "number" ? data.duration : (words[words.length - 1].start + 0.5) } : null;
}

const making = new Map<string, Promise<number[] | null>>();
/** When each word of a page starts in its clip (seconds), one per word of
 *  the text - from the cache, or worked out now from a clip that exists.
 *  Null where they can't be had (no clip yet, no listener, it failed). */
export async function clipMarks(text: string, kind: TtsKind, picked: string | null = null): Promise<number[] | null> {
  if (!provider || kind !== "page") return null;
  const key = cacheKey(text, kind, picked);
  const kept = await readCache(marksKey(key));
  if (kept) {
    try {
      const m = JSON.parse(kept.toString("utf8")) as { v?: number; starts?: number[] | null };
      // (a "couldn't" is kept too, so a clip isn't listened to over and over)
      if (m.v === 1) return Array.isArray(m.starts) ? m.starts : null;
    } catch {}
  }
  if (!OPENAI_KEY) return null;
  let p = making.get(key);
  if (!p) {
    p = (async () => {
      const audio = await readCache(key);
      if (!audio) return null;
      let starts: number[] | null = null;
      try {
        const heard = await listen(audio);
        starts = heard ? alignWords(text, heard.words, heard.duration) : null;
      } catch (e) {
        console.error("[tts] couldn't work out word timings", e);
        return null; // (not kept: tried again another time)
      }
      await writeCache(marksKey(key), Buffer.from(JSON.stringify({ v: 1, starts })), "application/json");
      return starts;
    })().finally(() => making.delete(key));
    making.set(key, p);
  }
  return p;
}
