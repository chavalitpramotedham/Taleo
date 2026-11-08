"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AVATAR_KEYS, presetByKey } from "@/lib/presets";
import { Avatar } from "@/components/Avatar";
import { CharacterManager } from "@/components/CharacterManager";

const sanitize = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 20);

export function AccountForm({ username, avatarKey, isAdmin }: { username: string; avatarKey: string; isAdmin: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(username);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [avatar, setAvatar] = useState(avatarKey);
  const [draftAvatar, setDraftAvatar] = useState(avatarKey);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [busy, setBusy] = useState<"name" | "avatar" | "stories" | "account" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saveAvatar = async () => {
    if (draftAvatar === avatar || busy) return;
    setBusy("avatar");
    setAvatarError(null);
    setAvatarSaved(false);
    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarKey: draftAvatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that picture.");
      setAvatar(draftAvatar);
      setAvatarSaved(true);
      // Re-sync the session (every avatar shown via useSession, e.g. the nav
      // icon) so the new picture appears everywhere without a manual reload.
      await update();
      router.refresh();
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const saveName = async () => {
    if (name.length < 3 || busy) return;
    setBusy("name");
    setNameError(null);
    setNameSaved(false);
    try {
      const res = await fetch("/api/user/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that username.");
      await update();
      setNameSaved(true);
      router.refresh();
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const deleteStories = async () => {
    if (busy) return;
    if (!window.confirm("Delete every story you've published? This can't be undone.")) return;
    setBusy("stories");
    setNotice(null);
    try {
      const res = await fetch("/api/account/stories", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete your stories.");
      setNotice(data.deleted ? `Deleted ${data.deleted} ${data.deleted === 1 ? "story" : "stories"}.` : "You had no published stories.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    if (busy) return;
    if (!window.confirm("Delete your account and every story you've published? This can't be undone.")) return;
    setBusy("account");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete your account.");
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  return (
    <>
      <section className="panel">
        <h3>Profile picture</h3>
        <p className="meta">Pick a face from the cast, then save it.</p>
        <div className="avatar-picker">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`avatar-option ${draftAvatar === key ? "selected" : ""}`}
              onClick={() => {
                setDraftAvatar(key);
                setAvatarSaved(false);
              }}
              disabled={Boolean(busy)}
              aria-label={presetByKey(key)?.name || key}
              aria-pressed={draftAvatar === key}
            >
              <Avatar avatarKey={key} />
            </button>
          ))}
        </div>
        <div className="field-row avatar-save-row">
          <button type="button" className="btn btn-primary btn-block" onClick={saveAvatar} disabled={draftAvatar === avatar || busy === "avatar"}>
            {busy === "avatar" ? "Saving…" : "Save picture"}
          </button>
        </div>
        {avatarSaved && <p className="meta">Saved.</p>}
        {avatarError && <p className="error">{avatarError}</p>}
      </section>

      <section className="panel">
        <h3>Username</h3>
        <div className="field-row">
          <input
            className="input"
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(sanitize(e.target.value));
              setNameSaved(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            autoComplete="off"
            aria-label="Username"
          />
          <button type="button" className="btn btn-primary" onClick={saveName} disabled={name.length < 3 || name === username || busy === "name"}>
            {busy === "name" ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="meta">3-20 letters, numbers or underscores.</p>
        {nameSaved && <p className="meta">Saved.</p>}
        {nameError && <p className="error">{nameError}</p>}
      </section>

      <CharacterManager />

      <section className="panel">
        <h3>Danger zone</h3>
        <p className="meta">These can&apos;t be undone.</p>
        <div className="card-actions">
          <button type="button" className="btn btn-soft" onClick={deleteStories} disabled={Boolean(busy)}>
            {busy === "stories" ? "Deleting…" : "Delete all my stories"}
          </button>
          {!isAdmin && (
            <button type="button" className="btn btn-soft" onClick={deleteAccount} disabled={Boolean(busy)}>
              {busy === "account" ? "Deleting…" : "Delete my account"}
            </button>
          )}
        </div>
        {notice && <p className="meta">{notice}</p>}
      </section>
    </>
  );
}
