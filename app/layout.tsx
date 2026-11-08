import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { EB_Garamond, IM_Fell_English, IM_Fell_English_SC } from "next/font/google";
import { PaintDefs } from "@/components/art/PaintDefs";
import { BrandMark } from "@/components/Icons";
import { NavBegin } from "@/components/NavBegin";
import { NightToggle } from "@/components/NightMode";
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
  // Lets the page see the iPhone's screen insets (home indicator, notch),
  // so floating buttons can sit neatly in the rounded corners.
  viewportFit: "cover",
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
    <html lang="en" className={`${garamond.variable} ${fell.variable} ${fellSC.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply night mode before the first paint (no flash of the light theme). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("taleo.night")==="1")document.documentElement.dataset.night="1"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>
          <PaintDefs />
          <AudioUnlock />
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Taleo home">
              <BrandMark />
              Taleo
            </Link>
            <div className="nav-row">
              <nav className="topnav">
                <NavBegin />
                <Link href="/store" className="nav-link">
                  Library
                </Link>
                <Link href="/about" className="nav-link">
                  About
                </Link>
              </nav>
              <div className="nav-tools">
                <NightToggle />
                <span className="nav-divider" aria-hidden />
                <AccountNav />
              </div>
            </div>
          </header>
          <main>
            {/* opens at the top of the page content, below the fixed bar */}
            <PullToRefresh />
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
