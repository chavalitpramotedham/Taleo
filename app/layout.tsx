import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { EB_Garamond, IM_Fell_English, IM_Fell_English_SC } from "next/font/google";
import { PaintDefs } from "@/components/art/PaintDefs";
import { BrandMark } from "@/components/Icons";
import { NavBegin } from "@/components/NavBegin";
import { NavLinks } from "@/components/NavHome";
import { NightToggle } from "@/components/NightMode";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AudioUnlock } from "@/components/AudioUnlock";
import { AccountNav } from "@/components/AccountNav";
import { Providers } from "@/components/Providers";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";
import { ToastHost } from "@/components/Toast";
import { ServiceWorker } from "@/components/AddShortcut";
import { INSTALL_CATCH } from "@/lib/install";
import { EARLY_FETCH } from "@/lib/early";
import { NIGHT_INIT } from "@/lib/night-clock";

export const metadata: Metadata = {
  // The site's home: link previews (story images in WhatsApp, iMessage...)
  // always point at the real domain, never a temporary deployment address.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Taleo" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: "education",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Ownership checks for Google Search Console / Bing Webmaster Tools: set
  // the code each one gives you as an environment variable on Vercel.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  appleWebApp: {
    title: "Taleo",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
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
//
// Only the three upright faces are preloaded: they letter every page from
// its first line. The two italics (a caption here, an aside there) are the
// same families, declared apart so they aren't: they come when a page first
// uses them, instead of 100 KB of them racing the stylesheet and scripts on
// every visit.
const garamond = EB_Garamond({
  subsets: ["latin"],
  // 400 for text, 600 for headings and bold; 500 was never used.
  weight: ["400", "600"],
  style: ["normal"],
  display: "swap",
  variable: "--font-garamond",
});
const garamondItalic = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["italic"],
  display: "swap",
  preload: false,
  variable: "--font-garamond-italic",
});
const fell = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal"],
  display: "swap",
  variable: "--font-fell",
});
const fellItalic = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["italic"],
  display: "swap",
  preload: false,
  variable: "--font-fell-italic",
});
const fellSC = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-fell-sc",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The torn-paper edge every painting is shown through (covers, pages,
  // the landing picture): small, and nothing of a painting can be drawn
  // until it's here, so it's asked for with the page rather than found
  // late in the styles. (A mask is fetched the way styles' masks are -
  // "cors" - so the preload must be too, or it's fetched twice.)
  preload("/art/paint-edge.webp", { as: "image", fetchPriority: "high", crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${garamond.variable} ${fell.variable} ${fellSC.variable} ${garamondItalic.variable} ${fellItalic.variable}`} suppressHydrationWarning>
      <head>
        {/* Day or night, by the reader's clock (or their own recent choice),
            before the first paint: no flash of the other theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `${NIGHT_INIT}${INSTALL_CATCH}${EARLY_FETCH}`,
          }}
        />
      </head>
      <body>
        <Providers>
          <PaintDefs />
          <ToastHost />
          <AudioUnlock />
          <ServiceWorker />
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Taleo home">
              <BrandMark />
              Taleo
            </Link>
            <div className="nav-row">
              <nav className="topnav">
                <NavBegin />
                <NavLinks />
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
