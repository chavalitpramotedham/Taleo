// Screenshot bench viewer pages with one Chrome (no profile clashes).
//   node scripts/rsi/shots.cjs <round> [pages=1-18] [src=live]
//   RSI_QUERY="compare=5&rounds=0,1" RSI_NAME=c05.png node scripts/rsi/shots.cjs 0
// The dev server's live-reload socket is cut so pages don't reload mid-shot.
const path = require("node:path");
const fs = require("node:fs");
const PW = process.env.RSI_PW || "/private/tmp/claude-501/-Users-bytedance-Taleo/af996e3e-4908-488a-9817-09bf9b6a34a9/scratchpad/pw/node_modules/playwright-core";
const { chromium } = require(PW);
const PORT = process.env.RSI_PORT || 3000;

(async () => {
  const round = process.argv[2] ?? "0";
  const spec = process.argv[3] ?? "1-18";
  const src = process.argv[4] ?? "live";
  const pages = spec.split(",").flatMap((s) => {
    const [a, b] = s.split("-").map(Number);
    return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  });
  const dir = process.env.RSI_OUT || path.join("scripts/rsi/png", `r${String(round).padStart(2, "0")}`);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const ctx = await browser.newContext();
  await ctx.routeWebSocket(/hmr|turbopack/, (ws) => ws.close());
  // The dev client reloads itself now and then; shoot in a quiet moment and
  // keep the shot only if no reload happened while it was taken.
  const shoot = async (q, out, w, h) => {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: w, height: h });
    let navs = 0;
    p.on("framenavigated", (f) => { if (f === p.mainFrame()) navs++; });
    await p.goto(`http://localhost:${PORT}/dev/rsi?${q}`, { waitUntil: "commit", timeout: 90000 }).catch(() => {});
    for (let i = 0; i < 80; i++) {
      try {
        const before = navs;
        const ok = await p.evaluate(() => document.querySelectorAll("#bench svg path").length > 20 && document.fonts.status === "loaded");
        if (ok) {
          await p.waitForTimeout(500);
          if (navs !== before) continue;
          const box = await p.locator("#bench").boundingBox({ timeout: 2000 });
          await p.screenshot({ path: out, fullPage: true, clip: box ?? undefined, timeout: 8000 });
          if (navs === before) { await p.close(); console.log(out); return; }
        }
      } catch {}
      await p.waitForTimeout(300).catch(() => {});
    }
    await p.close().catch(() => {});
    console.error("FAIL", out);
  };
  const q = process.env.RSI_QUERY;
  if (q) await shoot(q, path.join(dir, process.env.RSI_NAME || "shot.png"), 1340, 900);
  else
    for (let i = 0; i < pages.length; i += 3)
      await Promise.all(pages.slice(i, i + 3).map((n) => shoot(`round=${round}&src=${src}&page=${n}`, path.join(dir, `p${String(n).padStart(2, "0")}.png`), 852, 700)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
