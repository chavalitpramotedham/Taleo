import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { EB_Garamond, IM_Fell_English, IM_Fell_English_SC } from "next/font/google";
import { PaintDefs } from "@/components/art/PaintDefs";
import { BrandMark } from "@/components/Icons";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AudioUnlock } from "@/components/AudioUnlock";
import { AccountNav } from "@/components/AccountNav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taleo: picture books you make together",
  description:
    "By parents, for parents: make watercolour picture books with your little one. Pick a hero and a tale, decide together what happens next, with a warm lesson in every story.",
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

// Self-hosted by Next.js (served from our own domain and preloaded), so the
// first paint doesn't wait on a stylesheet from fonts.googleapis.com.
const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-garamond",
});
const fell = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fell",
});
const fellSC = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-fell-sc",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${fell.variable} ${fellSC.variable}`}>
      <body>
        <Providers>
          <PaintDefs />
          <PullToRefresh />
          <AudioUnlock />
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Taleo home">
              <BrandMark />
              Taleo
            </Link>
            <div className="nav-row">
              <nav className="topnav">
                <Link href="/create" className="nav-link">
                  Begin a story
                </Link>
                <Link href="/store" className="nav-link">
                  Library
                </Link>
                <Link href="/contact" className="nav-link">
                  Contact us
                </Link>
              </nav>
              <AccountNav />
            </div>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
