import { permanentRedirect } from "next/navigation";

/** "Library" in the site's menu is the Public Library: anyone typing or
 *  following /library lands there (a permanent redirect, so search engines
 *  pass it on too). */
export default function LibraryRedirect() {
  permanentRedirect("/store");
}
