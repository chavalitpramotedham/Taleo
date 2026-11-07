import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PaintDefs } from "@/components/art/PaintDefs";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AudioUnlock } from "@/components/AudioUnlock";
import { AccountNav } from "@/components/AccountNav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taleo: picture books you make together",
  description:
    "Create interactive, watercolour picture-book stories with your little one. Pick a character, choose a theme, and decide what happens next.",
  appleWebApp: {
    title: "Taleo",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F3ECDC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <PaintDefs />
          <PullToRefresh />
          <AudioUnlock />
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Taleo home">
              Taleo
            </Link>
            <nav className="topnav">
              <Link href="/create" className="nav-link">
                New story
              </Link>
              <Link href="/my-stories" className="nav-link">
                My bookshelf
              </Link>
              <Link href="/store" className="nav-link">
                Library
              </Link>
              <AccountNav />
            </nav>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
