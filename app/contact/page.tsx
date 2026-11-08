import { redirect } from "next/navigation";

/** The contact form now lives on the About page. */
export default function ContactRedirect() {
  redirect("/about#contact");
}
