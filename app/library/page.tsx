import { redirect } from "next/navigation";

/** Old route name, kept so existing links/bookmarks still land somewhere. */
export default function LibraryRedirect() {
  redirect("/my-stories");
}
