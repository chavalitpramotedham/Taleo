"""Scores picture briefs against the brief rules: how many pages ask for
something the painter is known to draw badly. Usage: briefcheck.py <json files...>
(each a story with segments/pages, or {"story": ...})."""
import json, re, sys, collections

RULES = {
    "partialBody": r"\b(face|head|nose|eye|bottom|tail|chin|cheek)s?\b[^.;]{0,40}\b(fills?|filling|pokes?|poking|peeps? (through|out)|sticks? out|sticking out|rests? on|resting on|jammed|wedged|through the (door|flap|window|hole))|\bhead-first\b|\bhalf (in|inside|out of|down)\b|\bup to (his|her|their) (shoulders|waist|neck)\b|\bclose-up of [^.]{0,30}'s (face|eye|nose)",
    "unsupportedPose": r"\bupside[- ]down\b|\bswim\w*|\bdiv(es|ing|ed)\b|\bbelly-first\b|\bslid(es|ing)\b|\bspin\w*|\btumbl\w+|\bsomersault\w*|\bclimb\w*|\bhang(s|ing)? (from|off|on)\b|\bdangl\w+|\bsprawl\w*|\bcrawl\w*",
    "riding": r"\b(on|onto) (his|her|its|their|[A-Z]\w+'s) (\w+ )?(shoulders?|back|head)\b|\b(rides?|riding) on\b|\bpiggy-?back\b",
    "carryInArms": r"\b(in|into) (his|her|its|their) (\w+ ){0,2}(hands?|arms|paws|claws|flippers|tail|trunk)\b(?![^.;]{0,15}\b(up|out))|\bon (his|her) hip\b|\bcarr\w+ [A-Z]\w+ (and [A-Z]\w+ )?(in|on) (his|her|its)|\bcradl\w+|\btail (curled|wrapped|wound)\b|\btrunk (curled|wrapped|wound) (round|around)\b",
    "seatOrVehicle": r"\b(sits?|sitting|sat|ride\w*|riding) (in|on|inside) (a|the|his|her|their) (\w+ ){0,2}(bench|deckchair|hammock|swing|cot|car|train|bike|bicycle|scooter|picnic blanket|blanket|saucer|matchbox|teacup|basket|curl)\b",
    "standOnThing": r"\b(stands?|standing|perch\w*|balanc\w+|tiptoe\w*) (up )?on (top of )?(a|the|an) (\w+ ){0,2}(shelf|step|stair|stairs|branch|chair|wall|roof|jar|jars|ledge|lid|cheese|cake)\b|\bon the top step\b",
    "connection": r"\b(by|on|with) a rope\b|\bpull\w* [^.;]{0,30}\bby (a|the) (rope|string|lead)\b|\bturn\w* the (\w+ )?key\b|\bhang\w* (it|the \w+) on\b|\btied to\b|\bwings? (spread|wide|out)\b|\b(tail|trunk) wrapped\b|\bholding hands in a (ring|circle|line)\b|\bin a (ring|circle) holding\b",
    "viewOut": r"\b(view|looking) out (of|through) (the|a) (\w+ )?window\b|\bseen through (the|a) window\b|\bthrough the (round |little )?window (to|at|into) the\b",
}
RE = {k: re.compile(v, re.I) for k, v in RULES.items()}


def check(story):
    pages = [p for s in story["segments"] for p in s["pages"]]
    hits = collections.Counter()
    flagged = 0
    examples = collections.defaultdict(list)
    for p in pages:
        b = p.get("picture") or ""
        found = [k for k, r in RE.items() if r.search(b)]
        if len(p.get("characters") or []) > 4:
            found.append("crowd")
        for k in found:
            hits[k] += 1
            m = RE[k].search(b) if k in RE else None
            examples[k].append(m.group(0) if m else f"{len(p['characters'])} characters")
        flagged += bool(found)
    return len(pages), flagged, hits, examples


if __name__ == "__main__":
    tot_p = tot_f = 0
    allhits = collections.Counter()
    allex = collections.defaultdict(list)
    for f in sys.argv[1:]:
        d = json.load(open(f))
        d = d.get("story", d)
        n, fl, h, ex = check(d)
        tot_p += n; tot_f += fl; allhits.update(h)
        for k, v in ex.items(): allex[k] += v
        if "-v" in sys.argv[0:0]: pass
    print(f"pages {tot_p}, briefs asking for something hard: {tot_f} ({100*tot_f/max(1,tot_p):.0f}%), per 10 pages: {10*sum(allhits.values())/max(1,tot_p):.1f} hard asks")
    for k, v in allhits.most_common():
        print(f"  {k:16s} {v:4d}  e.g. {', '.join(repr(x) for x in allex[k][:4])}")
