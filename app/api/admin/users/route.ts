import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/entitlements";
import { listUsers } from "@/server/users";

export const dynamic = "force-dynamic";

/** Every account, by handle and email (admin only) - what the "add credits
 *  for someone" search looks through. To anyone else this address doesn't
 *  exist. */
export async function GET() {
  if (!(await currentAdmin())) return new NextResponse(null, { status: 404 });
  const users = await listUsers({ fresh: true });
  return NextResponse.json(
    { people: users.filter((u) => !u.isAdmin).map((u) => ({ id: u.id, username: u.username, email: u.email })) },
    { headers: { "cache-control": "private, no-store" } },
  );
}
