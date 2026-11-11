import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * The admin's corner of the site is answered here, before any page is
 * built: anyone who isn't signed in as the admin is sent straight to the
 * front page, by a plain redirect that carries nothing of the dashboard -
 * no page, no title, no "not found" of its own. Every address under it
 * gets the same answer, whether or not anything lives there.
 *
 * This reads the sign-in cookie only (it is signed, so it can't be made
 * up). The pages and routes behind it still check the account for
 * themselves, against the profile as it is now.
 */
export async function proxy(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  let admin = false;
  if (secret) {
    // (the cookie has one name over https and another on a dev machine)
    for (const secureCookie of [true, false]) {
      const token = await getToken({ req, secret, secureCookie }).catch(() => null);
      if (token?.isAdmin === true) admin = true;
    }
  }
  if (admin) return NextResponse.next();
  const home = new URL("/", req.url);
  home.search = "";
  return NextResponse.redirect(home);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
