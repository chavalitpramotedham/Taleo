"use client";
import { usePathname, useRouter } from "next/navigation";
import { useSwipeTabs } from "@/lib/useSwipeTabs";
import { Segmented } from "@/components/Segmented";

const PAGES = [
  { key: "overall", label: "Overall", href: "/admin" },
  { key: "users", label: "Details", href: "/admin/activity" },
] as const;

/** The dashboard's two pages, as the two halves of one pill. It lives in
 *  the dashboard's frame (which isn't drawn again from page to page), so
 *  it reads which page is open from the address. */
export function AdminPages() {
  const on = usePathname().startsWith("/admin/activity") ? "users" : "overall";
  const router = useRouter();
  // (a swipe left goes on to Details, a swipe right back to Overall)
  useSwipeTabs(on === "overall" ? () => router.push(PAGES[1].href) : null, on === "users" ? () => router.push(PAGES[0].href) : null);
  return (
    <div className="filter-row admin-pages">
      <Segmented nav options={PAGES} value={on} label="Admin pages" />
    </div>
  );
}
