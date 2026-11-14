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
import { SiteFooter } from "@/components/SiteFooter";
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
// The two decorative faces (the title's, and the small capitals) aren't
// asked for ahead of the page: on a slow phone, fetching them alongside the
// stylesheet held the first paint back by most of a second. The text face
// still is - it's most of every page, and swapping it late made long pages
// jump. These two arrive a moment after the first paint instead.
const fell = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal"],
  display: "swap",
  preload: false,
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
  preload: false,
  variable: "--font-fell-sc",
});

/** After a pull-to-refresh, whose loader borrowed the title's leaves: the
 *  new page opens with the title alone, and once it has loaded the leaves
 *  come back to it (see PullToRefresh, and .leaves-taken in the styles). */
const LEAVES_BACK = `try{if(sessionStorage.getItem("taleo.pulled")){sessionStorage.removeItem("taleo.pulled");var d=document.documentElement;d.classList.add("leaves-taken");var b=function(){setTimeout(function(){d.classList.remove("leaves-taken")},450)};if(document.readyState==="complete")b();else addEventListener("load",b)}}catch(e){}`;

/**
 * Inside an app's own browser on an iPhone (Telegram, Instagram,
 * Facebook...: a bare web view, which names no "Safari/" in its user
 * agent - Safari, Chrome and Firefox all do), the app's own bar floats
 * over the top of the page and the page scrolls on underneath it - and the
 * web view clips anything drawn above our menu bar, so nothing of ours can
 * cover that strip. There, the page scrolls inside the body instead of the
 * whole document: nothing passes under the app's bar, and the strip shows
 * the page's own colour (the menu bar's - see .in-app in the styles).
 * What reads or sets the window's scroll position is pointed at the body,
 * so scroll positions, "back to the top" and pull to refresh still work.
 *
 * Telegram's newer browser does say "Safari/", so an app's name in the user
 * agent, or Telegram's own objects on the page, count too (looked for again
 * once the page has loaded, in case they arrive late). ?inapp=1 or
 * ?inapp=0 forces it on or off for the rest of the visit, to test.
 */
const IN_APP = `try{(function(){var u=navigator.userAgent,d=document.documentElement,f=null;try{var m=/[?&]inapp=([01])/.exec(location.search);if(m)sessionStorage.setItem("taleo.inapp",m[1]);f=sessionStorage.getItem("taleo.inapp")}catch(e){}var ios=/iPhone|iPad|iPod/.test(u)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);var app=function(){return !!(window.TelegramWebviewProxy||window.TelegramWebview||window.TelegramWebviewProxyProto)||/Telegram|FBAN|FBAV|FB_IAB|Instagram|Line\\/|MicroMessenger|LinkedInApp|Twitter|Snapchat|Pinterest/.test(u)};var want=function(){return f==="1"||(f!=="0"&&ios&&!navigator.standalone&&(!/Safari\\//.test(u)||app()))};var b=function(){return document.body};var on=function(){if(d.classList.contains("in-app"))return;d.classList.add("in-app");try{Object.defineProperty(window,"scrollY",{configurable:true,get:function(){return b()?b().scrollTop:0}});Object.defineProperty(window,"pageYOffset",{configurable:true,get:function(){return b()?b().scrollTop:0}})}catch(e){}var to=function(x,y){if(!b())return;if(typeof x==="object"&&x)b().scrollTo(x);else b().scrollTo(x||0,y||0)};window.scrollTo=to;window.scroll=to;window.scrollBy=function(x,y){if(!b())return;if(typeof x==="object"&&x)b().scrollBy(x);else b().scrollBy(x||0,y||0)};var hook=function(){b().addEventListener("scroll",function(){window.dispatchEvent(new Event("scroll"))},{passive:true})};if(b())hook();else document.addEventListener("DOMContentLoaded",hook)};if(want())on();else if(ios&&f!=="0")document.addEventListener("DOMContentLoaded",function(){if(want()){var y=window.pageYOffset;on();b().scrollTop=y}})})()}catch(e){}`;

/** Runs right after the menu bar's markup: notes its height as --topbar-h. */
/** Light mode for a phone or computer with little to spare (few cores or
 *  little memory - not told by Apple's browser - data saver, or reduced
 *  motion), or one seen stumbling (a short look at its frames once the
 *  page has loaded): the purely decorative movement (fireflies, the lamp's
 *  sway, glimmers and sheens) rests, and frosted glass becomes a plain
 *  tint, leaving the phone free for the story. localStorage "taleo.lite"
 *  = "1" or "0" sets it either way. */
const LITE_INIT = `try{(function(){var d=document.documentElement,n=navigator,s=null;try{s=localStorage.getItem("taleo.lite")||sessionStorage.getItem("taleo.lite.auto")}catch(e){}var on=function(){d.dataset.lite="1"};if(s==="0")return;if(s==="1")return on();var apple=n.vendor==="Apple Computer, Inc.";if((!apple&&(n.hardwareConcurrency||8)<=4)||(n.deviceMemory||8)<=3||(n.connection&&n.connection.saveData)||(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))return on();var look=function(){var last=0,slow=0,count=0,t0=0;var f=function(t){if(!t0)t0=t;if(last&&t-last>50)slow++;last=t;count++;if(t-t0<4000)requestAnimationFrame(f);else if(slow>=8&&document.visibilityState==="visible"){on();try{sessionStorage.setItem("taleo.lite.auto","1")}catch(e){}}};requestAnimationFrame(f)};if(document.readyState==="complete")setTimeout(look,1500);else addEventListener("load",function(){setTimeout(look,1500)})})()}catch(e){}`;
const TOPBAR_HEIGHT = `try{(function(){var b=document.querySelector(".topbar");if(b)document.documentElement.style.setProperty("--topbar-h",Math.round(b.getBoundingClientRect().height)+"px")})()}catch(e){}`;

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
            __html: `${NIGHT_INIT}${LITE_INIT}${IN_APP}${INSTALL_CATCH}${EARLY_FETCH}${LEAVES_BACK}`,
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
          {/* The menu bar's height, measured the moment the bar exists
              (before anything below it is drawn), for layouts that sit just
              under it - the story reader fills exactly the screen below.
              Left until the app had started, a book that came with the
              page was drawn at a guessed size first and resized a second
              or two later. (The app keeps it up to date from there: see
              NightMode.) */}
          <script dangerouslySetInnerHTML={{ __html: TOPBAR_HEIGHT }} />
          <main>
            {/* opens at the top of the page content, below the fixed bar */}
            <PullToRefresh />
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
