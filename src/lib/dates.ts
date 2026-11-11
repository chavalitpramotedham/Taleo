const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ordinal = (d: number) => {
  const t = d % 100;
  if (t >= 11 && t <= 13) return `${d}th`;
  return `${d}${["th", "st", "nd", "rd"][d % 10] ?? "th"}`;
};

/** When a story was made, said briefly: "11th Nov" for this year, "11th
 *  Nov 2025" for an earlier one - by the reader's own calendar. ("" if
 *  there's no date to say.) */
export function shortDate(at: number | null | undefined, now = Date.now()): string {
  if (!at || !Number.isFinite(at)) return "";
  const d = new Date(at);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]}${year}`;
}
