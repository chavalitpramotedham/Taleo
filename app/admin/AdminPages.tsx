"use client";
import { usePathname, useRouter } from "next/navigation";
import { useSwipeTabs } from "@/lib/useSwipeTabs";
import { Segmented } from "@/components/Segmented";

const PAGES = [
  { key: "overall", label: "Overall", href: "/admin" },
  { key: "users", label: "Details", href: "/admin/activity" },
  { key: "bench", label: "Bench", href: "/admin/lab" },
] as const;

/** The dashboard's two pages, as the two halves of one pill. It lives in
 *  the dashboard's frame (which isn't drawn again from page to page), so
 *  it reads which page is open from the address. */
export function AdminPages() {
  const path = usePathname();
  const on = path.startsWith("/admin/activity") ? "users" : path.startsWith("/admin/lab") ? "bench" : "overall";
  const router = useRouter();
  // (a swipe left goes on to the next page, a swipe right back)
  const at = PAGES.findIndex((p) => p.key === on);
  useSwipeTabs(at < PAGES.length - 1 ? () => router.push(PAGES[at + 1].href) : null, at > 0 ? () => router.push(PAGES[at - 1].href) : null);
  return (
    <div className="filter-row admin-pages">
      <Segmented nav options={PAGES} value={on} label="Admin pages" />
    </div>
  );
}
