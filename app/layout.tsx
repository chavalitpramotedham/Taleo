import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { WatercolorDefs } from "@/components/art/WatercolorDefs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taleo — make-believe stories you create together",
  description:
    "Create interactive, watercolour picture-book stories with your little one. Pick a character, choose a theme, and decide what happens next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDF6EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WatercolorDefs />
        <header className="topbar">
          <Link href="/" className="brand" aria-label="Taleo home">
            <span className="brand-mark" aria-hidden>
              ✿
            </span>
            Taleo
          </Link>
          <nav className="topnav">
            <Link href="/create" className="nav-link">
              New story
            </Link>
            <Link href="/library" className="nav-link">
              My stories
            </Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
