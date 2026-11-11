/**
 * What the illustrator is painting right now, in a few words - worked out
 * from the picture as it arrives. A page is painted in layers, in order
 * (see server/prompts): washes of sky and land, flat colour for the scene
 * and its characters, pen lines over them, then the last small marks; and
 * everything belonging to the page's tap target - a character or a thing -
 * sits in one group of its own. So the last layer begun, and whether we
 * are inside that group, say what's under the brush.
 *
 * `subject`: the tap target as it's called on the page ("Pip", "the
 * puddle"); `others`: the page's other characters by name.
 */
export function paintingStage(markup: string, subject?: string | null, others: string[] = []): string {
  const layers = [...markup.matchAll(/<g\b[^>]*\bclass="(wash|paint|ink|detail)"/g)];
  if (!layers.length) return "Sketching the scene…";
  const last = layers[layers.length - 1][1];
  // Inside the target's own group? (opened, and not yet closed)
  const at = markup.lastIndexOf('class="target"');
  let inTarget = false;
  let afterTarget = false;
  if (at >= 0) {
    // (walk the groups that follow: the target's own is closed when as
    // many have closed as opened, itself included)
    let depth = 1;
    for (const tag of markup.slice(at).matchAll(/<g\b|<\/g>/g)) {
      depth += tag[0] === "</g>" ? -1 : 1;
      if (depth === 0) break;
    }
    inTarget = depth > 0;
    afterTarget = !inTarget;
  }
  if (inTarget && subject) return last === "ink" ? `Drawing ${subject}…` : last === "detail" ? `Giving ${subject} a twinkle…` : `Painting ${subject}…`;
  if (last === "wash") return layers.filter((l) => l[1] === "wash").length > 1 ? "Washing in the hills and ground…" : "Washing in the sky…";
  if (last === "paint") {
    if (afterTarget && others.length) return `Painting ${list(others)}…`;
    return afterTarget ? "Painting the rest of the picture…" : "Painting the scene…";
  }
  if (last === "ink") return "Inking the lines…";
  return "Finishing touches…";
}

const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** Before the first stroke arrives the illustrator is reading the page and
 *  choosing colours: what to say, by how long it has been (ms). */
export function preparingStage(waitedMs: number): string {
  if (waitedMs < 2500) return "Reading the page…";
  if (waitedMs < 6500) return "Choosing the colours…";
  return "Sketching it out…";
}
