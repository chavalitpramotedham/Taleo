// Painter test bench viewer (development only; see scripts/rsi/bench.ts).
//   ?round=0&src=live            every page of a round, with its words
//   ?round=0&src=live&page=3     one page, large
//   ?compare=3&src=emulated&rounds=0,5,10   one page across rounds
import { notFound } from "next/navigation";
import { Painting } from "@/components/art/Painting";
import { benchPages, readPainting } from "../../../scripts/rsi/bench";

type Src = "live" | "emulated";

function Card({ round, src, n, width }: { round: number; src: Src; n: number; width: number }) {
  const svg = readPainting(round, src, n);
  const page = benchPages()[n - 1];
  return (
    <figure style={{ width, margin: 0, background: "#FBF7EE", padding: 10, borderRadius: 8, boxSizing: "border-box" }}>
      <div style={{ width: "100%", aspectRatio: "4 / 3", background: "#fff" }}>
        {svg ? <Painting svg={svg} /> : <div style={{ padding: 40, color: "#a33" }}>not painted</div>}
      </div>
      <figcaption style={{ font: "13px/1.35 Georgia, serif", color: "#4F3A2A", marginTop: 8 }}>
        <b>
          p{n} · r{round} {src}
        </b>{" "}
        · {page?.text}
      </figcaption>
    </figure>
  );
}

export default async function Bench({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const q = await searchParams;
  const src = (q.src === "emulated" ? "emulated" : "live") as Src;
  const shell = (children: React.ReactNode) => (
    <main id="bench" style={{ background: "#fff", padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
      {/* (only the bench shows: the screenshots are of it alone) */}
      <style>{`body *{visibility:hidden}#bench,#bench *{visibility:visible}#bench{position:absolute;top:0;left:0;right:0;z-index:99999}`}</style>
      {children}
    </main>
  );
  if (q.compare) {
    const n = Number(q.compare);
    const rounds = (q.rounds || "0").split(",").map(Number);
    return shell(rounds.map((r) => <Card key={r} round={r} src={src} n={n} width={420} />));
  }
  const round = Number(q.round || 0);
  if (q.page) return shell(<Card round={round} src={src} n={Number(q.page)} width={820} />);
  const only = q.pages ? q.pages.split(",").map(Number) : benchPages().map((_, i) => i + 1);
  return shell(only.map((n) => <Card key={n} round={round} src={src} n={n} width={420} />));
}
