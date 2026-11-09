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
import { OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

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
const garamond = EB_Garamond({
  subsets: ["latin"],
  // 400 for text, 600 for headings and bold; 500 was never used.
  weight: ["400", "600"],
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
            __html: `try{if(localStorage.getItem("taleo.night")==="1"){document.documentElement.dataset.night="1";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="#131017"}}catch(e){}`,
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
                  About us
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
