import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AdminPages } from "./AdminPages";

/** The tab's title, for the admin alone: to anyone else these addresses
 *  have no name of their own (they carry the site's, like any page). */
export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  return session?.user?.isAdmin ? { title: "Admin dashboard", robots: { index: false, follow: false } } : {};
}

/** The dashboard's frame, shared by all of its pages: the title and the
 *  pill that chooses between them. It stays on the screen, untouched,
 *  while a page beneath it is fetched (the falling leaves show there
 *  meanwhile) - moving between Overall and User details, opening one
 *  account or one record, or changing what the log shows. Only the admin
 *  account gets as far as seeing it: everyone else has already been sent
 *  to the front page (proxy.ts), and would be again from here. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/");
  return (
    <div className="container admin">
      <header className="wizard-head">
        <p className="eyebrow">Only you can see this</p>
        <h1>Admin dashboard</h1>
      </header>
      <AdminPages />
      {children}
    </div>
  );
}
