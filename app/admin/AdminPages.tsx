"use client";
import { usePathname } from "next/navigation";
import { Segmented } from "@/components/Segmented";

const PAGES = [
  { key: "overall", label: "Overall", href: "/admin" },
  { key: "users", label: "User details", href: "/admin/activity" },
] as const;

/** The dashboard's two pages, as the two halves of one pill. It lives in
 *  the dashboard's frame (which isn't drawn again from page to page), so
 *  it reads which page is open from the address. */
export function AdminPages() {
  const on = usePathname().startsWith("/admin/activity") ? "users" : "overall";
  return (
    <div className="filter-row admin-pages">
      <Segmented nav options={PAGES} value={on} label="Admin pages" />
    </div>
  );
}
