import type { Metadata } from "next";

// A personal or in-progress page: fine to visit, but kept out of search results.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
