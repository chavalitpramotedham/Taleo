"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LeafLoader } from "@/components/Icons";
import { PageLoading } from "@/components/PageLoading";
import {
  CONTACT_MAX_FILES,
  CONTACT_MAX_FILE_MB,
  CONTACT_MESSAGE_MAX,
  CONTACT_TITLE_MAX,
  isMediaType,
  type ContactAttachment,
} from "@/lib/contact";

interface Picked {
  key: string;
  file: File;
  preview: string;
  progress: number;
}

/** "Contact us": a request or an issue report, with optional photos or
 *  videos, sent to the Taleo team's inbox. */
export default function ContactPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<Picked[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in?next=/contact");
  }, [status, router]);

  // Free the preview object URLs when files go away.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  if (status !== "authenticated" || !session) return <PageLoading />;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next: Picked[] = [];
    for (const file of Array.from(list)) {
      if (!isMediaType(file.type)) {
        setError(`"${file.name}" isn't a photo or video.`);
        continue;
      }
      if (file.size > CONTACT_MAX_FILE_MB * 1024 * 1024) {
        setError(`"${file.name}" is over ${CONTACT_MAX_FILE_MB} MB.`);
        continue;
      }
      next.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file), progress: 0 });
    }
    setFiles((cur) => {
      const merged = [...cur, ...next];
      if (merged.length > CONTACT_MAX_FILES) {
        setError(`Up to ${CONTACT_MAX_FILES} attachments, please.`);
        merged.slice(CONTACT_MAX_FILES).forEach((f) => URL.revokeObjectURL(f.preview));
      }
      return merged.slice(0, CONTACT_MAX_FILES);
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (key: string) =>
    setFiles((cur) => {
      const gone = cur.find((f) => f.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return cur.filter((f) => f.key !== key);
    });

  const setProgress = (key: string, progress: number) => setFiles((cur) => cur.map((f) => (f.key === key ? { ...f, progress } : f)));

  const uploadOne = async (p: Picked, direct: boolean): Promise<ContactAttachment> => {
    const meta = { name: p.file.name, type: p.file.type, size: p.file.size };
    if (direct) {
      const { upload } = await import("@vercel/blob/client");
      const safeName = p.file.name.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";
      const blob = await upload(`contact/${safeName}`, p.file, {
        access: "public",
        handleUploadUrl: "/api/contact/upload",
        contentType: p.file.type,
        multipart: p.file.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(p.key, percentage),
      });
      return { ...meta, url: blob.url };
    }
    const res = await fetch("/api/contact/upload", {
      method: "POST",
      headers: { "content-type": p.file.type, "x-filename": encodeURIComponent(p.file.name) },
      body: p.file,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed.");
    setProgress(p.key, 100);
    return { ...meta, url: null };
  };

  const send = async () => {
    if (!title.trim() || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const { directUpload } = (await fetch("/api/contact").then((r) => r.json())) as { directUpload: boolean };
      const attachments: ContactAttachment[] = [];
      for (const p of files) {
        try {
          attachments.push(await uploadOne(p, directUpload));
        } catch {
          throw new Error(`Couldn't upload "${p.file.name}". Try again, or remove it.`);
        }
      }
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, message, attachments }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't send your message.");
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setTitle("");
      setMessage("");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setFiles((cur) => cur.map((f) => ({ ...f, progress: 0 })));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container contact">
      <header className="wizard-head">
        <p className="eyebrow">We&apos;d love to hear from you</p>
        <h1>Contact us</h1>
        <p className="sub">Ask for something new, or tell us about anything that isn&apos;t working.</p>
      </header>

      {sent ? (
        <div className="panel contact-panel contact-sent">
          <h2>Thank you!</h2>
          <p className="meta">Your message is on its way. We&apos;ll reply to {session.user.email} if we need anything else.</p>
          <button type="button" className="btn btn-soft" onClick={() => setSent(false)}>
            Send another message
          </button>
        </div>
      ) : (
        <div className="panel contact-panel">
          <label className="contact-field">
            <span className="notes-label">Title</span>
            <input
              className="input"
              value={title}
              maxLength={CONTACT_TITLE_MAX}
              placeholder="e.g. The music stops when I use the mic"
              onChange={(e) => setTitle(e.target.value)}
              disabled={sending}
            />
          </label>
          <label className="contact-field">
            <span className="notes-label">Message</span>
            <textarea
              className="input comment-input contact-message"
              value={message}
              maxLength={CONTACT_MESSAGE_MAX}
              placeholder="Tell us what you'd like, or what happened and on which device."
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </label>

          <div className="contact-field">
            <span className="notes-label">
              Attachments <span className="meta">(optional: photos or videos, up to {CONTACT_MAX_FILES}, {CONTACT_MAX_FILE_MB} MB each)</span>
            </span>
            {files.length > 0 && (
              <ul className="contact-files">
                {files.map((f) => (
                  <li key={f.key} className="contact-file">
                    {f.file.type.startsWith("video/") ? (
                      <video src={f.preview} muted playsInline preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" />
                    )}
                    <span className="contact-file-name">{f.file.name}</span>
                    {sending ? (
                      <span className="contact-file-progress" style={{ width: `${f.progress}%` }} />
                    ) : (
                      <button type="button" className="contact-file-remove" onClick={() => remove(f.key)} aria-label={`Remove ${f.file.name}`}>
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {files.length < CONTACT_MAX_FILES && (
              <button type="button" className="btn btn-soft contact-add" onClick={() => inputRef.current?.click()} disabled={sending}>
                + Add photos or videos
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="button" className="btn btn-primary btn-block" onClick={send} disabled={!title.trim() || !message.trim() || sending}>
            {sending ? (
              <>
                <LeafLoader size={18} /> {files.length ? "Uploading & sending…" : "Sending…"}
              </>
            ) : (
              "Send message"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
