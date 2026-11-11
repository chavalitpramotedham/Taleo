import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { AdminPages } from "./AdminPages";

/** The dashboard's frame, shared by all of its pages: the title and the
 *  pill that chooses between them. It stays on the screen, untouched,
 *  while a page beneath it is fetched (the falling leaves show there
 *  meanwhile) - moving between Overall and User details, opening one
 *  account or one record, or changing what the log shows. Only the admin
 *  account gets as far as seeing it; everyone else gets a plain "not
 *  found", as the pages themselves give. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();
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
