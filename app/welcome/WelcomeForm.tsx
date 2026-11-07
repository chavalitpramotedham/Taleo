"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/** Lowercase, strip anything but letters/numbers/underscore — applied live,
 *  so browser/password-manager autofill (which ignores our suggested value
 *  and drops in the real capitalised, spaced name) can't produce an invalid
 *  username that only surfaces as an error after submitting. */
const sanitize = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 20);

export function WelcomeForm({ suggested, next }: { suggested: string; next?: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [username, setUsername] = useState(sanitize(suggested));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (username.length < 3 || busy) return;
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
          onChange={(e) => setUsername(sanitize(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label="Username"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name="taleo-username"
        />
        <button type="button" className="btn btn-primary" onClick={submit} disabled={username.length < 3 || busy}>
          {busy ? "Saving…" : "Let's go"}
        </button>
      </div>
      <p className="meta">3-20 letters, numbers or underscores{username.length > 0 && username.length < 3 ? " — a couple more, please" : "."}</p>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
