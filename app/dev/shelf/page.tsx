import { readFileSync } from "node:fs";
import path from "node:path";
import type { GalleryEntry } from "@/lib/types";
import { ShelfDev } from "./ShelfDev";

/** Dev only: My bookshelf's head and originals, with a story under way. */
export default function ShelfDevPage() {
  if (process.env.NODE_ENV !== "development") return null;
  const entries = JSON.parse(readFileSync(path.join(process.cwd(), ".data/gallery/index.json"), "utf8")) as GalleryEntry[];
  return <ShelfDev entries={entries.slice(0, 5)} />;
}
