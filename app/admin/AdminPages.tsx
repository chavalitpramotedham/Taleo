import { Segmented } from "@/components/Segmented";

const PAGES = [
  { key: "overall", label: "Overall", href: "/admin" },
  { key: "users", label: "User details", href: "/admin/activity" },
] as const;

/** The dashboard's two pages, as the two halves of one pill. */
export function AdminPages({ on }: { on: (typeof PAGES)[number]["key"] }) {
  return (
    <div className="filter-row admin-pages">
      <Segmented nav options={PAGES} value={on} label="Admin pages" />
    </div>
  );
}
