"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function WelcomeForm({ suggested, next }: { suggested: string; next?: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [username, setUsername] = useState(suggested);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't set that username.");
      await update();
      router.push(next || "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel panel-invent">
      <div className="field-row">
        <input
          className="input"
          value={username}
          maxLength={20}
          placeholder="your-name"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label="Username"
          autoFocus
        />
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!username.trim() || busy}>
          {busy ? "Saving…" : "Let's go"}
        </button>
      </div>
      <p className="meta">3-20 letters, numbers or underscores.</p>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
