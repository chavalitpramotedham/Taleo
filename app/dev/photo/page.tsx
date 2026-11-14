"use client";
import { useState } from "react";
import { PhotoField, type ChosenPhoto } from "@/components/CharacterCreatorModal";

/** Dev only: the character photo box on its own, to try circling who you
 *  mean without signing in or painting anything. */
export default function PhotoDev() {
  const [photo, setPhoto] = useState<ChosenPhoto | null>(null);
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <PhotoField photo={photo} onChange={setPhoto} />
      <p id="photo-state">{photo ? JSON.stringify({ marked: Boolean(photo.marked), bytes: photo.bytes, hasWhole: Boolean(photo.whole) }) : "none"}</p>
    </main>
  );
}
